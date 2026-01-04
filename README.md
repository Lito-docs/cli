# Lito

The open-source Mintlify alternative. Beautiful documentation sites from Markdown.

## Features

✨ **Simple Setup** - Point to your docs folder and go 
🚀 **Astro-Powered** - Leverages Astro's speed and SEO optimization
📝 **Markdown & MDX** - Full support for both formats with frontmatter
🎨 **Customizable Templates** - Use GitHub-hosted or local templates
🔥 **Hot Reload** - Dev server with live file watching
⚡ **Fast Builds** - Static site generation for optimal performance
🎯 **SEO Optimized** - Meta tags, semantic HTML, and proper structure

## Installation

### Global Installation

```bash
npm install -g lito
# or
pnpm add -g lito
```

### Local Development

```bash
cd lito
pnpm install
chmod +x bin/cli.js
```

## Usage

### Build Command

Generate a static documentation site:

```bash
lito build --input ./my-docs --output ./dist
```

**Options:**

- `-i, --input <path>` (required) - Path to your docs folder
- `-o, --output <path>` - Output directory (default: `./dist`)
- `-t, --template <name>` - Template to use (see [Templates](#templates))
- `-b, --base-url <url>` - Base URL for the site (default: `/`)
- `--provider <name>` - optimize for hosting provider (vercel, netlify, cloudflare, static)
- `--rendering <mode>` - Rendering mode (static, server, hybrid)
- `--search` - Enable search functionality
- `--refresh` - Force re-download template from GitHub

### Dev Command

Start a development server with hot reload:

```bash
lito dev --input ./my-docs
```

**Options:**

- `-i, --input <path>` (required) - Path to your docs folder
- `-t, --template <name>` - Template to use
- `-b, --base-url <url>` - Base URL for the site
- `-p, --port <number>` - Port for dev server (default: `4321`)
- `--search` - Enable search functionality
- `--refresh` - Force re-download template

### Eject Command

Export the full Astro project source code to customize it further:

```bash
lito eject --input ./my-docs --output ./my-project
```

## Deployment

Lito includes built-in optimizations for major hosting providers. Use the `--provider` flag during build:

### Vercel
```bash
lito build -i ./docs --provider vercel
```
Generates `vercel.json` and optimizes for Vercel's edge network.

### Netlify
```bash
lito build -i ./docs --provider netlify
```
Generates `netlify.toml` with security headers.

### Cloudflare Pages
```bash
lito build -i ./docs --provider cloudflare --rendering server
```
Configures the project for Cloudflare's edge runtime with SSR support.

## Analytics

Lito supports Google Analytics 4 out of the box with zero performance penalty (powered by Partytown).

Add this to your `docs-config.json`:

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

## Templates

Lito supports flexible template sources:

### Default Template

```bash
lito dev -i ./docs
```

### GitHub Templates

Use templates hosted on GitHub:

```bash
# From a GitHub repo
lito dev -i ./docs --template github:owner/repo

# Specific branch or tag
lito dev -i ./docs --template github:owner/repo#v1.0.0

# Template in a subdirectory
lito dev -i ./docs --template github:owner/repo/templates/modern
```

### Local Templates

Use a local template folder:

```bash
lito dev -i ./docs --template ./my-custom-template
```

### Template Management

```bash
# List available templates
lito template list

# Clear template cache
lito template cache --clear
```

### Update Templates

Templates are cached for 24 hours. Force update with:

```bash
lito dev -i ./docs --refresh
```

## Documentation Structure

Your docs folder should contain Markdown (`.md`) or MDX (`.mdx`) files:

```
my-docs/
├── index.md
├── getting-started.md
├── api/
│   ├── reference.md
│   └── examples.md
└── guides/
    └── advanced.md
```

### Frontmatter

Add frontmatter to your markdown files for better metadata:

```markdown
---
title: Getting Started
description: Learn how to get started quickly
---

# Getting Started

Your content here...
```

## Architecture

The CLI tool:

1. **Resolves Template** - Fetches from GitHub or uses local template
2. **Scaffolds** - Creates a temporary Astro project from the template
3. **Syncs** - Copies your docs into `src/pages/` for automatic routing
4. **Configures** - Generates dynamic `astro.config.mjs` with your options
5. **Builds/Serves** - Spawns native Astro CLI commands
6. **Watches** (dev mode) - Uses `chokidar` to monitor file changes

## Development

### Project Structure

```
lito/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── cli.js              # Commander setup
│   ├── commands/
│   │   ├── build.js        # Build command
│   │   ├── dev.js          # Dev command with watcher
│   │   ├── eject.js        # Eject command
│   │   └── template.js     # Template management
│   ├── core/
│   │   ├── scaffold.js     # Project scaffolding
│   │   ├── sync.js         # File syncing
│   │   ├── config.js       # Config generation
│   │   ├── astro.js        # Astro CLI spawning
│   │   ├── template-fetcher.js   # GitHub template fetching
│   │   └── template-registry.js  # Template name registry
│   └── template/           # Bundled fallback template
└── package.json
```

### Running Tests

```bash
# Create sample docs
mkdir sample-docs
echo "# Hello\n\nWelcome!" > sample-docs/index.md

# Test build
node bin/cli.js build -i sample-docs -o test-output

# Test dev server
node bin/cli.js dev -i sample-docs
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

---

**Built with ❤️ using Astro and Node.js**
