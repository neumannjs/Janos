# Janos TODO

## Architecture: Embedded App Model

Janos follows a **fully self-contained, self-owned** architecture. Each Janos site is a complete, independent unit:

```
my-site-repo/
├── _janos/                # Embedded editor app (Vue/Vite bundle)
│   ├── index.html
│   ├── assets/
│   └── version.json       # Tracks embedded version
├── _src/                  # Markdown content
├── _layouts/              # Templates (Nunjucks/Handlebars)
├── janos.config.json      # Site configuration
└── [generated site files] # Built static site in repo root
```

### Distribution Mechanisms

1. **Self-replication (primary)**: Any Janos site can have a "Start your own site" link. Clicking it forks a starter repo (`Janos-starter`) to the user's GitHub account. No CLI or technical knowledge required.

2. **Self-update**: The embedded editor can check for updates, download new versions, and commit the updated `_janos/` folder to its own repo.

3. **CLI (developer option)**: `npx @janos/cli init|update|build` for those who prefer command line or need CI/CD automation.

### Core Principle

> **You own everything.** No external hosted services required (beyond GitHub/GitLab for git hosting). Once you have a Janos site, it's fully independent and self-sustaining.

---

## Configuration Architecture

### Canonical Format: JSON (`janos.config.json`)

All configuration compiles to a single JSON format:

```json
{
  "site": {
    "title": "My Site",
    "baseUrl": "https://example.com",
    "sourceDir": "_src",
    "layoutsDir": "_layouts"
  },
  "metadata": {
    "author": "John Doe"
  },
  "pipeline": [
    "markdown",
    { "excerpts": { "marker": "<!-- more -->" } },
    { "collections": { "posts": { "pattern": "_src/posts/**/*.html", "sortBy": "date" } } },
    { "permalinks": { "linksets": [...] } },
    { "layouts": { "default": "post.njk" } }
  ]
}
```

### User Interfaces by Audience

| Audience | Interface | Notes |
|----------|-----------|-------|
| Web editor users | GUI form | Never see JSON; form fields map to config |
| Local non-developers | JSON + Schema | Editors provide autocomplete via JSON Schema |
| Developers (CLI) | JS/TS optional | Can extend JSON or write full programmatic config |

### JSON Schema

- Provides validation in editors and at build time
- Enables autocomplete for plugin names and options
- Documentation embedded in schema
- Published at stable URL for `$schema` reference

### Plugin Coordination (Hybrid Approach)

**Problem**: Plugins like `collections` capture file paths early, but `permalinks` changes paths later. References become stale.

**Solution**: Pipeline-level coordination with two sources of rules:

1. **Built-in rules**: Pipeline has hardcoded knowledge for common plugin pairs (collections ↔ permalinks ↔ sitemap ↔ RSS). Users don't configure this.

2. **Plugin metadata**: Custom/niche plugins declare `affects` and `watches` topics. Pipeline automatically coordinates them.

**Lifecycle**: Niche plugins start with declared metadata. When widely adopted, their rules get promoted to built-in. Both use the same coordination mechanism.

**User experience**: Users just list plugins in order. Coordination is invisible—it just works.

---

## Phase 1: Foundation ✓

- [x] Move legacy Nuxt 2 codebase to `_legacy/`
- [x] Set up pnpm monorepo structure
- [x] **@janos/core package** - Platform-agnostic TypeScript abstractions:
  - [x] `IFileSystem` interface with `MemoryFileSystem` and `ZenFSFileSystem` (IndexedDB) implementations
  - [x] `IGitProvider` interface with `IsomorphicGitProvider` (pure JS git)
  - [x] `IAuthProvider` interface with `GitHubAuthProvider` (OAuth)
  - [x] `IPipeline` interface with frontmatter parsing utilities
  - [x] 79 tests for filesystem and frontmatter modules
- [x] **@janos/web package** - Vue 3 + Vite browser application:
  - [x] Pinia stores wrapping core abstractions (auth, filesystem, git)
  - [x] Views: Home (landing), Editor (file tree + editor), AuthCallback
  - [x] Dark theme styling
  - [x] Production build ~195KB gzipped
- [x] **@janos/cli package** - Scaffold for command-line interface

