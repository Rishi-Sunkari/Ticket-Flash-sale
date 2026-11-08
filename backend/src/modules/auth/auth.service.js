import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { signAccessToken } from '../../utils/jwt.js';

/**
 * Bcrypt cost. Each +1 doubles the work for both attacker and server.
 * 12 is a reasonable 2020s default; tune it against your login latency budget.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Pre-computed hash used when the email does not exist, so login takes roughly
 * the same time whether or not an account exists. Without it, response time
 * leaks which emails are registered (user enumeration).
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('flashsale-timing-equaliser', BCRYPT_ROUNDS);

/** Public shape of a user — the password hash never leaves this module. */
function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function registerUser({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
    });

    return { user: toPublicUser(user), token: signAccessToken(user) };
  } catch (error) {
    // Relying on the unique index (instead of a pre-check SELECT) avoids a
    // race where two concurrent sign-ups both pass the existence check.
    if (error.code === 'P2002') {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }

    throw error;
  }
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    throw AppError.unauthorized('Invalid email or password');
  }

  return { user: toPublicUser(user), token: signAccessToken(user) };
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return toPublicUser(user);
}
