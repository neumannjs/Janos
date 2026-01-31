# IndieWeb Architecture and External Services

This document describes the IndieWeb features in the Janos ecosystem, how the external services work, and a roadmap for future support.

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [The GitHub Proxy (neumannjs/githubproxy)](#the-github-proxy)
3. [IndieWeb Standards Explained](#indieweb-standards-explained)
4. [Current Website Setup](#current-website-setup)
5. [External Services Used](#external-services-used)
6. [The Social Web Landscape (2025)](#the-social-web-landscape-2025)
7. [Roadmap: Self-Contained Alternatives](#roadmap-self-contained-alternatives)

---

## Current Architecture Overview

The Janos static site generator relies on several external services for IndieWeb functionality:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER'S WEBSITE                               │
│  (gijswijs.github.io / www.gijsvandam.nl)                              │
│                                                                         │
│  HTML <head> contains:                                                  │
│  ├─ rel="webmention"          → webmention.io                          │
│  ├─ rel="pingback"            → webmention.io                          │
│  ├─ rel="authorization_endpoint" → GitHub Proxy (Azure Functions)      │
│  ├─ rel="token_endpoint"      → GitHub Proxy (Azure Functions)         │
│  ├─ rel="micropub"            → GitHub Proxy (Azure Functions)         │
│  └─ rel="microsub"            → aperture.p3k.io                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GITHUB PROXY                                    │
│  (janos-githubproxy.azurewebsites.net)                                 │
│                                                                         │
│  Azure Functions:                                                       │
│  ├─ /api/authorize/{user}/{repo}  - IndieAuth authorization endpoint   │
│  ├─ /api/callback                 - OAuth callback handler             │
│  ├─ /api/token/{user}/{repo}      - IndieAuth token endpoint           │
│  ├─ /api/micropub/{user}/{repo}   - Micropub endpoint                  │
│  ├─ /api/micropubmedia/{user}/{repo} - Micropub media endpoint         │
│  └─ /api/handler                  - Legacy editor OAuth handler        │
│                                                                         │
│  Secrets stored: CLIENTID, CLIENTSECRET (GitHub OAuth App)             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                │
│                                                                         │
│  ├─ GitHub API           - Repository access, file CRUD                │
│  ├─ webmention.io        - Receiving/storing webmentions               │
│  ├─ brid.gy              - POSSE syndication & backfeed                │
│  └─ aperture.p3k.io      - Microsub server (feed aggregation)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The GitHub Proxy

**Repository:** https://github.com/neumannjs/githubproxy

The GitHub Proxy is a set of Azure Functions that act as an intermediary between the browser-based Janos editor and GitHub's API. It exists because:

1. **OAuth Client Secret Protection**: GitHub OAuth requires a client secret that cannot be exposed in browser code
2. **IndieAuth Compliance**: Provides standard IndieAuth endpoints that micropub clients expect
3. **Dynamic Origin Validation**: Unlike static OAuth apps, validates origins dynamically based on user's repositories

### Functions Overview

#### 1. `/api/handler` - Legacy Editor Authentication

**Purpose:** Handles OAuth for the Janos browser-based editor.

**Flow:**
1. Browser initiates OAuth with GitHub via the proxy
2. Proxy exchanges code for access token (using secret)
3. Proxy fetches user info to determine allowed origins
4. If origin matches a user's GitHub Pages site with "janos" topic, returns token
5. If no matching repo exists, can create one from template repo

**Key Code (handler/index.js):**
```javascript
// Validates that the requesting origin is an allowed GitHub Pages site
allowedOrigins.push("https://" + username + ".github.io");
// Also adds org domains and custom domains from repo homepage settings
janosRepos.forEach((repo) => {
  allowedOrigins.push(repo.homepage);
});
```

#### 2. `/api/authorize/{user}/{repo}` - IndieAuth Authorization Endpoint

**Purpose:** Implements the [IndieAuth](https://indieauth.spec.indieweb.org/) authorization endpoint.

**Flow:**
1. Micropub client redirects user here with `state`, `redirect_uri`, `scope`
2. Proxy redirects to GitHub OAuth with encoded state
3. After GitHub auth, callback redirects back to client

**Key Features:**
- Ensures `repo` and `read:user` scopes are always requested
- Encodes original redirect_uri in state parameter for callback

#### 3. `/api/callback` - OAuth Callback Handler

**Purpose:** Receives GitHub OAuth callback and redirects to original client.

**Flow:**
1. Receives `code` and `state` from GitHub
2. Extracts original `redirect_uri` from state
3. Redirects to client with authorization code

#### 4. `/api/token/{user}/{repo}` - IndieAuth Token Endpoint

**Purpose:** Exchanges authorization codes for access tokens and verifies tokens.

**GET Request (Token Verification):**
- Validates JWT token
- Returns `me`, `scope`, `client_id`

**POST Request (Token Exchange):**
- Exchanges GitHub OAuth code for access token
- Fetches GitHub Pages URL to determine `me` value
- Creates JWT containing:
  - `me`: The user's website URL
  - `scope`: Micropub scopes (create, update, delete, media, etc.)
  - `access_token`: The actual GitHub token (encrypted in JWT)
  - `client_id`: The OAuth client ID

**Security Note:** The JWT is signed with the client secret, and the GitHub access token is embedded within. This means anyone with the JWT can act on behalf of the user.

#### 5. `/api/micropub/{user}/{repo}` - Micropub Endpoint

**Purpose:** Implements the [Micropub](https://micropub.spec.indieweb.org/) specification for creating posts.

**Supported Operations:**
- **Query `?q=config`**: Returns syndication targets, media endpoint, post types
- **Query `?q=syndicate-to`**: Returns available syndication targets (brid.gy)
- **Query `?q=post-types`**: Returns supported post types (note, bookmark, rsvp, photo, like, listen, reply, repost)
- **POST (create)**: Creates new posts

**Post Creation Flow:**
1. Validates access token (JWT)
2. Determines post type using [Post Type Discovery](https://indieweb.org/post-type-discovery)
3. Formats content using [format-microformat](https://www.npmjs.com/package/format-microformat)
4. If photos attached, uploads to GitHub
5. Renders HTML using Nunjucks (fetches templates from repo)
6. Publishes HTML to GitHub (for immediate availability)
7. If syndication targets specified, waits for GitHub Pages to deploy, then sends webmentions to brid.gy
8. Publishes markdown file (which will be properly rendered on next Metalsmith build)

**Syndication Targets (hardcoded):**
```javascript
const syndicationTargets = [
  { uid: 'https://brid.gy/publish/twitter?bridgy_omit_link=true', name: 'twitter' },
  { uid: 'https://brid.gy/publish/mastodon?bridgy_omit_link=true', name: 'mastodon' },
  { uid: 'https://brid.gy/publish/github?bridgy_omit_link=true', name: 'github.com/gijswijs' },
  { uid: 'https://brid.gy/publish/meetup?bridgy_omit_link=true', name: 'meetup.com' },
];
```

#### 6. `/api/micropubmedia/{user}/{repo}` - Media Endpoint

**Purpose:** Handles file uploads for micropub posts.

**Flow:**
1. Parses multipart form data
2. Uploads file to `stream/{year}/{month}/{day}/{filename}` in repo
3. Returns URL in `Location` header

---

## IndieWeb Standards Explained

### IndieAuth

[IndieAuth](https://indieauth.spec.indieweb.org/) is a decentralized authentication protocol built on OAuth 2.0. Key differences from standard OAuth:

- **User ID is a URL**: Your website URL is your identity
- **No client registration**: Client ID is also a URL
- **Discovery via link tags**: Authorization and token endpoints discovered from HTML

**Link tags in website:**
```html
<link rel="authorization_endpoint" href="https://janos-githubproxy.azurewebsites.net/api/authorize/gijswijs/gijswijs.github.io">
<link rel="token_endpoint" href="https://janos-githubproxy.azurewebsites.net/api/token/gijswijs/gijswijs.github.io">
```

### Micropub

[Micropub](https://micropub.spec.indieweb.org/) (W3C Recommendation) is an API for creating, editing, and deleting posts. Key features:

- Uses OAuth 2.0 bearer tokens for authentication
- Vocabulary derived from [Microformats2](https://microformats.io/)
- Supports form-encoded, multipart, and JSON payloads

**Link tag:**
```html
<link rel="micropub" href="https://janos-githubproxy.azurewebsites.net/api/micropub/gijswijs/gijswijs.github.io">
```

### Webmention

[Webmention](https://www.w3.org/TR/webmention/) (W3C Recommendation) enables cross-site conversations:

1. Alice writes a post linking to Bob's post
2. Alice's site sends a webmention to Bob's webmention endpoint
3. Bob's site verifies the link exists
4. Bob's site displays Alice's response

**Link tags:**
```html
<link rel="webmention" href="https://webmention.io/www.gijsvandam.nl/webmention">
<link rel="pingback" href="https://webmention.io/www.gijsvandam.nl/xmlrpc">
```

### Microsub

[Microsub](https://indieweb.org/Microsub-spec) (draft) separates feed reading into:
- **Server**: Manages subscriptions, fetches feeds, normalizes content
- **Client**: Displays content, handles user interactions

**Link tag:**
```html
<link rel="microsub" href="https://aperture.p3k.io/microsub/636">
```

---

## Current Website Setup

### Template Configuration (`_layouts/miksa/_layout.njk`)

```html
<head>
  <!-- Webmention endpoints (webmention.io) -->
  <link rel="webmention" href="https://webmention.io/www.gijsvandam.nl/webmention">
  <link rel="pingback" href="https://webmention.io/www.gijsvandam.nl/xmlrpc">

  <!-- IndieAuth (conditional on indie_auth metadata) -->
  {% if indie_auth %}
  <link rel="authorization_endpoint" href="https://janos-githubproxy.azurewebsites.net/api/authorize/gijswijs/gijswijs.github.io">
  <link rel="token_endpoint" href="https://janos-githubproxy.azurewebsites.net/api/token/gijswijs/gijswijs.github.io">
  {% endif %}

  <!-- Microsub (Aperture) -->
  <link rel="microsub" href="https://aperture.p3k.io/microsub/636">

  <!-- Micropub -->
  <link rel="micropub" href="https://janos-githubproxy.azurewebsites.net/api/micropub/gijswijs/gijswijs.github.io">
</head>
```

### Metalsmith Configuration (`metalsmith.json`)

```json
{
  "metadata": {
    "indie_auth": true,
    // ... other metadata
  },
  "plugins": [
    // ... other plugins
    { "metalsmith-webmentions": {} },
    // ... other plugins
  ]
}
```

### Webmentions Plugin (`metalsmith-webmentions.js`)

The plugin:
1. For each content file, fetches webmentions from webmention.io
2. Caches results in `cache/{path}/webmentions.json`
3. Merges new webmentions with cached ones
4. Adds counts for replies, likes, reposts to file metadata

---

## External Services Used

### 1. webmention.io

**What it does:**
- Receives webmentions on your behalf
- Stores them in a database
- Provides API to retrieve mentions

**API:** `https://webmention.io/api/mentions.jf2?target={url}`

**Why needed:** Static sites can't receive HTTP POST requests.

### 2. brid.gy (Bridgy)

**What it does:**
- **POSSE**: Publishes your posts to Twitter, Mastodon, GitHub, etc.
- **Backfeed**: Sends webmentions to your site for interactions on those platforms

**How it works:**
1. You send a webmention to `https://brid.gy/publish/{service}`
2. Bridgy creates a post on that service
3. When someone likes/replies on that service, Bridgy sends a webmention to you

**Note:** Twitter/X support was removed when the API was restricted. Mastodon and Bluesky support continues.

### 3. Bridgy Fed

**What it does:**
- Bridges your IndieWeb site to the Fediverse (ActivityPub) and Bluesky (AT Protocol)
- Unlike Bridgy classic, it **federates** rather than syndicates
- Your posts appear as coming from your domain, not a copy

**Recent developments (2024-2025):**
- Now a nonprofit organization (A New Social)
- Bluesky bridge launched June 2024
- Growing adoption in IndieWeb community

### 4. aperture.p3k.io (Aperture)

**What it does:**
- Microsub server that aggregates feeds you follow
- Provides normalized JF2 feed data to microsub clients

**Clients:** Monocle, Indigenous, Together

---

## The Social Web Landscape (2025)

### Protocol Comparison

| Feature | Webmention | ActivityPub | AT Protocol |
|---------|------------|-------------|-------------|
| Standard | W3C Rec (2017) | W3C Rec (2018) | IETF draft (2025) |
| Architecture | Peer-to-peer | Federated servers | Federated + portable |
| Identity | URLs | @user@server | @handle.domain |
| Data ownership | Full | Server-dependent | Full (PDS) |
| Adoption | IndieWeb sites | Mastodon, Threads* | Bluesky, Skylight |
| Static site support | Yes | Via bridge | Via bridge |

### Current State

**ActivityPub (Fediverse):**
- Mastodon: ~10M+ users
- Threads: Limited federation support (2024)
- Growing but fragmented ecosystem

**AT Protocol (Bluesky):**
- 36.5M+ users (2025)
- Rapidly growing app ecosystem
- Strong focus on user data portability

**IndieWeb:**
- Mature standards but niche adoption
- WordPress plugins exist but underutilized
- Bridgy Fed enables participation in both worlds

### The Bridge Dilemma

The 2025 IndieWebCamp Berlin discussion raised a key concern:

> "Why rely on an external service to bridge the Fediverse gap? Feels very centralized."

This is a valid concern. Bridgy Fed is centralized infrastructure that could:
- Go offline
- Change policies
- Become a single point of failure

However, the alternatives are:
1. Run your own ActivityPub server (complex, requires always-on server)
2. Accept limited reach (only other IndieWeb sites)
3. Use multiple bridges (redundancy but complexity)

---

## Design Decisions (January 2025)

Based on project requirements, the following decisions have been made:

1. **Micropub: Not needed** - The Janos editor will provide native UI for posting notes and smaller content types, eliminating the need for external micropub clients.

2. **Syndication: Removed** - No POSSE to Twitter, Mastodon, GitHub, or other platforms. If users want their content elsewhere, they can share links manually or use RSS.

3. **GitHub Proxy: Migrate to Cloudflare Workers** - Users should be able to deploy their own proxy, with documentation provided.

4. **Webmentions: Keep for now** - Displaying incoming webmentions adds value. Receiving them requires an external service (webmention.io or self-hosted).

---

## Simplified Architecture (Target State)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER'S WEBSITE                               │
│                                                                         │
│  HTML <head> contains:                                                  │
│  ├─ rel="webmention"          → webmention.io (or self-hosted)         │
│  └─ rel="authorization_endpoint" → Optional, for IndieAuth login       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER                               │
│                                                                         │
│  Default: janos-auth.workers.dev (hosted for all users)                │
│  Optional: User can deploy their own for full control                  │
│                                                                         │
│  Endpoints:                                                             │
│  ├─ /authorize/{user}/{repo}  - GitHub OAuth redirect                 │
│  ├─ /callback                 - OAuth callback, returns token          │
│  └─ /token/{user}/{repo}      - Token verification (IndieAuth)        │
│                                                                         │
│  Removed from Azure version:                                           │
│  ├─ /micropub     - Not needed (editor handles posting)                │
│  ├─ /micropubmedia - Not needed                                        │
│  └─ /handler      - Legacy, replaced by simpler flow                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Hosting Model:**
- **Default**: Janos project hosts a Cloudflare Worker at `janos-auth.workers.dev`
- **Self-hosted option**: Technical users can deploy their own worker for full control
- Non-technical users don't need to deploy anything

**Key simplifications:**
- No micropub = no need to format posts server-side
- No syndication = no webmention sending to brid.gy
- Editor posts directly to GitHub via isomorphic-git (already implemented in @janos/core)
- Cloudflare Worker only handles OAuth token exchange

---

## Roadmap: Self-Contained Alternatives

Given the design decisions above, here's the focused implementation path:

### Phase 1: Cloudflare Worker for OAuth (Priority: High)

**Goal:** Replace Azure Functions with Cloudflare Worker

**Hosting Model:**
- **Default**: Janos project hosts `janos-auth.workers.dev` for all users
- **Self-hosted**: Technical users can deploy their own worker
- Editor defaults to the hosted worker; can be configured to use custom URL

**Worker Structure:**
```
packages/auth-worker/
├── src/
│   ├── index.ts          # Router
│   ├── handlers/
│   │   ├── authorize.ts  # Redirect to GitHub OAuth
│   │   ├── callback.ts   # Exchange code for token
│   │   └── token.ts      # Token verification (IndieAuth)
│   └── utils/
│       └── github.ts     # GitHub API helpers
├── wrangler.toml         # Cloudflare config
└── README.md             # Self-hosting instructions
```

**Two Use Cases, Same Endpoints:**

The worker serves both the Janos editor AND (optionally) third-party IndieAuth clients:

| Endpoint | Editor Auth | IndieAuth Provider |
|----------|-------------|-------------------|
| `/authorize/{user}/{repo}` | ✓ Redirects to GitHub | ✓ Same |
| `/callback` | ✓ Returns token to editor | ✓ Same |
| `/token/{user}/{repo}` | Not used | ✓ Token verification |

The worker always has all endpoints. The difference is whether the user's website *advertises* them:

- **Editor-only** (default): No `<link rel="authorization_endpoint">` in HTML. Third-party tools can't discover the endpoints. Editor works because it knows the worker URL from configuration.

- **IndieAuth enabled**: User adds link tags to template. Third-party IndieWeb tools (Quill, Indigenous, etc.) can discover and use the endpoints to authenticate with the user's domain as identity.

This means IndieAuth support is "free" - no extra code needed. Users just choose whether to advertise it.

**Simplified Flow:**
```
1. Editor redirects to: /authorize/{user}/{repo}?redirect_uri=https://user.github.io/admin
2. Worker redirects to GitHub OAuth with state
3. GitHub redirects to: /callback?code=xxx&state=yyy
4. Worker exchanges code for token (using secret)
5. Worker redirects to: redirect_uri?token=xxx
6. Editor stores token, uses it with isomorphic-git
```

**Environment Variables (for self-hosting):**
```toml
# wrangler.toml
[vars]
GITHUB_CLIENT_ID = "your_client_id"

# Set via `wrangler secret put`
# GITHUB_CLIENT_SECRET = "your_client_secret"
```

**Key Differences from Current Azure Functions:**
- No JWT wrapping (editor gets raw GitHub token)
- No micropub (editor handles posting via isomorphic-git)
- No syndication logic
- Simpler origin validation

**Documentation Required:**
1. Self-hosting guide: Create GitHub OAuth App + deploy worker
2. How to configure the editor to use custom worker URL

### Phase 2: Editor UI for Notes/Feed Items (Priority: High)

**Goal:** Native support for posting shorter content types

**Post Types to Support:**
- **Note**: Short text (like a tweet)
- **Photo**: Image with optional caption
- **Bookmark**: Link with title and optional comment
- **Reply**: Response to another URL (includes in-reply-to)

**UI Approach:**
- Add "Quick Post" or "New Note" button in editor
- Simple form: text area, optional image upload, tags
- Generates markdown file with appropriate frontmatter
- Commits via isomorphic-git (no server needed)

**Example Generated File:**
```markdown
---
date: 2025-01-31T14:30:00+01:00
collection: note
tags: indieweb, thoughts
---

Just realized that owning your data doesn't mean much if you can't
easily move it. Portability > ownership.
```

### Phase 3: Webmentions (Priority: High)

Webmentions are a **core feature** of Janos, enabling distributed conversations across the web.

**Components:**

1. **Receiving endpoint** (external service)
   - Default: webmention.io
   - Configurable: users can use any service with compatible API
   - Future: self-hosted option (Cloudflare Worker + D1)

2. **Build-time fetching** (`@janos/core` webmentions plugin)
   - Already implemented in `packages/core/src/pipeline/plugins/webmentions.ts`
   - Fetches from configurable API endpoint
   - Caches results to avoid repeated API calls
   - Adds `webmentions` object to file metadata with counts

3. **Template display** (Nunjucks components)
   - Current: `_webmentions.njk`, `_likes.njk`, `_replies.njk`, `_reposts.njk`
   - Need: Design improvements for better visual presentation

**Plugin Configuration:**

```json
{
  "webmentions": {
    "endpoint": "https://webmention.io/api",
    "domain": "www.gijsvandam.nl",
    "cacheDir": "cache",
    "perPage": 10000
  }
}
```

**Template Data Structure:**

```javascript
file.metadata.webmentions = {
  lastWmId: 12345,
  children: [
    {
      'wm-id': 12345,
      'wm-property': 'in-reply-to' | 'like-of' | 'repost-of' | 'mention-of',
      'wm-source': 'https://example.com/post',
      'wm-target': 'https://yoursite.com/article',
      author: { name, photo, url },
      content: { text, html },
      published: '2025-01-31T12:00:00Z',
      url: 'https://example.com/post'
    }
  ],
  'reply-count': 5,
  'like-count': 10,
  'repost-count': 2
}
```

**Tasks:**
1. Make API endpoint configurable (not hardcoded to webmention.io)
2. Update plugin to use site.baseUrl from config
3. Improve template design for displaying webmentions
4. Add fallback for when webmention service is unavailable

**Future Self-Hosted Option:**

If webmention.io becomes unavailable or users want full control:

1. **Cloudflare Worker + D1 Database**
   ```
   POST /webmention → Validate source, store in D1
   GET /mentions?target=url → Return stored mentions (JF2 format)
   ```
   - Serverless, scales to zero
   - D1 has free tier (5GB)
   - Could be bundled with auth worker

2. **go-jamming on Fly.io**
   - Proven solution, drop-in replacement
   - ~$5/month for always-on
   - Source: https://github.com/wgroeneveld/go-jamming

### Phase 4: Remove Unused IndieWeb Features (Priority: Medium)

**Remove from templates:**
```html
<!-- Remove these link elements -->
<link rel="micropub" href="...">        <!-- Not using micropub clients -->
<link rel="microsub" href="...">        <!-- Not using microsub readers -->
<link rel="pingback" href="...">        <!-- Legacy, webmention sufficient -->

<!-- Keep these -->
<link rel="webmention" href="...">      <!-- Still receiving mentions -->

<!-- Optional (only if supporting IndieAuth login for other tools) -->
<link rel="authorization_endpoint" href="...">
<link rel="token_endpoint" href="...">
```

**Remove from GitHub Proxy / don't port to Cloudflare:**
- Micropub endpoint
- Micropub media endpoint
- Syndication target configuration
- Webmention sending to brid.gy

### Phase 5: Optional IndieAuth Support (Priority: Low)

**Question:** Do you want your site to be an IndieAuth provider?

This would allow:
- Signing into other IndieWeb tools with your domain
- Using your site as identity verification

**If yes:** Add token endpoint to Cloudflare Worker
**If no:** Remove authorization_endpoint and token_endpoint link tags

Most users won't need this since the Janos editor uses GitHub OAuth directly.

---

## Implementation Plan

### Stage 3A: Cloudflare Worker for OAuth

**Tasks:**
1. Create `packages/auth-worker` in monorepo
2. Implement `/authorize/{user}/{repo}`, `/callback`, and `/token/{user}/{repo}` endpoints
3. Deploy to `janos-auth.workers.dev` (default hosted instance)
4. Write self-hosting documentation for technical users
5. Update `@janos/web` to support configurable auth worker URL (defaults to hosted)
6. Test end-to-end auth flow

**Deliverables:**
- Working Cloudflare Worker deployed at `janos-auth.workers.dev`
- `docs/SELF_HOSTING_AUTH.md` for users who want their own worker
- Editor configuration option for custom worker URL

### Stage 3B: Editor Quick Post UI

**Tasks:**
1. Design "Quick Post" component for notes, photos, bookmarks
2. Implement post type selection and form
3. Generate appropriate frontmatter based on post type
4. Commit via existing isomorphic-git integration
5. Add to collection routing in build pipeline

**Deliverables:**
- QuickPost Vue component
- Post type templates
- Updated metalsmith.json examples

### Stage 3C: Webmentions

**Tasks:**
1. Make webmention API endpoint configurable (currently hardcoded to webmention.io)
2. Update plugin to derive target URLs from `site.baseUrl` config
3. Improve template design for displaying webmentions
4. Add graceful fallback when webmention service is unavailable
5. Document webmention configuration

**Deliverables:**
- Updated `webmentions.ts` plugin with configurable endpoint
- Improved Nunjucks templates for likes/replies/reposts display
- Configuration documentation

**Current Template Structure (to improve):**
```
_layouts/miksa/components/micropub/
├── _webmentions.njk   # Summary counts (reposts, likes, replies)
├── _likes.njk         # Avatar grid of people who liked
├── _replies.njk       # Comment-style replies with content
└── _reposts.njk       # People who reposted
```

### Stage 3D: Template Cleanup

**Tasks:**
1. Remove unused link elements (`rel="micropub"`, `rel="microsub"`, `rel="pingback"`)
2. Keep `rel="webmention"` with configurable endpoint
3. Make IndieAuth endpoints optional (only if explicitly enabled)
4. Update documentation

**Deliverables:**
- Cleaned up `_layout.njk` templates
- Configuration options in `janos.config.json`

---

## Configuration Reference

### Minimal IndieWeb Setup (Recommended)

```json
{
  "site": {
    "baseUrl": "https://yourdomain.com"
  },
  "metadata": {
    "indieweb": {
      "webmention": {
        "endpoint": "https://webmention.io/yourdomain.com/webmention",
        "api": "https://webmention.io/api"
      }
    }
  },
  "pipeline": [
    {
      "webmentions": {
        "endpoint": "https://webmention.io/api",
        "cacheDir": "cache"
      }
    }
  ]
}
```

Template output:
```html
<link rel="webmention" href="https://webmention.io/yourdomain.com/webmention">
```

### Full IndieWeb Setup (Optional)

```json
{
  "site": {
    "baseUrl": "https://yourdomain.com"
  },
  "metadata": {
    "indieweb": {
      "webmention": {
        "endpoint": "https://webmention.io/yourdomain.com/webmention",
        "api": "https://webmention.io/api"
      },
      "indieauth": {
        "enabled": true,
        "authorization_endpoint": "https://janos-auth.workers.dev/authorize/user/repo",
        "token_endpoint": "https://janos-auth.workers.dev/token/user/repo"
      }
    }
  },
  "pipeline": [
    {
      "webmentions": {
        "endpoint": "https://webmention.io/api",
        "cacheDir": "cache"
      }
    }
  ]
}
```

Template output:
```html
<link rel="webmention" href="https://webmention.io/yourdomain.com/webmention">
<link rel="authorization_endpoint" href="https://janos-auth.workers.dev/authorize/user/repo">
<link rel="token_endpoint" href="https://janos-auth.workers.dev/token/user/repo">
```

### No IndieWeb (Static Site Only)

```json
{
  "metadata": {
    "indieweb": {
      "enabled": false
    }
  }
}
```

No IndieWeb link elements in output. Webmentions plugin not included in pipeline.

---

## Open Questions

1. **Webmention sending:** Should Janos send webmentions when you link to other sites? This would notify them of your link. Requires build-time HTTP requests.

2. **h-card/h-entry markup:** The current templates include microformats2 markup. Should this be configurable or always included?

3. **RSS enhancements:** Should the RSS feed include more IndieWeb-friendly markup (e.g., `<source>` for replies)?

4. **Webmention display:** How should webmentions be displayed? Current plugin fetches at build time. Should there be a client-side option for fresher data?

---

## References

### Specifications
- [IndieAuth](https://indieauth.spec.indieweb.org/) - Decentralized authentication
- [Micropub](https://micropub.spec.indieweb.org/) - Publishing API (W3C Rec)
- [Webmention](https://www.w3.org/TR/webmention/) - Cross-site notifications (W3C Rec)
- [Microsub](https://indieweb.org/Microsub-spec) - Feed reading API (draft)

### Services
- [webmention.io](https://webmention.io/) - Hosted webmention receiver
- [Bridgy](https://brid.gy/about) - POSSE and backfeed service
- [Bridgy Fed](https://fed.brid.gy/docs) - ActivityPub/AT Protocol bridge
- [Aperture](https://aperture.p3k.io/) - Microsub server

### Self-Hosted Alternatives
- [go-jamming](https://github.com/wgroeneveld/go-jamming) - Webmention server in Go
- [webmention.io source](https://github.com/aaronpk/webmention.io) - Self-host the original
- [Ekster](https://github.com/pstuifzand/ekster) - Microsub server in Go

### Background Reading
- [IndieWeb wiki](https://indieweb.org/)
- [ActivityPub on IndieWeb](https://indieweb.org/ActivityPub)
- [POSSE](https://indieweb.org/POSSE) - Publish Own Site, Syndicate Elsewhere
- [Backfeed](https://indieweb.org/backfeed) - Reverse syndication