---

## Phase 2: Content Pipeline

- [x] Implement Unified.js-based markdown processor (remark/rehype)
- [x] Port metalsmith-webmentions plugin
- [x] Port metalsmith-responsive-images plugin (using jSquash WebAssembly codecs)
- [x] Port metalsmith-css-change-url plugin
- [x] Port metalsmith-inline-source plugin
- [x] Template engine integrations (Nunjucks, Handlebars)
- [x] Markdown plugin for pipeline
- [x] Permalinks plugin for clean URLs (with linksets for collection-specific patterns)
- [x] Layouts plugin for template rendering
- [x] Integration tests with actual site build
- [x] Test pipeline with existing Janos templates (Miksa - partial, see gaps below)
- [x] Assets plugin for static file copying
- [x] ~~Fix inline-source plugin regex~~ - Not needed; inline-source was only for editor preview. Will use Service Worker approach instead (see Phase 4)

### Feature Gaps (for full Miksa/gijsvandam.nl support)

**Template Engine Enhancements:**
- [x] Nunjucks `{% extends %}` with virtual filesystem loader
- [x] Nunjucks `{% include %}` with virtual filesystem loader
- [x] `{% asyncEach %}` support (native Nunjucks, already works with our async render API)
- [x] Date formatting filters (`| date("YYYY")`) - basic implementation exists
- [x] Date filter: `MMMM` format (month names like "January")
- [x] Reading time filter (`| readingTime` or `| reading_time`)
- [x] Slug filter (`| slug`)
- [x] Tags transformation: `tags` plugin converts strings to `{name, slug}` objects

**Additional Plugins Needed:**
- [x] `collections` - group files by pattern/metadata
- [x] `pagination` - paginate collections
- [x] `excerpts` - extract post excerpts (<!-- more -->)
- [x] `tags` - transform tag strings to structured objects
- [x] `tag-pages` - generate tag/topic pages from metadata
- [x] `publish` - filter drafts/private/future posts
- [x] `rss` - generate RSS/Atom feed
- [x] `sitemap` - generate sitemap.xml

**Notes:**
- `css-change-url` plugin is for GitHub Pages subfolder deployments (e.g., `user.github.io/repo/`). Not needed for root domain sites like gijsvandam.nl.

**Configuration & Pipeline Infrastructure:**
- [x] JSON config loader: Parse `janos.config.json` and instantiate pipeline
- [x] JSON Schema: Comprehensive schema for editor autocomplete/validation
- [x] Plugin coordination system: Built-in rules for permalinks → collections sync
- [x] Config-driven build: `build-from-config.ts` + example `gijsvandam.config.json`

---

## Phase 3: Authentication & IndieWeb

See [docs/INDIEWEB_ARCHITECTURE.md](./docs/INDIEWEB_ARCHITECTURE.md) for detailed architecture documentation.

### 3A: Cloudflare Worker for OAuth (Priority: High)

Replace Azure Functions with Cloudflare Worker:

- [x] Create `packages/auth-worker` in monorepo
- [x] Implement `/authorize/{user}/{repo}` endpoint (redirect to GitHub OAuth)
- [x] Implement `/callback` endpoint (exchange code for token)
- [x] Implement `/token/{user}/{repo}` endpoint (token verification for IndieAuth)
- [x] Deploy to `janos-auth.workers.dev` (default hosted instance)
- [x] Write self-hosting documentation (`SELF_HOSTING_AUTH.md`)
- [x] Update `@janos/web` to support configurable auth worker URL
- [x] Test end-to-end auth flow

**Hosting model:**
- **Default**: Janos project hosts `janos-auth.workers.dev` for all users
- **Self-hosted option**: Technical users can deploy their own worker for full control
- Non-technical users don't need to deploy anything

**Design decisions:**
- No micropub (editor handles posting directly via isomorphic-git)
- No syndication targets (removed Twitter/Mastodon/GitHub syndication)
- Simplified flow: Worker only does OAuth token exchange

### 3B: Webmentions (Priority: High) ✓

Webmentions are a core feature - update plugin and templates:

