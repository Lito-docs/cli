# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-10

First stable release. Lito is production-ready for generating documentation sites from Markdown.

### Added

- **GitHub Packages Publishing**: Dual publishing to npm (`@litodocs/cli`) and GitHub Packages (`@lito-docs/cli`)
- **Privacy & Terms Pages**: Added default privacy policy and terms of service pages to sample docs
- **MIT License for Template**: Added LICENSE file to the Astro template

### Changed

- **Stable Release**: Promoted from beta (v0.x) to v1.0.0
- **Decluttered Navbar**: Moved version switcher and language switcher from the header to the sidebar top; moved Twitter/Discord social links to the sidebar bottom. Header now contains only: search, GitHub, theme toggle, and CTA
- **Mobile Navigation**: Version and language switchers accessible in mobile drawer
- **Dynamic Version Reading**: CLI version and update checker now read from `package.json` at runtime — no more hardcoded version strings getting out of sync
- **Multi-Instance Components**: Version switcher and language switcher refactored to support multiple instances (sidebar + mobile nav) using data attributes instead of IDs

### Fixed

- **Version Mismatch**: CLI reported `0.5.2` in update checker and `0.6.0` in commander while `package.json` was at `0.7.0` — all now read from single source of truth
- **Package Size**: Added `files` field to `package.json` — npm package reduced from 31 MB (743 files) to 39 KB (31 files)
- **Dead Entry Point**: Removed invalid `main` field pointing to non-existent `src/index.js`
- **Sidebar Scroll**: Fixed scroll position save/restore after sidebar layout changed to flex column

## [0.7.0] - 2026-01-28

### Added

- **Multi-Framework Support**: Generate documentation sites with your preferred framework
  - Astro (default), React, Next.js, Vue, and Nuxt templates
  - Framework auto-detection from manifest or config files
  - Framework-specific dev and build commands
  - Use `--template react`, `--template next`, `--template vue`, or `--template nuxt`

- **Custom Landing Pages**: Full control over your documentation landing page
  - **Full Custom**: Create `_landing/` folder with HTML/CSS/JS files
  - **Section-Based**: Mix custom HTML sections with default components
  - Landing types: `none`, `default`, `config`, `custom`, `sections`
  - 10 section types: hero, features, cta, testimonials, pricing, faq, stats, logos, comparison, footer
  - Multi-framework landing generation (generates `.astro`, `.jsx`, `.vue` based on template)

- **`lito init` Command**: Interactive project initialization
  - Beautiful CLI prompts with @clack/prompts
  - Template selection with framework support
  - Creates `docs-config.json` with sensible defaults
  - Optional sample documentation pages (introduction.mdx, quickstart.mdx)
  - Auto-creates folder structure (`_assets`, `_images`)

- **`lito validate` Command**: Configuration validation
  - Validates `docs-config.json` against core schema
  - `--quiet` flag for CI pipelines (exit code only)
  - Shows configuration summary (metadata, navigation counts, features)
  - Portability check for cross-template compatibility

- **`lito doctor` Command**: Diagnose common issues
  - Checks directory and config file existence
  - Validates JSON syntax and schema compliance
  - Verifies content files exist (.md/.mdx)
  - Detects common mistakes (node_modules, package.json in docs folder)
  - Template cache status
  - Node.js version check (18+ required, 20+ recommended)

- **`lito info` Command**: Project information and statistics
  - Content stats: MD/MDX file counts, subdirectories
  - Navigation structure: sidebar groups/items, navbar links
  - Feature status: search, i18n, versioning, dark mode
  - Branding configuration overview
  - Config compatibility analysis
  - Environment info: Node.js version, platform, cached templates

- **`lito preview` Command**: Preview production builds locally
  - Auto-builds if output directory doesn't exist
  - Uses `serve` package or Python's http.server as fallback
  - Custom port support with `--port` flag

- **Configuration Validation System**: Portable config support
  - Core schema validation for cross-template compatibility
  - Core keys (portable): `metadata`, `branding`, `navigation`, `search`, `seo`, `i18n`, `assets`
  - Extension keys (template-specific): `footer`, `theme`, `landing`, `integrations`, `versioning`
  - Forward-compatible extension handling

- **Template Registry**: Shorthand names for official templates
  - `astro` → `github:Lito-docs/lito-astro-template`
  - `react` → `github:Lito-docs/lito-react-template`
  - `next` → `github:Lito-docs/lito-next-template`
  - `vue` → `github:Lito-docs/lito-vue-template`
  - `nuxt` → `github:Lito-docs/lito-nuxt-template`

