# Lito

Beautiful documentation sites from Markdown. Fast, simple, and open-source.

[![npm version](https://img.shields.io/npm/v/@litodocs/cli)](https://www.npmjs.com/package/@litodocs/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **Note:** This package was previously published as `@devrohit06/superdocs`. It has been renamed to `@litodocs/cli`.

## Features

- **Multi-Framework** - Choose your preferred framework: Astro, React, Next.js, Vue, or Nuxt
- **Simple Setup** - Point to your docs folder and go
- **Markdown & MDX** - Full support for both formats with frontmatter
- **Custom Landing Pages** - Full HTML/CSS/JS control or section-based layouts
- **Hot Reload** - Dev server with live file watching
- **Fast Builds** - Static site generation for optimal performance
- **SEO Optimized** - Meta tags, semantic HTML, and proper structure
- **i18n Support** - Built-in internationalization with 40+ languages
- **Versioning** - Documentation versioning with version switcher
- **Dynamic Theming** - OKLCH color palette generation from primary color
- **GitHub Templates** - Use official or custom GitHub-hosted templates

## Installation

```bash
npm install -g @litodocs/cli
# or
pnpm add -g @litodocs/cli
# or
yarn global add @litodocs/cli
```

## Quick Start

```bash
# Initialize a new docs project
lito init

# Start dev server
lito dev -i ./my-docs

# Build for production
lito build -i ./my-docs -o ./dist

# Preview production build
lito preview -o ./dist
```

## Commands

| Command         | Description                                  |
| --------------- | -------------------------------------------- |
| `lito init`     | Initialize a new documentation project       |
| `lito dev`      | Start development server with hot reload     |
| `lito build`    | Generate static documentation site           |
| `lito preview`  | Preview production build locally             |
| `lito validate` | Validate docs-config.json configuration      |
| `lito doctor`   | Diagnose common issues                       |
| `lito info`     | Show project information and statistics      |
| `lito eject`    | Export full project source for customization |
| `lito template` | Manage templates (list, cache)               |
| `lito upgrade`  | Update CLI to latest version                 |

## Multi-Framework Support

Lito supports multiple frameworks. Choose the one that fits your workflow:

```bash
# Astro (default) - Fast static sites
lito dev -i ./docs --template astro

# React - Vite-powered React app
lito dev -i ./docs --template react

# Next.js - React with SSR/SSG
lito dev -i ./docs --template next

# Vue - Vite-powered Vue app
lito dev -i ./docs --template vue

# Nuxt - Vue with SSR/SSG
lito dev -i ./docs --template nuxt
```

### Template Registry

| Shorthand | Repository                             |
| --------- | -------------------------------------- |
| `astro`   | `github:Lito-docs/lito-astro-template` |
| `react`   | `github:Lito-docs/lito-react-template` |
| `next`    | `github:Lito-docs/lito-next-template`  |
| `vue`     | `github:Lito-docs/lito-vue-template`   |
| `nuxt`    | `github:Lito-docs/lito-nuxt-template`  |

You can also use custom templates:

```bash
# GitHub repository
lito dev -i ./docs --template github:owner/repo

# Specific branch or tag
lito dev -i ./docs --template github:owner/repo#v1.0.0

# Local template
lito dev -i ./docs --template ./my-custom-template
```

## Command Reference

### `lito init`

Initialize a new documentation project with interactive prompts:

```bash
lito init
lito init -o ./my-docs -n "My Project" --template react
```

| Option                  | Description         | Default       |
| ----------------------- | ------------------- | ------------- |
| `-o, --output <path>`   | Output directory    | (interactive) |
| `-n, --name <name>`     | Project name        | (interactive) |
| `-t, --template <name>` | Template to use     | `astro`       |
| `--sample`              | Create sample pages | `true`        |

### `lito dev`

Start development server with hot reload:

```bash
lito dev -i ./my-docs
lito dev -i ./my-docs --template react --port 3000
```

| Option                  | Description                    | Default |
| ----------------------- | ------------------------------ | ------- |
| `-i, --input <path>`    | Path to docs folder (required) | -       |
| `-t, --template <name>` | Template to use                | `astro` |
| `-p, --port <number>`   | Dev server port                | `4321`  |
| `-b, --base-url <url>`  | Base URL for the site          | `/`     |
| `--search`              | Enable search                  | `false` |
| `--refresh`             | Force re-download template     | `false` |

### `lito build`

Generate a static documentation site:

```bash
lito build -i ./my-docs -o ./dist
lito build -i ./my-docs --provider vercel --template next
```

| Option                  | Description                                            | Default  |
| ----------------------- | ------------------------------------------------------ | -------- |
| `-i, --input <path>`    | Path to docs folder (required)                         | -        |
| `-o, --output <path>`   | Output directory                                       | `./dist` |
| `-t, --template <name>` | Template to use                                        | `astro`  |
| `-b, --base-url <url>`  | Base URL for the site                                  | `/`      |
| `--provider <name>`     | Hosting provider (vercel, netlify, cloudflare, static) | `static` |
| `--rendering <mode>`    | Rendering mode (static, server, hybrid)                | `static` |
| `--search`              | Enable search                                          | `false`  |
| `--refresh`             | Force re-download template                             | `false`  |

### `lito preview`

Preview production build locally:

```bash
lito preview -o ./dist
lito preview -i ./my-docs  # Auto-builds if needed
```

| Option                | Description                         | Default  |
| --------------------- | ----------------------------------- | -------- |
| `-i, --input <path>`  | Docs folder (will build if no dist) | -        |
| `-o, --output <path>` | Path to built site                  | `./dist` |
| `-p, --port <number>` | Preview server port                 | `4321`   |

### `lito validate`

Validate your configuration:

```bash
lito validate -i ./my-docs
lito validate -i ./my-docs --quiet  # For CI pipelines
```

| Option               | Description             | Default |
| -------------------- | ----------------------- | ------- |
| `-i, --input <path>` | Path to docs folder     | `.`     |
| `-q, --quiet`        | Exit code only (for CI) | `false` |

### `lito doctor`

Diagnose common issues:

```bash
lito doctor -i ./my-docs
```

Checks performed:

- Directory and config file existence
- JSON syntax and schema validation
- Content files (.md/.mdx) presence
- Common mistakes (misplaced files)
- Template cache status
- Node.js version (18+ required, 20+ recommended)

### `lito info`

Show project information:

```bash
lito info -i ./my-docs
```

Displays:

- Project metadata
- Content statistics
- Navigation structure
- Enabled features
- Branding configuration
- Environment info

### `lito eject`

Export the full project source:

```bash
lito eject -i ./my-docs -o ./my-project
```

### `lito template`

Manage templates:

```bash
lito template list          # List available templates
lito template cache --clear # Clear template cache
```

### `lito upgrade`

Update to latest version:

```bash
lito upgrade
```

## Custom Landing Pages

### Full Custom Landing

Create a `_landing/` folder with HTML/CSS/JS:

```
my-docs/
├── _landing/
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── introduction.mdx
└── docs-config.json
```

Configure in `docs-config.json`:

```json
{
  "landing": {
    "type": "custom",
    "source": "_landing",
    "injectNav": true,
    "injectFooter": true
  }
}
```

### Section-Based Landing

Mix custom HTML with default components:

```json
{
  "landing": {
    "type": "sections",
    "sections": [
      { "type": "hero", "source": "default" },
      { "type": "custom", "html": "_landing/features.html" },
      { "type": "cta", "source": "default" },
      { "type": "custom", "html": "_landing/pricing.html" }
    ]
  }
}
```

### Available Section Types

| Section        | Description                         |
| -------------- | ----------------------------------- |
| `hero`         | Main hero with title, subtitle, CTA |
| `features`     | Feature grid or list                |
| `cta`          | Call-to-action banner               |
| `testimonials` | Customer testimonials               |
| `pricing`      | Pricing tables                      |
| `faq`          | Frequently asked questions          |
| `stats`        | Statistics/metrics                  |
| `logos`        | Partner/client logos                |
| `comparison`   | Feature comparison table            |
| `footer`       | Custom footer section               |

### Landing Types

| Type       | Description                        |
| ---------- | ---------------------------------- |
| `none`     | No landing, go straight to docs    |
| `default`  | Use template's default landing     |
| `config`   | Generate from docs-config.json     |
| `custom`   | Full HTML/CSS/JS from `_landing/`  |
| `sections` | Mix of custom and default sections |

## Deployment

### Vercel

```bash
lito build -i ./docs --provider vercel
```

### Netlify

```bash
lito build -i ./docs --provider netlify
```

### Cloudflare Pages

```bash
lito build -i ./docs --provider cloudflare --rendering server
```

## Configuration

Create a `docs-config.json` in your docs folder:

```json
{
  "metadata": {
    "name": "My Docs",
    "description": "Documentation for my project"
  },
  "branding": {
    "primaryColor": "#10b981",
    "logo": "/logo.svg",
    "favicon": "/favicon.ico"
  },
  "navigation": {
    "sidebar": [
      {
        "group": "Getting Started",
        "items": [
          { "label": "Introduction", "href": "/introduction" },
          { "label": "Quick Start", "href": "/quickstart" }
        ]
      }
    ]
  },
  "search": {
    "enabled": true
  }
}
```

### Core Config Keys (Portable)

These work across all templates:

- `metadata` - Name, description, version
- `branding` - Colors, logo, favicon
- `navigation` - Sidebar, navbar
- `search` - Search settings
- `seo` - SEO configuration
- `i18n` - Internationalization
- `assets` - Asset paths

### Extension Keys (Template-Specific)

These may vary by template:

- `footer` - Footer configuration
- `theme` - Theme customization
- `landing` - Landing page settings
- `integrations` - Third-party integrations
- `versioning` - Version settings

## Analytics

Add Google Analytics 4:

```json
{
  "integrations": {
    "analytics": {
      "provider": "google-analytics",
      "measurementId": "G-XXXXXXXXXX"
    }
  }
}
```

## Documentation Structure

```
my-docs/
├── docs-config.json
├── introduction.mdx
├── getting-started.md
├── api/
│   ├── reference.md
│   └── examples.md
├── _assets/          # Static assets
├── _images/          # Images
└── _landing/         # Custom landing (optional)
```

### Frontmatter

```markdown
---
title: Getting Started
description: Learn how to get started
---

# Getting Started

Your content here...
```

## Local Development

```bash
git clone https://github.com/Lito-docs/cli.git
cd cli
pnpm install
chmod +x bin/cli.js
npm link
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
