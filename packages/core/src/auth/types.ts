/**
 * Authentication provider types and interfaces
 */

/**
 * Supported authentication provider types
 */
export type AuthProviderType = 'github' | 'gitlab' | 'gitea';

/**
 * User information from the authentication provider
 */
export interface AuthUser {
  /** Unique user ID */
  id: string;
  /** Username/login */
  username: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Profile URL */
  profileUrl?: string;
}

/**
 * OAuth token information
 */
export interface AuthToken {
  /** Access token */
  accessToken: string;
  /** Token type (usually 'bearer') */
  tokenType: string;
  /** Token scopes */
  scope: string[];
  /** Expiration timestamp (milliseconds since epoch, if applicable) */
  expiresAt?: number;
  /** Refresh token (if applicable) */
  refreshToken?: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** Current user (if authenticated) */
  user: AuthUser | null;
  /** Current token (if authenticated) */
  token: AuthToken | null;
  /** Provider type */
  provider: AuthProviderType | null;
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  /** OAuth client ID */
  clientId: string;
  /** Redirect URI after authentication */
  redirectUri: string;
  /** OAuth scopes to request */
  scopes: string[];
  /** OAuth proxy URL (for CORS) */
  proxyUrl?: string;
}

/**
 * Authentication provider configuration
 */
export interface AuthProviderConfig {
  /** Provider type */
  type: AuthProviderType;
  /** OAuth configuration */
  oauth: OAuthConfig;
  /** Base URL for API (for self-hosted instances) */
  apiBaseUrl?: string;
  /** Token storage key prefix */
  storageKeyPrefix?: string;
}

/**
 * Authentication events
 */
export interface AuthEvents {
  /** Called when authentication state changes */
  onStateChange?: (state: AuthState) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Abstract authentication provider interface
 *
 * This interface provides a unified API for OAuth authentication
 * across different providers (GitHub, GitLab, Gitea).
 */
export interface IAuthProvider {
  /** Provider type identifier */
  readonly type: AuthProviderType;

  /**
   * Get the current authentication state
   */
  getState(): AuthState;

  /**
   * Check if the user is currently authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Get the current access token
   * @returns Access token or null if not authenticated
   */
  getAccessToken(): string | null;

  /**
   * Get the current user information
   * @returns User info or null if not authenticated
   */
  getUser(): AuthUser | null;

  /**
   * Initiate the OAuth login flow
   * Opens the OAuth authorization page in a popup or redirects
   * @param options - Login options
   */
  login(options?: { popup?: boolean }): Promise<void>;

  /**
   * Handle the OAuth callback
   * Called when returning from the OAuth provider
   * @param url - The callback URL with OAuth parameters
   * @returns Authentication result
   */
  handleCallback(url: string): Promise<AuthState>;

  /**
   * Log out the current user
   * Clears stored tokens and state
   */
  logout(): Promise<void>;

  /**
   * Refresh the access token using the refresh token
   * @returns New authentication state
   */
  refresh(): Promise<AuthState>;

  /**
   * Restore authentication state from storage
   * @returns Authentication state
   */
  restore(): Promise<AuthState>;

  /**
   * Subscribe to authentication state changes
   * @param callback - Function called on state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (state: AuthState) => void): () => void;
}

/**
 * Factory function type for creating auth provider instances
 */
export type AuthProviderFactory = (config: AuthProviderConfig, events?: AuthEvents) => IAuthProvider;