### Changed

- **Framework-Aware Build Pipeline**: Build and dev commands now detect and use framework-specific tooling
- **Enhanced Sync System**: Content syncing respects framework-specific directory structures
- **HMR Support**: Hot module replacement trigger for Vite-based frameworks (React, Vue)
- **Conditional Search Indexing**: Pagefind indexing only for static-output frameworks

### Improved

- **CLI UX**: Beautiful interactive prompts, spinners, and color-coded output
- **Build Performance**: Parallel operations for faster builds (dependency install, docs sync, config sync)
- **Error Messages**: More helpful error messages with actionable guidance

## [0.6.0] - 2026-01-15

### Added

- **Framework Runner**: Core abstraction for multi-framework support
- **Landing Sync Module**: Foundation for custom landing page system

### Changed

- **Template Structure**: Updated default template paths for new framework templates

## [0.5.2] - 2026-01-04

### Added

- **Update Checker**: Automatic version check on CLI startup with update notification
- **Upgrade Command**: New `lito upgrade` command to check and install latest version
- **Auto-detect Package Manager**: Upgrade uses pnpm, yarn, or npm based on availability

## [0.5.1] - 2026-01-04

### Changed

- **Package Rename**: Renamed package from `@lito/cli` to `@litodocs/cli`
- **README Overhaul**: Improved documentation with tables, quick start guide, and better formatting
- **Migration Note**: Added note about previous package name `@devrohit06/superdocs`

### Added

- **Local Development**: Added `npm link` instructions for local development

## [0.5.0] - 2026-01-04

### Added

- **Documentation Versioning**: Support for versioned documentation
- **Hosting Provider Support**: New `--provider` option for optimized builds (Vercel, Netlify, Cloudflare, static)
- **Rendering Modes**: New `--rendering` option supporting static, server, and hybrid modes
- **Dynamic Theme Generation**: Generate OKLCH color palettes from primary color
- **i18n Support**: Automatic detection and syncing of locale folders with 40+ language codes
- **Asset Syncing**: Automatic syncing of `_assets`, `_images`, `_css`, and `public` folders

### Changed

- **Organization Migration**: Moved to official Lito-docs organization on GitHub
- **Default Template**: Updated default template source to `github:Lito-docs/template`
- **Branding**: Updated project description
- **Smart Layout Injection**: Automatic layout detection based on frontmatter

## [0.3.5] - 2026-01-02

### Added

- **CLI Config Options**: `--name`, `--description`, `--primary-color`, `--accent-color`, `--favicon`, `--logo`
- **Enhanced Config Management**: CLI options automatically update `docs-config.json`

### Removed

- **Unused Dependency**: Removed `zod` package

## [0.3.0] - 2026-01-01

### Added

- **GitHub-Hosted Templates**: Fetch templates from `github:owner/repo`
- **Template Caching**: 24-hour cache in `~/.lito/templates/`
- **Template Management**: `lito template list` and `lito template cache --clear`
- **Force Refresh**: `--refresh` flag to bypass cache

### Changed

- Renamed `--theme` to `--template`
- Default template now fetched from GitHub

## [0.2.2] - 2025-12-29

### Fixed

- **Template**: Fixed internal links to respect `baseUrl` configuration

## [0.2.1] - 2025-12-29

### Fixed

- **Config**: Fixed `baseUrl` not being applied to Astro configuration

## [0.2.0] - 2025-12-29

### Fixed

- **Eject**: Resolved build errors in ejected projects

### Improved

- **MDX Components**: Refined `Tabs` and `CodeGroup` components
- **Template**: Modernized with Astro 5 and Tailwind CSS v4

## [0.1.0] - 2025-12-28

### Added

- **CLI Tool**: Complete command-line interface for documentation generation
- **Build Command**: Generate static documentation sites with `lito build`
- **Dev Command**: Development server with hot reload using `lito dev`
- **Eject Command**: Export full Astro project with `lito eject`
- **Astro Integration**: Lightning-fast static site generation
- **Markdown & MDX Support**: Full support with frontmatter
- **SEO Optimization**: Meta tags, semantic HTML
- **Responsive Design**: Mobile-friendly documentation interface
- **Rich Component Library**: API Playground, Breadcrumbs, Search, Sidebar, TOC, Theme Toggle, Accordion, Alert, Badge, Cards, Code groups, and more
- **Hot Reload**: File watching in development
- **Theme Support**: Custom themes and base URLs
