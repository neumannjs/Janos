/**
 * OAuth callback handler
 *
 * Receives the callback from GitHub OAuth and redirects back to the
 * original client with the authorization code.
 *
 * This is a pass-through handler - it does NOT exchange the code for a token.
 * The client will exchange the code at the token endpoint.
 *
 * Flow:
 * 1. GitHub redirects here with code and state
 * 2. Decode state to get original redirect_uri
 * 3. Redirect to original client with GitHub's code
 * 4. Client exchanges code at /token endpoint
 */

import type { Env } from '../index.js';

interface DecodedState {
  redirectUri: string;
  clientState?: string;
  clientId?: string;
  me?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  user?: string;
  repo?: string;
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

export async function handleCallback(
  request: Request,
  _env: Env,
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

  // Pass through the GitHub code to the client
  // The client will exchange it at the token endpoint
  const redirectUrl = new URL(decoded.redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (decoded.clientState) {
    redirectUrl.searchParams.set('state', decoded.clientState);
  }

  return Response.redirect(redirectUrl.toString(), 302);
}
