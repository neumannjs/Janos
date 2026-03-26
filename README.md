# Janos

A static site generator that runs entirely in the browser. Clone a GitHub repository, edit content, build your site, and push changes — all without installing anything locally.

This is the source code repository for Janos itself. If you're looking to build a website with Janos, visit [neumannjs.github.io/Janos-starter/](https://neumannjs.github.io/Janos-starter/).

Janos is currently undergoing a major rewrite, transitioning from Nuxt.js 2 + Metalsmith to Vue 3 + Vite with a shared TypeScript core. The application is not in a working state — expect broken features and incomplete functionality.

Janos uses a pnpm monorepo with three packages:

- **`@janos/core`** — Shared TypeScript core: filesystem abstraction (ZenFS/IndexedDB), git operations (isomorphic-git), GitHub OAuth, content pipeline, and Nunjucks templates.
- **`@janos/web`** — Browser app built with Vue 3 + Vite + Pinia. Provides a VS Code-style editor with file explorer, git source control, and build integration.
- **`@janos/cli`** — Command-line interface for building sites outside the browser.

## Getting Started

```bash
pnpm install
pnpm --filter @janos/web dev
```

This starts the Vite dev server at `http://localhost:5173`. Sign in with GitHub, clone a repository, and start editing.

## Building a Site from the CLI

The pipeline can build a site from a `janos.config.json` configuration file:

```bash
npx tsx packages/core/src/pipeline/build-from-config.ts <config-file> <site-root> <output-dir>
```

For example, to build the [gijsvandam.nl](https://www.gijsvandam.nl) site:

```bash
git clone https://github.com/gijswijs/gijswijs.github.io /tmp/site
npx tsx packages/core/src/pipeline/build-from-config.ts \
  packages/core/src/pipeline/examples/gijsvandam.config.json \
  /tmp/site \
  /tmp/output
```

The config file defines site metadata, template directories, and the plugin pipeline. See the [JSON schema](packages/core/src/pipeline/schemas/janos.config.schema.json) for the full specification, or the [example config](packages/core/src/pipeline/examples/gijsvandam.config.json) for a working reference.

### Pipeline Plugins

The pipeline processes files through a configurable sequence of plugins:

| Plugin        | Description                                         |
| ------------- | --------------------------------------------------- |
| `markdown`    | Converts Markdown to HTML                           |
| `publish`     | Filters drafts and future-dated content             |
| `tags`        | Extracts and indexes tags from front matter         |
| `excerpts`    | Generates content excerpts from a marker            |
| `collections` | Groups files into named collections by glob pattern |
| `pagination`  | Generates paginated index pages                     |
| `tag-pages`   | Generates per-tag listing pages                     |
| `permalinks`  | Rewrites output paths using URL patterns            |
| `webmentions` | Processes incoming/outgoing webmentions             |
| `layouts`     | Applies Nunjucks templates                          |
| `rss`         | Generates RSS/Atom feeds                            |
| `sitemap`     | Generates sitemap.xml                               |
| `assets`      | Copies static assets to the output                  |

## Environment Variables

The web app requires two environment variables for GitHub OAuth:

- `VITE_GITHUB_CLIENT_ID` — GitHub OAuth app client ID
- `VITE_OAUTH_PROXY_URL` — Token exchange proxy URL (needed for CORS)

## License

See [LICENSE](LICENSE) for details.
