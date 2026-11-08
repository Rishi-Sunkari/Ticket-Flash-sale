import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import {
  AuthResult,
  Credentials,
  RegisterPayload,
  User,
} from '../models/user.model';

const TOKEN_KEY = 'flashsale.token';
const USER_KEY = 'flashsale.user';

/**
 * Authentication state.
 *
 * Lives in `core` rather than `features/auth` because guards, interceptors and
 * the app shell all depend on it — keeping a shared singleton inside one feature
 * would force every other feature to import that feature.
 *
 * The token is kept in localStorage. Trade-off: it survives reloads but is
 * readable by JavaScript, so any XSS becomes token theft. The production-grade
 * alternative is a short-lived access token plus an httpOnly refresh cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly userSignal = signal<User | null>(readStoredUser());
  private readonly tokenSignal = signal<string | null>(readStoredToken());

  /** Read-only projections for templates and other services. */
  readonly user = this.userSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  login(credentials: Credentials): Observable<User> {
    return this.http
      .post<ApiResponse<AuthResult>>(`${this.baseUrl}/login`, credentials)
      .pipe(
        tap(({ data }) => this.persistSession(data)),
        map(({ data }) => data.user),
      );
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http
      .post<ApiResponse<AuthResult>>(`${this.baseUrl}/register`, payload)
      .pipe(
        tap(({ data }) => this.persistSession(data)),
        map(({ data }) => data.user),
      );
  }

  /** Re-reads the profile from the API (used to validate a stored token). */
  refreshProfile(): Observable<User> {
    return this.http.get<ApiResponse<{ user: User }>>(`${this.baseUrl}/me`).pipe(
      tap(({ data }) => {
        this.userSignal.set(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }),
      map(({ data }) => data.user),
    );
  }

  logout(redirectTo: string | null = '/login'): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
    this.tokenSignal.set(null);

    if (redirectTo) {
      void this.router.navigate([redirectTo]);
    }
  }

  private persistSession(result: AuthResult): void {
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    this.tokenSignal.set(result.token);
    this.userSignal.set(result.user);
  }
}

function readStoredToken(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

function readStoredUser(): User | null {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    // Corrupted storage must not break the app shell.
    return null;
  }
}