- [x] Make webmention API endpoint configurable (not hardcoded to webmention.io)
- [x] Update plugin to use `site.baseUrl` from config for target URLs
- [x] Add `endpoint` option to webmentions plugin config
- [x] Add graceful fallback when webmention service is unavailable
- [x] Improve webmention display templates:
  - [x] Better visual design for likes (avatar grid)
  - [x] Better visual design for replies (threaded comments style)
  - [x] Better visual design for reposts
  - [x] Responsive layout for mobile
- [x] Add webmention count display in post metadata
- [x] Document webmention configuration (see `docs/WEBMENTIONS.md`)

### 3C: IndieAuth (Priority: High) ✓

Required for webmention.io integration:

- [x] IndieAuth token endpoint (allows site to act as identity provider)
  - Callback passes through GitHub authorization code to client
  - Token endpoint exchanges code with GitHub and returns `me` URL
  - Template updated to point to janos-auth.workers.dev

---

## Phase 4: Editor UI with Naive UI

VS Code-inspired editor interface using Naive UI and CodeMirror 6.

### Target Layout

```
┌──┬─────────────┬───────────────────────────────────┬──────────────┐
│  │ EXPLORER    │ [file1.md | file2.njk | ...]      │ [Profile ▼]  │
│📁│ ▼ Repository├───────────────────────────────────┴──────────────┤
│🔧│   _src/     │                                                  │
│🧩│   _layouts/ │              Main Editor Area                    │
│🎨│   ...       │               (CodeMirror 6)                     │
│🌿│             │                                                  │
├──┴─────────────┴──────────────────────────────────────────────────┤
│ [Git: idle] [Build: idle]                        [Notifications]  │
└───────────────────────────────────────────────────────────────────┘
```

**Activities:** Explorer, Build, Plugins (stub), Themes (stub), Git

### 4A: Setup & Layout Shell ✓

- [x] Add Naive UI + CodeMirror dependencies to `@janos/web`
- [x] Configure Naive UI theme mapping to existing CSS variables
- [x] Create `styles/naive-overrides.css` for component tweaks
- [x] Create layout components:
  - [x] `EditorLayout.vue` - CSS Grid main shell
  - [x] `ActivityBar.vue` - Left icon strip (48px)
  - [x] `SidePanel.vue` - Collapsible panel (250px)
  - [x] `TabBar.vue` - Editor tabs + profile button
  - [x] `StatusBar.vue` - Bottom status bar

### 4B: Pinia Stores ✓

- [x] `stores/ui.ts` - Panel state, responsive breakpoints
- [x] `stores/editor.ts` - Tabs, active file, dirty state
- [x] `stores/notifications.ts` - Notification queue with auto-dismiss
- [x] `stores/build.ts` - Pipeline status, progress, logs

### 4C: Explorer Panel ✓

- [x] `ExplorerPanel.vue` with NTree
- [x] File CRUD (new, rename, delete) - basic implementation
- [x] Context menu with NDropdown
- [x] Connect to filesystem store

### 4D: Code Editor ✓

- [x] `CodeEditor.vue` - CodeMirror 6 wrapper with syntax highlighting
- [x] `EditorPane.vue` - Tabs + editor container
- [x] `WelcomePane.vue` - Empty state
- [x] Language detection by file extension
- [x] Dirty state tracking
- [x] Keyboard shortcuts (Cmd+S save, Cmd+W close tab)

### 4E: Image Upload & Paste

- [ ] `useImageProcessor.ts` composable (wraps @janos/core ImageProcessor)
- [ ] `ImageUploadDialog.vue` with drag-drop, multi-file, progress
- [ ] Paste handler in CodeMirror (detect image paste, prompt filename, insert markdown)

### 4F: Git Panel ✓

- [x] `GitPanel.vue` with visual staging (click to stage/unstage)
- [x] Commit form with validation
- [x] Branch selector with unsaved changes check
- [x] Connect to git store

### 4G: Build Panel (Partial)

- [x] `BuildPanel.vue` with progress bar + log output
- [ ] Integrate with @janos/core pipeline events
- [ ] Service Worker for preview (`preview-sw.ts`)
- [ ] `MarkdownPreview.vue` with iframe to `/preview/`

### 4H: Dialogs & Composables ✓

