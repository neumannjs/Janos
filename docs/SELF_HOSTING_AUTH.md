# Self-Hosting the Janos Auth Worker

This guide explains how to deploy your own instance of the Janos authentication worker.

## Why Self-Host?

By default, Janos uses a hosted auth worker at `janos-auth.workers.dev`. Self-hosting gives you:

- **Full control**: Your OAuth credentials, your infrastructure
- **Privacy**: Authentication flows stay on your own domain
- **Customization**: Modify the worker for your specific needs
- **Reliability**: No dependency on external services

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- [Node.js](https://nodejs.org/) 18 or later
- [pnpm](https://pnpm.io/) or npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## Step 1: Create a GitHub OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: `Janos Auth (your-name)` or similar
   - **Homepage URL**: Your website URL (e.g., `https://yourdomain.com`)
   - **Authorization callback URL**: `https://your-worker.your-subdomain.workers.dev/callback`
     - If using a custom domain: `https://auth.yourdomain.com/callback`
4. Click "Register application"
5. Note your **Client ID**
6. Generate a new **Client Secret** and save it securely

## Step 2: Clone and Configure

```bash
# Clone the Janos repository
git clone https://github.com/your-fork/janos.git
cd janos/packages/auth-worker

# Install dependencies
pnpm install

# Login to Cloudflare
wrangler login
```

## Step 3: Configure wrangler.toml

Edit `wrangler.toml` to customize your deployment:

```toml
name = "your-janos-auth"  # Your worker name
main = "src/index.ts"
compatibility_date = "2024-02-01"

# Optional: custom domain
# routes = [
#   { pattern = "auth.yourdomain.com/*", zone_name = "yourdomain.com" }
# ]
```

## Step 4: Set Secrets

```bash
# Set the GitHub OAuth credentials as secrets
wrangler secret put GITHUB_CLIENT_ID
# Enter your Client ID when prompted

wrangler secret put GITHUB_CLIENT_SECRET
# Enter your Client Secret when prompted
```

## Step 5: Deploy

```bash
pnpm deploy
```

After deployment, Wrangler will show your worker URL:
```
Published your-janos-auth (0.5 sec)
  https://your-janos-auth.your-subdomain.workers.dev
```

## Step 6: Update GitHub OAuth App

Go back to your GitHub OAuth App settings and update the **Authorization callback URL** to match your deployed worker:

```
https://your-janos-auth.your-subdomain.workers.dev/callback
```

## Step 7: Configure Janos Editor

In your site's `janos.config.json`, set the auth worker URL:

```json
{
  "editor": {
    "authWorkerUrl": "https://your-janos-auth.your-subdomain.workers.dev"
  }
}
```

Or if using environment variables in the web app:

```
VITE_AUTH_WORKER_URL=https://your-janos-auth.your-subdomain.workers.dev
```

## Optional: Custom Domain

To use a custom domain like `auth.yourdomain.com`:

1. Add the domain to your Cloudflare account
2. Add a route in `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "auth.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```
3. Redeploy: `pnpm deploy`
4. Update your GitHub OAuth App callback URL

## IndieAuth Support

The auth worker implements the [IndieAuth](https://indieauth.spec.indieweb.org/) specification, which allows you to use your domain as your identity when signing into IndieWeb services like [webmention.io](https://webmention.io).

### How IndieAuth Works

1. You visit a service (e.g., webmention.io) and enter your domain
2. The service discovers your `authorization_endpoint` and `token_endpoint` from your site's HTML
3. You're redirected to the authorization endpoint, which sends you to GitHub to authenticate
4. After GitHub authentication, you're redirected back to the service with an authorization code
5. The service exchanges the code at your token endpoint to verify your identity
6. The token endpoint returns your domain as the `me` URL, confirming you own it

### Enabling IndieAuth

Add these link tags to your site's `<head>`:

```html
<link rel="authorization_endpoint" href="https://your-worker-url/authorize/{github-user}/{github-repo}">
<link rel="token_endpoint" href="https://your-worker-url/token/{github-user}/{github-repo}">
```

Replace:
- `your-worker-url` with your auth worker URL (e.g., `janos-auth.workers.dev`)
- `{github-user}` with your GitHub username
- `{github-repo}` with your repository name (e.g., `username.github.io`)

Example for a user "alice" with repo "alice.github.io":
```html
<link rel="authorization_endpoint" href="https://janos-auth.workers.dev/authorize/alice/alice.github.io">
<link rel="token_endpoint" href="https://janos-auth.workers.dev/token/alice/alice.github.io">
```

### What You Can Do With IndieAuth

Once enabled, you can sign into:
- **[webmention.io](https://webmention.io)** - Receive and display webmentions on your site
- **[IndieLogin.com](https://indielogin.com)** - Test your IndieAuth setup
- **[Quill](https://quill.p3k.io)** - Micropub client for posting
- **[Indigenous](https://indigenous.realize.be/)** - Mobile app for IndieWeb
- Other services that support "Sign in with your domain"

### The "me" URL

When you authenticate, the token endpoint returns a `me` URL - this is your identity URL. The worker determines this by:

1. Checking the GitHub Pages API for your repository's published URL
2. This correctly handles custom domains (e.g., `https://www.gijsvandam.nl`)
3. Falls back to `https://{user}.github.io/{repo}` if the API is unavailable

## Local Development

For testing locally:

1. Create `.dev.vars` in the auth-worker directory:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

2. Update your GitHub OAuth App callback URL temporarily:
   ```
   http://localhost:8787/callback
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Test at `http://localhost:8787`

## Testing IndieAuth

### Testing the OAuth Flow Locally

You can test the basic OAuth flow with a locally running auth worker:

1. Start the worker: `pnpm dev`
2. Visit the authorize endpoint in your browser:
   ```
   http://localhost:8787/authorize/your-user/your-repo?redirect_uri=http://localhost:3000/callback&state=test
   ```
3. After GitHub authentication, you'll be redirected to your `redirect_uri` with a `code` parameter
4. Exchange the code at the token endpoint:
   ```bash
   curl -X POST http://localhost:8787/token/your-user/your-repo \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "code=THE_CODE_FROM_STEP_3"
   ```
5. You should receive a JSON response with `access_token` and `me`

### Testing with IndieLogin.com

The easiest way to test IndieAuth in production:

1. Deploy your auth worker to Cloudflare
2. Add the IndieAuth link tags to your published site
3. Visit [IndieLogin.com](https://indielogin.com) and enter your domain
4. Complete the authentication flow
5. If successful, you'll see your profile information

### Testing with webmention.io

1. Deploy your auth worker and publish your site with IndieAuth link tags
2. Visit [webmention.io](https://webmention.io)
3. Enter your domain and click "Sign In"
4. Authenticate with GitHub
5. You should be logged in and see your webmention dashboard

### Testing IndieAuth Locally with External Services

Services like webmention.io need to access your site to discover endpoints. For local testing:

**Option 1: Use ngrok (exposes local services to internet)**
```bash
# Terminal 1: Run auth worker
cd packages/auth-worker && pnpm dev

# Terminal 2: Expose auth worker
ngrok http 8787
# Note the https URL, e.g., https://abc123.ngrok.io

# Terminal 3: Serve your local site
# (your local dev server)

# Terminal 4: Expose local site
ngrok http 3000
# Note the https URL, e.g., https://xyz789.ngrok.io
```

Then:
1. Update your local site's template to use the ngrok auth worker URL
2. Update your GitHub OAuth App callback to `https://abc123.ngrok.io/callback`
3. Test at webmention.io with your ngrok site URL

**Option 2: Use deployed auth worker with local site**
```bash
# Just expose your local site
ngrok http 3000
```

Point your local site's template to the production auth worker (`janos-auth.workers.dev`), then test with your ngrok URL.

### Verifying Token Endpoint

Test that token verification works with a valid GitHub token:

```bash
curl https://your-worker-url/token/your-user/your-repo \
  -H "Authorization: Bearer ghp_your_github_token"
```

Should return:
```json
{
  "me": "https://your-domain.com",
  "client_id": "https://github.com",
  "scope": "create update delete media"
}
```

## Troubleshooting

### "Missing required environment variables"

Ensure both secrets are set:
```bash
wrangler secret list
```

### "Invalid redirect_uri"

The callback URL in your GitHub OAuth App must exactly match the URL the worker uses. Check:
- Protocol (https vs http)
- Domain spelling
- Path (`/callback`)
- No trailing slash

### CORS Errors

The worker includes CORS headers for all origins. If you're still seeing CORS errors:
- Check browser console for the actual error
- Ensure the worker is deployed and accessible
- Try a fresh deployment: `pnpm deploy`

### Token Exchange Failed

- Verify your Client ID and Client Secret are correct
- Check that the OAuth App is not suspended
- Ensure the callback URL matches exactly

## Security Considerations

1. **Keep your Client Secret secure**: Never commit it to version control
2. **Use secrets, not vars**: Client Secret must be a Wrangler secret, not a wrangler.toml var
3. **Monitor usage**: Check Cloudflare analytics for unusual activity
4. **Rotate secrets periodically**: Generate new Client Secrets and update regularly

## Updating

To update your worker with changes from upstream:

```bash
cd janos
git pull upstream main  # or however you sync
cd packages/auth-worker
pnpm install
pnpm deploy
```

## Cost

Cloudflare Workers has a generous free tier:
- 100,000 requests/day
- No charge for CPU time under limits

Most personal sites will never exceed the free tier. For high-traffic sites, see [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
