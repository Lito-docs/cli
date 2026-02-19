import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { collectMarkdownFiles, deriveSlug, isExternalUrl } from './doc-utils.js';

/**
 * @typedef {{ file: string, link: string, text: string, suggestion?: string }} BrokenLink
 * @typedef {{ brokenLinks: BrokenLink[], totalLinks: number, checkedFiles: number }} CheckResult
 */

/**
 * Scan all markdown files for broken internal links.
 *
 * @param {string} docsPath - Root docs directory
 * @param {object} [options]
 * @returns {Promise<CheckResult>}
 */
export async function checkLinks(docsPath, options = {}) {
  const files = await collectMarkdownFiles(docsPath);

  // Build a set of all known slugs for resolution
  const knownSlugs = new Set();
  for (const file of files) {
    knownSlugs.add(deriveSlug(file.relativePath));
  }

  /** @type {BrokenLink[]} */
  const brokenLinks = [];
  let totalLinks = 0;

  // Regex patterns for extracting links
  // Markdown links (excluding images which start with !)
  const mdLinkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
  // HTML/JSX href attributes
  const hrefRegex = /href=["']([^"']+)["']/g;

  for (const file of files) {
    const content = readFileSync(file.absolutePath, 'utf-8');
    const links = [];

    // Extract markdown links
    let match;
    while ((match = mdLinkRegex.exec(content)) !== null) {
      links.push({ text: match[1], url: match[2] });
    }
    mdLinkRegex.lastIndex = 0;

    // Extract href links
    while ((match = hrefRegex.exec(content)) !== null) {
      links.push({ text: '', url: match[1] });
    }
    hrefRegex.lastIndex = 0;

    for (const { text, url } of links) {
      // Skip non-checkable links
      if (!url) continue;
      if (isExternalUrl(url)) continue;
      if (url.startsWith('#')) continue; // anchor-only
      if (url.startsWith('{') || url.includes('${')) continue; // template vars
      if (url.startsWith('data:')) continue;

      totalLinks++;

      // Strip anchor fragment and query string
      const cleanUrl = url.split(/[?#]/)[0];
      if (!cleanUrl) continue;

      // Normalize: ensure leading slash
      const slug = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;

      // Check if slug resolves to a known page
      if (resolveSlug(slug, knownSlugs, docsPath)) continue;

      // Check if it's a static asset (in _assets, _images, public)
      if (resolveStaticAsset(slug, docsPath)) continue;

      // Broken link — try to suggest a fix
      const suggestion = findClosestSlug(slug, knownSlugs);

      brokenLinks.push({
        file: file.relativePath,
        link: url,
        text,
        ...(suggestion ? { suggestion } : {}),
      });
    }
  }

  return { brokenLinks, totalLinks, checkedFiles: files.length };
}

/**
 * Try to resolve a slug against known slugs.
 * Checks exact match, with/without trailing slash, and index variants.
 */
function resolveSlug(slug, knownSlugs, docsPath) {
  // Normalize trailing slash
  const normalized = slug.endsWith('/') ? slug.slice(0, -1) : slug;
  if (!normalized) return knownSlugs.has('/'); // root

  if (knownSlugs.has(normalized)) return true;

  // Maybe it's linking to a directory with an index file
  if (knownSlugs.has(normalized + '/index')) return true;

  // Check if the raw file exists (.md/.mdx)
  const withoutSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const candidates = [
    join(docsPath, withoutSlash + '.md'),
    join(docsPath, withoutSlash + '.mdx'),
    join(docsPath, withoutSlash, 'index.md'),
    join(docsPath, withoutSlash, 'index.mdx'),
  ];

  return candidates.some(c => existsSync(c));
}

/**
 * Check if a path resolves to a static asset.
 */
function resolveStaticAsset(slug, docsPath) {
  const withoutSlash = slug.startsWith('/') ? slug.slice(1) : slug;
  const candidates = [
    join(docsPath, 'public', withoutSlash),
    join(docsPath, '_assets', withoutSlash),
    join(docsPath, '_images', withoutSlash),
  ];
  return candidates.some(c => existsSync(c));
}

/**
 * Find the closest matching slug using simple string similarity (Levenshtein-like).
 *
 * @param {string} target
 * @param {Set<string>} knownSlugs
 * @returns {string|null}
 */
function findClosestSlug(target, knownSlugs) {
  let bestMatch = null;
  let bestScore = Infinity;

  for (const slug of knownSlugs) {
    const dist = levenshtein(target, slug);
    if (dist < bestScore && dist <= Math.max(target.length, slug.length) * 0.4) {
      bestScore = dist;
      bestMatch = slug;
    }
  }

  return bestMatch;
}

/**
 * Simple Levenshtein distance.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
