/**
 * Runtime configuration for the Angular app.
 *
 * The API lives on a different origin during development, which is exactly why
 * the backend needs a CORS allow-list for http://localhost:4200.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api/v1',
};
