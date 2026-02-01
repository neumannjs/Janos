/**
 * OAuth callback handler
 *
 * Receives the callback from GitHub OAuth, exchanges the authorization
 * code for an access token, and redirects back to the original client.
 *
 * Flow:
 * 1. GitHub redirects here with code and state
 * 2. Decode state to get original redirect_uri
 * 3. Exchange code for token using client secret
 * 4. Redirect to original client with token (or code for IndieAuth)
 */

import type { Env } from '../index.js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

interface DecodedState {
  redirectUri: string;
  clientState?: string;
  clientId?: string;
  me?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Decode state from GitHub callback
 */
function decodeState(state: string): DecodedState | null {
  try {
    return JSON.parse(atob(state)) as DecodedState;
  } catch {
    return null;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  code: string,
  env: Env,
  workerOrigin: string
): Promise<GitHubTokenResponse> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${workerOrigin}/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.statusText}`);
  }

  return (await response.json()) as GitHubTokenResponse;
}

export async function handleCallback(
  request: Request,
  env: Env,
  _params: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);

  // Get code and state from GitHub
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle error from GitHub
  if (error) {
    // Try to decode state to redirect with error
    if (state) {
      const decoded = decodeState(state);
      if (decoded?.redirectUri) {
        const redirectUrl = new URL(decoded.redirectUri);
        redirectUrl.searchParams.set('error', error);
        if (errorDescription) {
          redirectUrl.searchParams.set('error_description', errorDescription);
        }
        if (decoded.clientState) {
          redirectUrl.searchParams.set('state', decoded.clientState);
        }
        return Response.redirect(redirectUrl.toString(), 302);
      }
    }

    // Can't redirect, return error response
    return new Response(
      JSON.stringify({ error, error_description: errorDescription }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return new Response(
      JSON.stringify({ error: 'Missing code or state parameter' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Decode state
  const decoded = decodeState(state);
  if (!decoded || !decoded.redirectUri) {
    return new Response(
      JSON.stringify({ error: 'Invalid state parameter' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Exchange code for token
  let tokenResponse: GitHubTokenResponse;
  try {
    tokenResponse = await exchangeCodeForToken(code, env, url.origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    const redirectUrl = new URL(decoded.redirectUri);
    redirectUrl.searchParams.set('error', 'token_exchange_failed');
    redirectUrl.searchParams.set('error_description', message);
    if (decoded.clientState) {
      redirectUrl.searchParams.set('state', decoded.clientState);
    }
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // Handle token exchange error
  if (tokenResponse.error) {
    const redirectUrl = new URL(decoded.redirectUri);
    redirectUrl.searchParams.set('error', tokenResponse.error);
    if (tokenResponse.error_description) {
      redirectUrl.searchParams.set(
        'error_description',
        tokenResponse.error_description
      );
    }
    if (decoded.clientState) {
      redirectUrl.searchParams.set('state', decoded.clientState);
    }
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // Success! Redirect with token
  const redirectUrl = new URL(decoded.redirectUri);

  // For the Janos editor: return the token directly
  // The editor will use this to make Git operations
  if (tokenResponse.access_token) {
    redirectUrl.searchParams.set('access_token', tokenResponse.access_token);
  }
  if (tokenResponse.token_type) {
    redirectUrl.searchParams.set('token_type', tokenResponse.token_type);
  }
  if (tokenResponse.scope) {
    redirectUrl.searchParams.set('scope', tokenResponse.scope);
  }
  if (decoded.clientState) {
    redirectUrl.searchParams.set('state', decoded.clientState);
  }

  return Response.redirect(redirectUrl.toString(), 302);
}
