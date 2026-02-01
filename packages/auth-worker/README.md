# @janos/auth-worker

Cloudflare Worker for Janos OAuth authentication.

## Overview

This worker handles OAuth authentication for the Janos browser-based static site generator. It exchanges GitHub OAuth authorization codes for access tokens, keeping the client secret secure on the server side.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/authorize/{user}/{repo}` | GET | Redirect to GitHub OAuth |
| `/callback` | GET | OAuth callback, exchanges code for token |
| `/token/{user}/{repo}` | GET | Token verification (IndieAuth) |
| `/token/{user}/{repo}` | POST | Token exchange (IndieAuth alternative) |
| `/` or `/health` | GET | Health check |

## How It Works

### Editor Authentication Flow

1. User clicks "Login with GitHub" in the Janos editor
2. Editor redirects to `/authorize/{user}/{repo}?redirect_uri=...`
3. Worker redirects to GitHub OAuth with proper state encoding
4. User authorizes on GitHub
5. GitHub redirects to `/callback` with authorization code
6. Worker exchanges code for token using client secret
7. Worker redirects back to editor with access token
8. Editor stores token and uses it for Git operations

### IndieAuth Support

The worker also supports IndieAuth, allowing your site to serve as an identity provider:

- **GET `/token`**: Verify a token and return user info (`me`, `scope`, `client_id`)
- **POST `/token`**: Alternative token exchange for clients that prefer JSON over redirect

To enable IndieAuth, add these link tags to your website:

```html
<link rel="authorization_endpoint" href="https://janos-auth.workers.dev/authorize/{user}/{repo}">
<link rel="token_endpoint" href="https://janos-auth.workers.dev/token/{user}/{repo}">
```

## Development

```bash
# Install dependencies
pnpm install

# Run locally (starts at http://localhost:8787)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Deploy to Cloudflare
pnpm deploy
```

### Local Development Setup

1. **Create a GitHub OAuth App for development:**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Create a new OAuth App (or use a separate one for dev)
   - Set callback URL to `http://localhost:8787/callback`

2. **Create `.dev.vars` file:**
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your OAuth credentials
   ```

3. **Start the local server:**
   ```bash
   pnpm dev
   ```

4. **Test the flow:**
   - Open `http://localhost:8787/authorize/youruser/yourrepo?redirect_uri=http://localhost:3000/callback`
   - Complete GitHub OAuth
   - You'll be redirected back with the access token

**Note:** For production, remember to update your GitHub OAuth App's callback URL to your deployed worker URL.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |

### Setting Secrets

For deployed workers, set secrets using the Wrangler CLI:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

For local development, create a `.dev.vars` file:

```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

## Self-Hosting

See [SELF_HOSTING_AUTH.md](../../docs/SELF_HOSTING_AUTH.md) for instructions on deploying your own auth worker.

## License

MIT
