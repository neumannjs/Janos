/**
 * Authorization endpoint handler
 *
 * Redirects the user to GitHub OAuth with proper state encoding.
 * This endpoint is used both by the Janos editor and by third-party
 * IndieAuth clients (if the user advertises it on their website).
 *
 * Flow:
 * 1. Client redirects here with redirect_uri, state, scope, client_id
 * 2. We encode these in our own state parameter
 * 3. Redirect to GitHub OAuth
 * 4. After GitHub auth, /callback receives the code
 * 5. /callback redirects back to client with code
 */

import type { Env } from '../index.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// Required GitHub scopes for Janos
const REQUIRED_SCOPES = ['repo', 'read:user', 'user:email'];

interface AuthorizeParams {
  // IndieAuth parameters
  redirect_uri?: string;
  state?: string;
  scope?: string;
  client_id?: string;
  response_type?: string;
  me?: string; // IndieAuth: user's domain
  code_challenge?: string; // PKCE
  code_challenge_method?: string; // PKCE
}

/**
 * Encode state for passing through GitHub OAuth
 * Contains all info needed to redirect back to the original client
 */
function encodeState(params: {
  redirectUri: string;
  clientState?: string;
  clientId?: string;
  me?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  user?: string;
  repo?: string;
}): string {
  return btoa(JSON.stringify(params));
}

export async function handleAuthorize(
  request: Request,
  env: Env,
  params: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const { user, repo } = params;

  // Parse query parameters
  const queryParams: AuthorizeParams = {
    redirect_uri: url.searchParams.get('redirect_uri') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    scope: url.searchParams.get('scope') ?? undefined,
    client_id: url.searchParams.get('client_id') ?? undefined,
    response_type: url.searchParams.get('response_type') ?? undefined,
    me: url.searchParams.get('me') ?? undefined,
    code_challenge: url.searchParams.get('code_challenge') ?? undefined,
    code_challenge_method:
      url.searchParams.get('code_challenge_method') ?? undefined,
  };

  // redirect_uri is required
  if (!queryParams.redirect_uri) {
    return new Response(
      JSON.stringify({ error: 'redirect_uri is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate redirect_uri - must be a valid URL
  try {
    new URL(queryParams.redirect_uri);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid redirect_uri' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Encode our state containing all the original parameters
  // Include user/repo so callback knows which endpoint was used
  const encodedState = encodeState({
    redirectUri: queryParams.redirect_uri,
    clientState: queryParams.state,
    clientId: queryParams.client_id,
    me: queryParams.me,
    codeChallenge: queryParams.code_challenge,
    codeChallengeMethod: queryParams.code_challenge_method,
    user,
    repo,
  });

  // Build GitHub OAuth URL
  // Always request required scopes, merge with any additional requested
  const requestedScopes = queryParams.scope?.split(' ').filter(Boolean) ?? [];
  const allScopes = [...new Set([...REQUIRED_SCOPES, ...requestedScopes])];

  const githubParams = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/callback`,
    scope: allScopes.join(' '),
    state: encodedState,
    // Include user/repo info for potential validation later
    login: user, // Hint to GitHub which account to use
  });

  const githubAuthUrl = `${GITHUB_AUTHORIZE_URL}?${githubParams.toString()}`;

  // Redirect to GitHub
  return Response.redirect(githubAuthUrl, 302);
}
