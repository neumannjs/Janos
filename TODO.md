# Janos TODO

## Migration & Compatibility

- [ ] **Website update mechanism**: Existing Janos sites (cloned from original) need a way to update to newer Janos versions without affecting their content. The site's content lives in the repo, but Janos "app" files need to be updatable separately.

- [ ] **Breaking change migrations**: When introducing breaking changes (config format, folder structure, etc.), provide automated migration tools. Document migration paths for each major version.

- [ ] **Version tracking**: Sites should track which Janos version they were created with, enabling targeted migrations.

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
- [ ] Integration tests with actual site build
- [ ] Test pipeline with existing Janos templates

## Phase 3: Authentication & Remote

- [ ] Azure Functions OAuth proxy (port existing)
- [ ] GitLab provider as second implementation
- [ ] Test full auth flow end-to-end

## Phase 4: UI Layer

- [ ] CodeMirror 6 editor integration
- [ ] File tree component with drag-drop
- [ ] Git panel (status, commit, branches)
- [ ] Build/preview panel
- [ ] Mobile-responsive layout

## Phase 5: Multi-Platform

- [ ] CLI: `janos init` command
- [ ] CLI: `janos build` command
- [ ] CLI: `janos serve` command
- [ ] GitHub Action for CI/CD builds
- [ ] Node.js image processing with Sharp (fallback for CLI/server environments where jSquash WASM isn't available)

## Phase 6: Polish

- [ ] PWA/offline support
- [ ] Self-replication: Janos deploys itself
- [ ] Documentation site
