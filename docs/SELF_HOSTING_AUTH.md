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

## Optional: Enable IndieAuth

If you want your website to serve as an IndieAuth provider (allowing you to sign into other IndieWeb tools with your domain), add these link tags to your site's template:

```html
<link rel="authorization_endpoint" href="https://your-worker-url/authorize/{github-user}/{github-repo}">
<link rel="token_endpoint" href="https://your-worker-url/token/{github-user}/{github-repo}">
```

Replace `{github-user}` and `{github-repo}` with your actual GitHub username and repository name.

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
