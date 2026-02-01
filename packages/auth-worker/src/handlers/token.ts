/**
 * Token endpoint handler (IndieAuth)
 *
 * This endpoint serves two purposes:
 *
 * GET: Token verification
 *   - Client passes token in Authorization header
 *   - Returns token info (me, scope, client_id) if valid
 *   - Used by IndieAuth clients to verify tokens
 *
 * POST: Token exchange (alternative to callback redirect)
 *   - Client sends authorization code
 *   - Returns access token in JSON response
 *   - Some IndieAuth clients prefer this over redirect
 *
 * Note: The Janos editor typically doesn't use this endpoint - it gets
 * the token directly from the /callback redirect. This endpoint exists
 * for IndieAuth compliance.
 */

import type { Env } from '../index.js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

interface TokenExchangeRequest {
  grant_type?: string;
  code?: string;
  client_id?: string;
  redirect_uri?: string;
  code_verifier?: string; // PKCE
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  html_url: string;
}

/**
 * Verify a GitHub access token and get user info
 */
async function verifyToken(
  token: string
): Promise<{ valid: boolean; user?: GitHubUser }> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Janos-Auth-Worker/0.1.0',
    },
  });

  if (!response.ok) {
    return { valid: false };
  }

  const user = (await response.json()) as GitHubUser;
  return { valid: true, user };
}

/**
 * Get the "me" URL for a user/repo combination
 * This is the user's GitHub Pages URL
 */
async function getMeUrl(
  user: string,
  repo: string,
  token: string
): Promise<string | null> {
  try {
    // Check if it's a username.github.io repo
    if (repo.toLowerCase() === `${user.toLowerCase()}.github.io`) {
      return `https://${user.toLowerCase()}.github.io`;
    }

    // Try to get the repo's homepage (custom domain)
    const response = await fetch(`${GITHUB_API_URL}/repos/${user}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Janos-Auth-Worker/0.1.0',
      },
    });

    if (response.ok) {
      const repoData = (await response.json()) as {
        homepage?: string;
        html_url: string;
      };

      // If there's a custom homepage, use that
      if (repoData.homepage && repoData.homepage.startsWith('https://')) {
        return repoData.homepage;
      }

      // Otherwise, construct GitHub Pages URL
      return `https://${user.toLowerCase()}.github.io/${repo}`;
    }
  } catch {
    // Fall through to default
  }

  // Default to constructed GitHub Pages URL
  return `https://${user.toLowerCase()}.github.io/${repo}`;
}

/**
 * Handle GET request - token verification
 */
async function handleVerification(
  request: Request,
  _env: Env,
  params: Record<string, string>
): Promise<Response> {
  const { user, repo } = params;

  // Get token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', error_description: 'No token provided' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Parse Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', error_description: 'Invalid token format' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const token = match[1];

  // Verify token with GitHub
  const { valid, user: githubUser } = await verifyToken(token);
  if (!valid || !githubUser) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', error_description: 'Invalid token' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Verify the token belongs to the expected user
  if (githubUser.login.toLowerCase() !== user.toLowerCase()) {
    return new Response(
      JSON.stringify({
        error: 'forbidden',
        error_description: 'Token does not belong to this user',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Get the "me" URL
  const me = await getMeUrl(user, repo, token);

  // Return IndieAuth-style response
  return new Response(
    JSON.stringify({
      me,
      client_id: 'https://github.com',
      scope: 'create update delete media',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Handle POST request - token exchange
 */
async function handleExchange(
  request: Request,
  env: Env,
  params: Record<string, string>
): Promise<Response> {
  const { user, repo } = params;
  const url = new URL(request.url);

  // Parse request body (form-encoded or JSON)
  let body: TokenExchangeRequest;
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    body = (await request.json()) as TokenExchangeRequest;
  } else {
    // form-encoded
    const formData = await request.formData();
    body = {
      grant_type: formData.get('grant_type')?.toString(),
      code: formData.get('code')?.toString(),
      client_id: formData.get('client_id')?.toString(),
      redirect_uri: formData.get('redirect_uri')?.toString(),
      code_verifier: formData.get('code_verifier')?.toString(),
    };
  }

  // For IndieAuth, grant_type should be 'authorization_code'
  // But we also accept requests without grant_type for simpler clients
  if (body.grant_type && body.grant_type !== 'authorization_code') {
    return new Response(
      JSON.stringify({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code is supported',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (!body.code) {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Missing code' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Exchange code for token with GitHub
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: body.code,
      redirect_uri: body.redirect_uri ?? `${url.origin}/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    return new Response(
      JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to exchange code',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    return new Response(
      JSON.stringify({
        error: tokenData.error,
        error_description: tokenData.error_description,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (!tokenData.access_token) {
    return new Response(
      JSON.stringify({
        error: 'server_error',
        error_description: 'No access token in response',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Verify the token belongs to the expected user
  const { valid, user: githubUser } = await verifyToken(tokenData.access_token);
  if (!valid || !githubUser) {
    return new Response(
      JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to verify token',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  if (githubUser.login.toLowerCase() !== user.toLowerCase()) {
    return new Response(
      JSON.stringify({
        error: 'forbidden',
        error_description: 'Authenticated user does not match expected user',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  // Get the "me" URL
  const me = await getMeUrl(user, repo, tokenData.access_token);

  // Return IndieAuth-style response
  return new Response(
    JSON.stringify({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type ?? 'Bearer',
      scope: tokenData.scope,
      me,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export async function handleToken(
  request: Request,
  env: Env,
  params: Record<string, string>
): Promise<Response> {
  if (request.method === 'GET') {
    return handleVerification(request, env, params);
  } else {
    return handleExchange(request, env, params);
  }
}
