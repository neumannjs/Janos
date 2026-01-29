/**
 * GitHub OAuth authentication provider
 */
import type {
  IAuthProvider,
  AuthProviderConfig,
  AuthState,
  AuthUser,
  AuthToken,
  AuthEvents,
} from './types.js';
import {
  AuthCallbackError,
  TokenExchangeError,
  UserInfoError,
  StateValidationError,
  StorageError,
  TokenExpiredError,
} from './errors.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_API_URL = 'https://api.github.com';

/**
 * Storage keys for GitHub auth
 */
interface StorageKeys {
  token: string;
  user: string;
  state: string;
}

/**
 * GitHub OAuth provider implementation
 */
export class GitHubAuthProvider implements IAuthProvider {
  readonly type = 'github' as const;

  private readonly config: AuthProviderConfig;
  private readonly events: AuthEvents;
  private readonly storageKeys: StorageKeys;
  private state: AuthState;
  private subscribers: Set<(state: AuthState) => void> = new Set();

  constructor(config: AuthProviderConfig, events: AuthEvents = {}) {
    this.config = config;
    this.events = events;

    const prefix = config.storageKeyPrefix ?? 'janos_auth';
    this.storageKeys = {
      token: `${prefix}_github_token`,
      user: `${prefix}_github_user`,
      state: `${prefix}_github_state`,
    };

    this.state = {
      isAuthenticated: false,
      user: null,
      token: null,
      provider: 'github',
    };
  }

  private notifySubscribers(): void {
    for (const callback of this.subscribers) {
      try {
        callback(this.state);
      } catch {
        // Ignore subscriber errors
      }
    }
    this.events.onStateChange?.(this.state);
  }

  private updateState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };
    this.notifySubscribers();
  }

  private generateStateParam(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private saveToStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      throw new StorageError(`Failed to save to localStorage: ${error}`);
    }
  }

  private loadFromStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore removal errors
    }
  }

  getState(): AuthState {
    return { ...this.state };
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  getAccessToken(): string | null {
    if (!this.state.token) return null;

    // Check if token is expired
    if (this.state.token.expiresAt && Date.now() >= this.state.token.expiresAt) {
      return null;
    }

    return this.state.token.accessToken;
  }

  getUser(): AuthUser | null {
    return this.state.user;
  }

  async login(options?: { popup?: boolean }): Promise<void> {
    // Generate state parameter for CSRF protection
    const stateParam = this.generateStateParam();
    this.saveToStorage(this.storageKeys.state, stateParam);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.config.oauth.clientId,
      redirect_uri: this.config.oauth.redirectUri,
      scope: this.config.oauth.scopes.join(' '),
      state: stateParam,
    });

    const authorizeUrl = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;

    if (options?.popup) {
      // Open in popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        authorizeUrl,
        'github_oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );
    } else {
      // Redirect to authorization page
      window.location.href = authorizeUrl;
    }
  }

  async handleCallback(url: string): Promise<AuthState> {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // Check for error response
    const error = params.get('error');
    if (error) {
      const errorDescription = params.get('error_description') ?? undefined;
      const errorUri = params.get('error_uri') ?? undefined;
      throw new AuthCallbackError(error, errorDescription, errorUri);
    }

    // Validate state parameter
    const returnedState = params.get('state');
    const savedState = this.loadFromStorage(this.storageKeys.state);
    this.removeFromStorage(this.storageKeys.state);

    if (!returnedState || returnedState !== savedState) {
      throw new StateValidationError();
    }

    // Get authorization code
    const code = params.get('code');
    if (!code) {
      throw new AuthCallbackError('missing_code', 'No authorization code in callback');
    }

    // Exchange code for token via proxy
    const token = await this.exchangeCodeForToken(code);
    this.saveToStorage(this.storageKeys.token, JSON.stringify(token));

    // Fetch user info
    const user = await this.fetchUserInfo(token.accessToken);
    this.saveToStorage(this.storageKeys.user, JSON.stringify(user));

    // Update state
    this.updateState({
      isAuthenticated: true,
      user,
      token,
    });

    return this.getState();
  }

  private async exchangeCodeForToken(code: string): Promise<AuthToken> {
    if (!this.config.oauth.proxyUrl) {
      throw new TokenExchangeError('OAuth proxy URL is required for token exchange');
    }

    const response = await fetch(this.config.oauth.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: this.config.oauth.clientId,
        redirect_uri: this.config.oauth.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new TokenExchangeError(
        `Token exchange failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json() as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      throw new TokenExchangeError(data.error_description ?? data.error);
    }

    if (!data.access_token) {
      throw new TokenExchangeError('No access token in response');
    }

    return {
      accessToken: data.access_token,
      tokenType: data.token_type ?? 'bearer',
      scope: (data.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<AuthUser> {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new UserInfoError(
        `Failed to fetch user info: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json() as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string;
      html_url: string;
    };

    // Fetch email if not public
    let email = data.email;
    if (!email) {
      try {
        const emailResponse = await fetch(`${GITHUB_API_URL}/user/emails`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json() as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primaryEmail = emails.find((e) => e.primary && e.verified);
          email = primaryEmail?.email ?? emails[0]?.email ?? null;
        }
      } catch {
        // Ignore email fetch errors
      }
    }

    return {
      id: String(data.id),
      username: data.login,
      name: data.name ?? data.login,
      email: email ?? '',
      avatarUrl: data.avatar_url,
      profileUrl: data.html_url,
    };
  }

  async logout(): Promise<void> {
    // Clear stored data
    this.removeFromStorage(this.storageKeys.token);
    this.removeFromStorage(this.storageKeys.user);
    this.removeFromStorage(this.storageKeys.state);

    // Update state
    this.updateState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  }

  async refresh(): Promise<AuthState> {
    // GitHub tokens don't expire and don't support refresh
    // Just verify the token is still valid
    const token = this.getAccessToken();
    if (!token) {
      throw new TokenExpiredError();
    }

    try {
      const user = await this.fetchUserInfo(token);
      this.saveToStorage(this.storageKeys.user, JSON.stringify(user));
      this.updateState({ user });
    } catch {
      // Token is invalid, log out
      await this.logout();
      throw new TokenExpiredError();
    }

    return this.getState();
  }

  async restore(): Promise<AuthState> {
    // Try to load from storage
    const tokenJson = this.loadFromStorage(this.storageKeys.token);
    const userJson = this.loadFromStorage(this.storageKeys.user);

    if (!tokenJson || !userJson) {
      return this.getState();
    }

    try {
      const token = JSON.parse(tokenJson) as AuthToken;
      const user = JSON.parse(userJson) as AuthUser;

      // Verify token is still valid
      await this.fetchUserInfo(token.accessToken);

      this.updateState({
        isAuthenticated: true,
        user,
        token,
      });
    } catch {
      // Token is invalid, clear storage
      await this.logout();
    }

    return this.getState();
  }

  subscribe(callback: (state: AuthState) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

/**
 * Create a GitHub auth provider instance
 * @param config - Provider configuration
 * @param events - Event handlers
 * @returns Auth provider
 */
export function createGitHubAuth(config: AuthProviderConfig, events?: AuthEvents): IAuthProvider {
  return new GitHubAuthProvider(config, events);
}