- [x] `ConfirmDialog.vue`, `InputDialog.vue`, `CommitDialog.vue`
- [x] `useDialog.ts` - Promise-based dialog API
- [x] `useNotifications.ts` - Toast notifications
- [x] `useKeyboardShortcuts.ts` - Global shortcuts

### 4I: Stub Panels (for Phase 7) ✓

- [x] `PluginsPanel.vue` - Placeholder for pipeline plugin management
- [x] `ThemesPanel.vue` - Placeholder for site theme/template management

### 4J: Integration & Polish (Partial)

- [x] Refactor `EditorView.vue` to use new layout
- [x] Update `App.vue` with Naive UI providers
- [x] Mobile responsive adjustments (icons-only activity bar)
- [ ] Keyboard navigation (advanced)

### Quick Post UI

Native support for posting shorter content types:

- [ ] Design "Quick Post" component for notes, photos, bookmarks, replies
- [ ] Implement post type selection form
- [ ] Generate appropriate frontmatter based on post type
- [ ] Commit via existing isomorphic-git integration
- [ ] Add collection routing for new post types in pipeline

---

## Phase 5: Embeddable Build & Distribution

- [ ] **Vite embeddable build config**: Relative base paths, bundle all deps including WASM
- [ ] **Starter repo** (`Janos-starter`): Template repo with embedded editor, sample content, default templates
- [ ] **Self-replication UI**: "Start your own site" component that triggers GitHub fork
- [ ] **Self-update mechanism**: Editor checks for updates, downloads new `_janos/` bundle, commits to repo
- [ ] **Version tracking**: `_janos/version.json` tracks embedded version, enables update checks
- [ ] **Breaking change migrations**: Automated migration tools when config format or folder structure changes

---

## Phase 6: CLI (Developer Tools)

Optional command-line interface for developers and CI/CD:

- [ ] `janos init` - Scaffold new site locally
- [ ] `janos build` - Build site (for CI/CD or local preview)
- [ ] `janos serve` - Local development server
- [ ] `janos update` - Update embedded editor
- [ ] GitHub Action for automated builds
- [ ] Node.js image processing with Sharp (for CLI/server where jSquash WASM isn't available)

---

## Phase 7: Polish & Extensions

- [ ] PWA/offline support
- [ ] Documentation site (built with Janos, of course)

### 7A: Site Theming System

Full implementation of site themes/templates (replacing Phase 4 stub):

- [ ] `ThemesPanel.vue` - Theme browsing and selection UI
- [ ] Theme registry (curated list of starter themes like Miksa)
- [ ] Theme preview (screenshot + live preview in iframe)
- [ ] Theme installation (copy template files to `_layouts/`)
- [ ] Theme switching with file diff/merge UI
- [ ] Theme customization (colors, fonts via `janos.config.json`)
- [ ] Custom theme import (from GitHub repo URL)
- [ ] Theme version tracking and updates

### 7B: Plugin Management

Full implementation of plugin management (replacing Phase 4 stub):

- [ ] `PluginsPanel.vue` - Plugin management UI
- [ ] Plugin registry (curated list of available plugins)
- [ ] Enable/disable plugins per site
- [ ] Plugin configuration UI (JSON Schema-driven forms)
- [ ] Plugin order visualization (drag-drop reordering)
- [ ] Plugin dependency resolution
- [ ] Custom plugin support (load from URL/npm)

### Template Cleanup

Remove unused IndieWeb features:

- [ ] Remove `rel="micropub"` link element (not using micropub clients)
- [ ] Remove `rel="microsub"` link element (not using microsub readers)
- [ ] Remove `rel="pingback"` link element (legacy, webmention sufficient)
- [ ] Keep `rel="webmention"` with configurable endpoint
- [ ] Make IndieAuth endpoints optional (only if user wants IndieAuth login)
- [ ] Update default templates with configurable IndieWeb settings

### GitLab Provider

- [ ] GitLab OAuth provider implementation
- [ ] GitLab API adapter for isomorphic-git
- [ ] Test full auth flow with GitLab

### Advanced Webmentions

- [ ] Self-hosted webmention receiver (Cloudflare Worker + D1 or go-jamming)
- [ ] Webmention sending at build time (notify linked sites)
