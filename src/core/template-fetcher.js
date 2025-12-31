import pkg from 'fs-extra';
const { ensureDir, copy, remove, pathExists, readJson, writeJson } = pkg;
import { homedir, tmpdir } from 'os';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache directory for downloaded templates
const CACHE_DIR = join(homedir(), '.superdocs', 'templates');

/**
 * Parse a template specification string into a structured format
 * Supports:
 * - 'default' or null -> registry lookup
 * - 'github:owner/repo' -> GitHub repo (default branch)
 * - 'github:owner/repo#ref' -> GitHub repo with specific branch/tag
 * - 'github:owner/repo/path/to/template' -> GitHub repo with subdirectory
 * - 'github:owner/repo/path#ref' -> GitHub repo with subdirectory and ref
 * - './path/to/template' or '/absolute/path' -> local path
 * - 'template-name' -> lookup in registry
 */
export function parseThemeSpec(themeSpec) {
  if (!themeSpec || themeSpec === 'default') {
    return { type: 'registry', name: 'default' };
  }

  // GitHub format: github:owner/repo[/path]#ref or github:owner/repo[/path]
  if (themeSpec.startsWith('github:')) {
    const repoSpec = themeSpec.slice(7);
    const [pathPart, ref = 'main'] = repoSpec.split('#');
    const parts = pathPart.split('/');

    if (parts.length < 2) {
      throw new Error(`Invalid GitHub template format: ${themeSpec}. Expected: github:owner/repo or github:owner/repo/path#ref`);
    }

    const owner = parts[0];
    const repo = parts[1];
    const subPath = parts.length > 2 ? parts.slice(2).join('/') : null;

    return { type: 'github', owner, repo, ref, subPath };
  }

  // Local path (starts with . or /)
  if (themeSpec.startsWith('.') || themeSpec.startsWith('/')) {
    return { type: 'local', path: themeSpec };
  }

  // Registry name (fallback)
  return { type: 'registry', name: themeSpec };
}

/**
 * Get cache key for a GitHub template
 */
function getCacheKey(owner, repo, ref) {
  return `${owner}-${repo}-${ref}`;
}

/**
 * Check if a cached template exists and return its path
 */
export async function getCachedTemplate(owner, repo, ref) {
  const cacheKey = getCacheKey(owner, repo, ref);
  const cachePath = join(CACHE_DIR, cacheKey);

  if (await pathExists(cachePath)) {
    // Check if cache metadata exists and is valid
    const metaPath = join(cachePath, '.superdocs-cache.json');
    if (await pathExists(metaPath)) {
      const meta = await readJson(metaPath);
      // Cache is valid for 24 hours by default
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in ms
      if (Date.now() - meta.cachedAt < maxAge) {
        return cachePath;
      }
    }
  }

  return null;
}

/**
 * Download a GitHub repository as a tarball and extract it
 */
export async function fetchGitHubTemplate(owner, repo, ref) {
  const cacheKey = getCacheKey(owner, repo, ref);
  const cachePath = join(CACHE_DIR, cacheKey);
  const tempTarPath = join(tmpdir(), `superdocs-${cacheKey}.tar.gz`);

  // Ensure cache directory exists
  await ensureDir(CACHE_DIR);

  // Download the tarball
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;

  const response = await fetch(tarballUrl, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'superdocs-cli'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Template not found: github:${owner}/${repo}#${ref}`);
    }
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }

  // Write tarball to temp file
  const fileStream = createWriteStream(tempTarPath);
  await pipeline(response.body, fileStream);

  // Extract tarball to cache directory
  await ensureDir(cachePath);

  // Use tar to extract (available on all Unix systems and modern Windows)
  const { execa } = await import('execa');
  await execa('tar', [
    '-xzf', tempTarPath,
    '-C', cachePath,
    '--strip-components=1'
  ]);

  // Cleanup temp tarball
  await remove(tempTarPath);

  // Write cache metadata
  const metaPath = join(cachePath, '.superdocs-cache.json');
  await writeJson(metaPath, {
    owner,
    repo,
    ref,
    cachedAt: Date.now()
  });

  return cachePath;
}

/**
 * Get the bundled template path
 */
export function getBundledTemplatePath() {
  return join(__dirname, '../template');
}

/**
 * Main entry point: resolve template spec and return template path
 * @param {string} themeSpec - Template specification
 * @param {boolean} forceRefresh - If true, bypass cache and re-download
 */
export async function getTemplatePath(themeSpec, forceRefresh = false) {
  const parsed = parseThemeSpec(themeSpec);

  switch (parsed.type) {

    case 'github': {
      // Check cache first (unless forcing refresh)
      let basePath = forceRefresh ? null : await getCachedTemplate(parsed.owner, parsed.repo, parsed.ref);
      if (!basePath) {
        // Fetch from GitHub
        basePath = await fetchGitHubTemplate(parsed.owner, parsed.repo, parsed.ref);
      }
      // If subPath is specified, return the subdirectory
      if (parsed.subPath) {
        const fullPath = join(basePath, parsed.subPath);
        if (!(await pathExists(fullPath))) {
          throw new Error(`Template subdirectory not found: ${parsed.subPath} in github:${parsed.owner}/${parsed.repo}`);
        }
        return fullPath;
      }
      return basePath;
    }

    case 'local': {
      const { resolve } = await import('path');
      const localPath = resolve(parsed.path);
      if (!(await pathExists(localPath))) {
        throw new Error(`Local template not found: ${localPath}`);
      }
      return localPath;
    }

    case 'registry': {
      // Import registry and resolve
      const { resolveRegistryName } = await import('./template-registry.js');
      const resolved = resolveRegistryName(parsed.name);
      if (!resolved) {
        throw new Error(`Unknown template: ${parsed.name}. Use 'superdocs template list' to see available templates.`);
      }
      // Recursively resolve the GitHub URL
      return await getTemplatePath(resolved);
    }

    default:
      throw new Error(`Unknown theme type: ${parsed.type}`);
  }
}

/**
 * Clear the template cache
 */
export async function clearTemplateCache() {
  if (await pathExists(CACHE_DIR)) {
    await remove(CACHE_DIR);
  }
}

/**
 * List cached templates
 */
export async function listCachedTemplates() {
  if (!(await pathExists(CACHE_DIR))) {
    return [];
  }

  const { readdir } = await import('fs/promises');
  const entries = await readdir(CACHE_DIR, { withFileTypes: true });

  const templates = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = join(CACHE_DIR, entry.name, '.superdocs-cache.json');
      if (await pathExists(metaPath)) {
        const meta = await readJson(metaPath);
        templates.push({
          name: entry.name,
          ...meta
        });
      }
    }
  }

  return templates;
}
