# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Janos is a browser-based static site generator that runs entirely in the browser. The project is undergoing a modernization effort, transitioning from Nuxt.js 2 + Metalsmith to a new architecture based on Vue 3 + Vite with a shared TypeScript core.

## Repository Structure

The project uses a **pnpm monorepo** with the following packages:

```
janos/
├── packages/
│   ├── core/           # @janos/core - Shared TypeScript core
│   │   └── src/
│   │       ├── fs/        # IFileSystem interface + ZenFS/Memory implementations
│   │       ├── git/       # IGitProvider interface + isomorphic-git implementation
│   │       ├── auth/      # IAuthProvider interface + GitHub OAuth implementation
│   │       ├── pipeline/  # IPipeline interface + content processing
│   │       └── templates/ # Template engine interfaces
│   │
│   ├── web/            # @janos/web - Browser app (Vue 3 + Vite + Pinia)
│   │   └── src/
│   │       ├── components/
│   │       ├── composables/
│   │       ├── stores/    # Pinia stores wrapping @janos/core
│   │       └── views/
│   │
│   └── cli/            # @janos/cli - Command-line interface
│
└── [legacy files]      # Original Nuxt 2 codebase (being migrated)
```

## Build Commands

### New Monorepo (packages/)
```bash
pnpm install              # Install all dependencies
pnpm -r build             # Build all packages
pnpm --filter @janos/core build   # Build core package
pnpm --filter @janos/core test    # Run core tests
pnpm --filter @janos/web dev      # Start web dev server
```

### Legacy (root level, being deprecated)
```bash
npm install          # Install dependencies
npm run dev          # Development server with hot reload at localhost:3000
npm run build        # Build for production
npm test             # Run Jest tests
```

## Key Abstractions (@janos/core)

### IFileSystem (`packages/core/src/fs/`)
Abstract filesystem interface with implementations:
- `ZenFSFileSystem` - Browser filesystem using IndexedDB via ZenFS
- `MemoryFileSystem` - In-memory filesystem for testing

### IGitProvider (`packages/core/src/git/`)
Abstract git interface with implementation:
- `IsomorphicGitProvider` - Pure JavaScript git using isomorphic-git

### IAuthProvider (`packages/core/src/auth/`)
OAuth authentication interface with implementation:
- `GitHubAuthProvider` - GitHub OAuth flow

### IPipeline (`packages/core/src/pipeline/`)
Content processing pipeline for static site generation.

## Architecture Principles

1. **Interface-driven**: All major systems use TypeScript interfaces for testability
2. **Browser-native**: Core works in browser without Node.js polyfills
3. **Shared core**: Same code runs in browser, Node.js CLI, and GitHub Actions
4. **Pure git**: Uses isomorphic-git instead of GitHub REST API for git operations

## Legacy Architecture (for reference during migration)

The original codebase used Metalsmith with custom webpack polyfills:
- `fs` → `plugins/fs.js`
- `recursive-readdir` → `plugins/readdir.js`
- Vuex stores in `store/github.js`, `store/metalsmith.js`
- Custom Metalsmith plugins in `plugins/metalsmith-*.js`

## Environment Configuration

### Web Package
Uses Vite environment variables:
- `VITE_GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `VITE_OAUTH_PROXY_URL` - OAuth token exchange proxy URL

### Legacy
Uses `.env` for development and `prod.env` for production.
