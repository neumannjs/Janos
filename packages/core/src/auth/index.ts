/**
 * Authentication module
 *
 * Provides abstract authentication interface with OAuth implementations.
 */

// Types
export type {
  IAuthProvider,
  AuthProviderType,
  AuthProviderConfig,
  AuthProviderFactory,
  AuthState,
  AuthUser,
  AuthToken,
  AuthEvents,
  OAuthConfig,
} from './types.js';

// Errors
export {
  AuthError,
  AuthCancelledError,
  AuthCallbackError,
  TokenExchangeError,
  TokenExpiredError,
  RefreshTokenError,
  UserInfoError,
  StateValidationError,
  NotAuthenticatedError,
  StorageError,
  isAuthError,
  isAuthErrorCode,
} from './errors.js';

// Implementations
export { GitHubAuthProvider, createGitHubAuth } from './github.js';
