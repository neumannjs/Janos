/**
 * Janos Auth Worker
 *
 * Cloudflare Worker that handles OAuth authentication for Janos.
 * Provides token exchange for the browser-based editor and optionally
 * serves as an IndieAuth provider.
 *
 * Endpoints:
 * - GET  /authorize/{user}/{repo} - Redirect to GitHub OAuth
 * - GET  /callback                - OAuth callback, exchanges code for token
 * - GET  /token/{user}/{repo}     - IndieAuth token verification
 * - POST /token/{user}/{repo}     - Exchange authorization code for token (IndieAuth)
 */

import { handleAuthorize } from './handlers/authorize.js';
import { handleCallback } from './handlers/callback.js';
import { handleToken } from './handlers/token.js';

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

interface RouteMatch {
  handler: (
    request: Request,
    env: Env,
    params: Record<string, string>
  ) => Promise<Response>;
  params: Record<string, string>;
}

/**
 * Simple router for the worker
 */
function matchRoute(
  method: string,
  pathname: string
): RouteMatch | null {
  // GET /authorize/{user}/{repo}
  const authorizeMatch = pathname.match(/^\/authorize\/([^/]+)\/([^/]+)$/);
  if (method === 'GET' && authorizeMatch) {
    return {
      handler: handleAuthorize,
      params: { user: authorizeMatch[1], repo: authorizeMatch[2] },
    };
  }

  // GET /callback
  if (method === 'GET' && pathname === '/callback') {
    return {
      handler: handleCallback,
      params: {},
    };
  }

  // GET or POST /token/{user}/{repo}
  const tokenMatch = pathname.match(/^\/token\/([^/]+)\/([^/]+)$/);
  if ((method === 'GET' || method === 'POST') && tokenMatch) {
    return {
      handler: handleToken,
      params: { user: tokenMatch[1], repo: tokenMatch[2] },
    };
  }

  return null;
}

/**
 * Create JSON error response
 */
function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin') ?? '*';

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'janos-auth',
          version: '0.1.0',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Match route
    const route = matchRoute(method, url.pathname);
    if (!route) {
      return errorResponse('Not found', 404);
    }

    // Verify environment variables are set
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      console.error('Missing required environment variables');
      return errorResponse(
        'Server configuration error: missing credentials',
        500
      );
    }

    try {
      return await route.handler(request, env, route.params);
    } catch (error) {
      console.error('Handler error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  },
};
