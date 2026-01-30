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

## Migration & Compatibility

- [ ] **Self-update mechanism**: Editor can update its own `_janos/` folder by fetching new releases and committing changes
- [ ] **Breaking change migrations**: Automated migration tools when config format or folder structure changes
- [ ] **Version tracking**: `_janos/version.json` tracks embedded version, enables update checks and targeted migrations

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
- [x] Permalinks plugin for clean URLs
- [x] Layouts plugin for template rendering
- [x] Integration tests with actual site build
- [x] Test pipeline with existing Janos templates (Miksa - partial, see gaps below)
- [ ] Fix inline-source plugin regex (greedy pattern issue)

### Feature Gaps (for full Miksa/gijsvandam.nl support)

**Template Engine Enhancements:**
- [ ] Nunjucks `{% extends %}` with virtual filesystem loader
- [ ] Nunjucks `{% include %}` with virtual filesystem loader
- [ ] Custom `{% asyncEach %}` tag for async iteration
- [ ] Date formatting filters (`| date("YYYY")`)
- [ ] Reading time calculation

**Additional Plugins Needed:**
- [ ] `collections` - group files by pattern/metadata
- [ ] `pagination` - paginate collections
- [ ] `tags/topics` - generate tag pages from metadata
- [ ] `publish` - filter drafts/private/future posts
- [ ] `excerpts` - extract post excerpts (<!-- more -->)
- [ ] `rss` - generate RSS/Atom feed
- [ ] `sitemap` - generate sitemap.xml

---

## Phase 3: Authentication & Git

- [ ] Azure Functions OAuth proxy (port existing)
- [ ] GitLab provider as second implementation
- [ ] Test full auth flow end-to-end
- [ ] Self-hosted git server support (future)

---

## Phase 4: Editor UI

- [ ] CodeMirror 6 editor integration
- [ ] File tree component with drag-drop
- [ ] Git panel (status, commit, branches)
- [ ] Build/preview panel
- [ ] Image upload/paste with responsive processing
- [ ] Mobile-responsive layout

---

## Phase 5: Embeddable Build & Distribution

- [ ] **Vite embeddable build config**: Relative base paths, bundle all deps including WASM
- [ ] **Starter repo** (`Janos-starter`): Template repo with embedded editor, sample content, default templates
- [ ] **Self-replication UI**: "Start your own site" component that triggers GitHub fork
- [ ] **Self-update UI**: "Check for updates" button, downloads and commits new `_janos/`
- [ ] **Version check endpoint**: Where the editor checks for new versions (GitHub releases or npm)

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

## Phase 7: Polish

- [ ] PWA/offline support
- [ ] Documentation site (built with Janos, of course)
- [ ] Theming system for editor UI
