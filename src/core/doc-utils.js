import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname, sep } from 'path';

/** Folders that contain non-content files (assets, custom landing, etc.) */
const EXCLUDED_FOLDERS = ['_assets', '_css', '_images', '_static', '_landing', '_navbar', '_footer', 'public', 'node_modules'];

/** Files that are not doc pages */
const EXCLUDED_FILES = ['docs-config.json', 'vercel.json', 'netlify.toml', 'README.md'];

/**
 * Recursively collect all .md and .mdx files under docsPath,
 * respecting the same exclusion rules as sync.js.
 *
 * @param {string} docsPath - Root docs directory
 * @returns {Promise<Array<{ absolutePath: string, relativePath: string }>>}
 */
export async function collectMarkdownFiles(docsPath) {
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const rel = relative(docsPath, fullPath);
      const topSegment = rel.split(sep)[0];

      if (entry.isDirectory()) {
        if (EXCLUDED_FOLDERS.includes(topSegment) || EXCLUDED_FOLDERS.includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (EXCLUDED_FILES.includes(entry.name)) continue;
        const ext = extname(entry.name).toLowerCase();
        if (ext === '.md' || ext === '.mdx') {
          results.push({ absolutePath: fullPath, relativePath: rel });
        }
      }
    }
  }

  await walk(docsPath);
  return results;
}

/**
 * Parse YAML-style frontmatter from markdown content.
 * Returns { data: Record<string, string>, body: string }.
 * Simple key: value parsing — handles title, description, etc.
 *
 * @param {string} content - Raw file content
 * @returns {{ data: Record<string, any>, body: string }}
 */
export function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { data: {}, body: content };
  }

  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) {
    return { data: {}, body: content };
  }

  const fmBlock = content.substring(3, endIdx).trim();
  const body = content.substring(endIdx + 3).trim();
  const data = {};

  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) data[key] = value;
  }

  return { data, body };
}

/**
 * Convert a relative file path to a URL slug.
 *
 * Examples:
 *   "getting-started/installation.md"  → "/getting-started/installation"
 *   "introduction/index.mdx"           → "/introduction"
 *   "index.md"                         → "/"
 *
 * @param {string} relativePath - Path relative to docsPath
 * @returns {string}
 */
export function deriveSlug(relativePath) {
  let slug = relativePath
    .replace(/\.(md|mdx)$/, '')
    .split(sep)
    .join('/');

  // Remove trailing /index
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -6);
  }
  if (slug === 'index') {
    slug = '';
  }

  return '/' + slug;
}

/**
 * Check if a URL is external (http/https, mailto, tel, etc.)
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isExternalUrl(url) {
  return /^(https?:|mailto:|tel:|ftp:)/.test(url);
}
