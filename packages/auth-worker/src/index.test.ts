/**
 * Tests for the Janos Auth Worker
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the handler functions
const mockEnv = {
  GITHUB_CLIENT_ID: 'test_client_id',
  GITHUB_CLIENT_SECRET: 'test_client_secret',
};

// Type for JSON response data
interface JsonResponse {
  status?: string;
  service?: string;
  version?: string;
  error?: string;
  error_description?: string;
}

// Import worker after defining mocks
import worker from './index.js';

describe('Auth Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health endpoint', () => {
    it('returns health status for root path', async () => {
      const request = new Request('https://auth.example.com/');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as JsonResponse;
      expect(data).toEqual({
        status: 'ok',
        service: 'janos-auth',
        version: '0.1.0',
      });
    });

    it('returns health status for /health path', async () => {
      const request = new Request('https://auth.example.com/health');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const data = await response.json() as JsonResponse;
      expect(data.status).toBe('ok');
    });
  });

  describe('CORS', () => {
    it('handles OPTIONS preflight requests', async () => {
      const request = new Request('https://auth.example.com/authorize/user/repo', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
        },
      });
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Authorize endpoint', () => {
    it('returns 400 if redirect_uri is missing', async () => {
      const request = new Request('https://auth.example.com/authorize/testuser/testrepo');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('redirect_uri is required');
    });

    it('returns 400 if redirect_uri is invalid', async () => {
      const request = new Request(
        'https://auth.example.com/authorize/testuser/testrepo?redirect_uri=not-a-url'
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('Invalid redirect_uri');
    });

    it('redirects to GitHub with valid parameters', async () => {
      const request = new Request(
        'https://auth.example.com/authorize/testuser/testrepo?redirect_uri=https://example.com/callback&state=abc123'
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();
      expect(location).toContain('github.com/login/oauth/authorize');
      expect(location).toContain('client_id=test_client_id');
      expect(location).toContain('scope=');
    });

    it('includes required scopes', async () => {
      const request = new Request(
        'https://auth.example.com/authorize/testuser/testrepo?redirect_uri=https://example.com/callback'
      );
      const response = await worker.fetch(request, mockEnv);

      const location = response.headers.get('Location') ?? '';
      const params = new URL(location).searchParams;
      const scope = params.get('scope') ?? '';

      expect(scope).toContain('repo');
      expect(scope).toContain('read:user');
      expect(scope).toContain('user:email');
    });
  });

  describe('Callback endpoint', () => {
    it('returns 400 if code is missing', async () => {
      const request = new Request(
        'https://auth.example.com/callback?state=test'
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('Missing code or state parameter');
    });

    it('returns 400 if state is missing', async () => {
      const request = new Request(
        'https://auth.example.com/callback?code=test'
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('Missing code or state parameter');
    });

    it('returns 400 if state is invalid', async () => {
      const request = new Request(
        'https://auth.example.com/callback?code=test&state=invalid'
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('Invalid state parameter');
    });

    it('passes through the GitHub code to the client redirect_uri', async () => {
      // Create encoded state with redirect_uri and client state
      const state = btoa(JSON.stringify({
        redirectUri: 'https://example.com/callback',
        clientState: 'client_state_123',
      }));

      const request = new Request(
        `https://auth.example.com/callback?code=github_code_xyz&state=${encodeURIComponent(state)}`
      );
      const response = await worker.fetch(request, mockEnv);

      // Should redirect to client with code
      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();

      const redirectUrl = new URL(location!);
      expect(redirectUrl.origin).toBe('https://example.com');
      expect(redirectUrl.pathname).toBe('/callback');
      expect(redirectUrl.searchParams.get('code')).toBe('github_code_xyz');
      expect(redirectUrl.searchParams.get('state')).toBe('client_state_123');
    });

    it('redirects with error when GitHub returns an error', async () => {
      const state = btoa(JSON.stringify({
        redirectUri: 'https://example.com/callback',
        clientState: 'client_state_123',
      }));

      const request = new Request(
        `https://auth.example.com/callback?error=access_denied&error_description=User+denied&state=${encodeURIComponent(state)}`
      );
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();

      const redirectUrl = new URL(location!);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('error_description')).toBe('User denied');
      expect(redirectUrl.searchParams.get('state')).toBe('client_state_123');
    });
  });

  describe('Token endpoint', () => {
    it('returns 401 for GET without Authorization header', async () => {
      const request = new Request('https://auth.example.com/token/testuser/testrepo');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('unauthorized');
    });

    it('returns 401 for invalid Authorization format', async () => {
      const request = new Request('https://auth.example.com/token/testuser/testrepo', {
        headers: {
          Authorization: 'Invalid token',
        },
      });
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('unauthorized');
      expect(data.error_description).toBe('Invalid token format');
    });

    it('returns 400 for POST without code', async () => {
      const request = new Request('https://auth.example.com/token/testuser/testrepo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('invalid_request');
    });

    it('returns 400 for unsupported grant_type', async () => {
      const request = new Request('https://auth.example.com/token/testuser/testrepo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'password',
          code: 'test',
        }),
      });
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(400);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('unsupported_grant_type');
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown paths', async () => {
      const request = new Request('https://auth.example.com/unknown');
      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(404);
      const data = await response.json() as JsonResponse;
      expect(data.error).toBe('Not found');
    });
  });

  describe('Missing credentials', () => {
    it('returns 500 if credentials are missing', async () => {
      const request = new Request(
        'https://auth.example.com/authorize/testuser/testrepo?redirect_uri=https://example.com/callback'
      );
      const response = await worker.fetch(request, {
        GITHUB_CLIENT_ID: '',
        GITHUB_CLIENT_SECRET: '',
      });

      expect(response.status).toBe(500);
      const data = await response.json() as JsonResponse;
      expect(data.error).toContain('missing credentials');
    });
  });
});
