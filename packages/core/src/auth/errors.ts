/**
 * Authentication-specific error types
 */

/**
 * Base class for authentication errors
 */
export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

/**
 * Error thrown when OAuth flow is cancelled
 */
export class AuthCancelledError extends AuthError {
  constructor() {
    super('Authentication was cancelled by the user', 'AUTH_CANCELLED');
    this.name = 'AuthCancelledError';
  }
}

/**
 * Error thrown when OAuth callback contains an error
 */
export class AuthCallbackError extends AuthError {
  readonly errorDescription?: string;
  readonly errorUri?: string;

  constructor(error: string, errorDescription?: string, errorUri?: string) {
    super(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`, 'OAUTH_ERROR');
    this.name = 'AuthCallbackError';
    this.errorDescription = errorDescription;
    this.errorUri = errorUri;
  }
}

/**
 * Error thrown when token exchange fails
 */
export class TokenExchangeError extends AuthError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'TOKEN_EXCHANGE_FAILED');
    this.name = 'TokenExchangeError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when token is expired
 */
export class TokenExpiredError extends AuthError {
  constructor() {
    super('Access token has expired', 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

/**
 * Error thrown when token refresh fails
 */
export class RefreshTokenError extends AuthError {
  constructor(message: string) {
    super(message, 'REFRESH_FAILED');
    this.name = 'RefreshTokenError';
  }
}

/**
 * Error thrown when user info fetch fails
 */
export class UserInfoError extends AuthError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'USER_INFO_FAILED');
    this.name = 'UserInfoError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when state parameter doesn't match
 */
export class StateValidationError extends AuthError {
  constructor() {
    super('OAuth state parameter mismatch - possible CSRF attack', 'STATE_MISMATCH');
    this.name = 'StateValidationError';
  }
}

/**
 * Error thrown when not authenticated but authentication is required
 */
export class NotAuthenticatedError extends AuthError {
  constructor() {
    super('User is not authenticated', 'NOT_AUTHENTICATED');
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends AuthError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR');
    this.name = 'StorageError';
  }
}

/**
 * Type guard to check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Type guard to check for specific auth error codes
 */
export function isAuthErrorCode(error: unknown, code: string): boolean {
  return isAuthError(error) && error.code === code;
}
