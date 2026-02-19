import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { collectMarkdownFiles, parseFrontmatter, deriveSlug } from './doc-utils.js';

/**
 * @typedef {'error' | 'warning'} Severity
 * @typedef {{ rule: string, severity: Severity, file: string, message: string }} LintIssue
 * @typedef {{ issues: LintIssue[], totalFiles: number }} LintResult
 */

/**
 * Run content quality checks on all markdown files in a docs folder.
 *
 * @param {string} docsPath - Root docs directory
 * @param {object} [options]
 * @param {object} [options.config] - Parsed docs-config.json (for orphan detection)
 * @returns {Promise<LintResult>}
 */
export async function lintContent(docsPath, options = {}) {
  const files = await collectMarkdownFiles(docsPath);
  /** @type {LintIssue[]} */
  const issues = [];

  // Pre-compute title map for duplicate detection
  /** @type {Map<string, string[]>} title → list of relative paths */
  const titleMap = new Map();

  // Pre-compute sidebar slugs for orphan detection
  const sidebarSlugs = new Set();
  if (options.config?.navigation?.sidebar) {
    collectSidebarSlugs(options.config.navigation.sidebar, sidebarSlugs);
  }

  for (const file of files) {
    const content = readFileSync(file.absolutePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);
    const slug = deriveSlug(file.relativePath);

    // ── missing-title ──
    if (!data.title) {
      issues.push({
        rule: 'missing-title',
        severity: 'warning',
        file: file.relativePath,
        message: 'No title in frontmatter',
      });
    }

    // ── missing-description ──
    if (!data.description) {
      issues.push({
        rule: 'missing-description',
        severity: 'warning',
        file: file.relativePath,
        message: 'No description in frontmatter',
      });
    }

    // ── empty-page ──
    if (!body || body.trim().length === 0) {
      issues.push({
        rule: 'empty-page',
        severity: 'error',
        file: file.relativePath,
        message: 'Page has no content body',
      });
    }

    // ── long-title ──
    if (data.title && data.title.length > 70) {
      issues.push({
        rule: 'long-title',
        severity: 'warning',
        file: file.relativePath,
        message: `Title is ${data.title.length} characters (recommended max: 70 for SEO)`,
      });
    }

    // ── missing-image ──
    // Check markdown image references: ![alt](path)
    const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let imgMatch;
    while ((imgMatch = imageRegex.exec(content)) !== null) {
      const imgPath = imgMatch[1].split(/[?#]/)[0]; // strip query/fragment
      if (!imgPath || /^(https?:|data:)/.test(imgPath)) continue;

      // Resolve relative to file's directory or to docs root for absolute paths
      let resolvedPath;
      if (imgPath.startsWith('/')) {
        // Could be in _images, _assets, or public
        const candidates = [
          join(docsPath, '_images', imgPath.slice(1)),
          join(docsPath, '_assets', imgPath.slice(1)),
          join(docsPath, 'public', imgPath.slice(1)),
        ];
        if (!candidates.some(c => existsSync(c))) {
          issues.push({
            rule: 'missing-image',
            severity: 'error',
            file: file.relativePath,
            message: `Referenced image not found: ${imgPath}`,
          });
        }
      } else {
        resolvedPath = join(dirname(file.absolutePath), imgPath);
        if (!existsSync(resolvedPath)) {
          issues.push({
            rule: 'missing-image',
            severity: 'error',
            file: file.relativePath,
            message: `Referenced image not found: ${imgPath}`,
          });
        }
      }
    }

    // ── Collect titles for duplicate check ──
    if (data.title) {
      const normalizedTitle = data.title.toLowerCase().trim();
      if (!titleMap.has(normalizedTitle)) {
        titleMap.set(normalizedTitle, []);
      }
      titleMap.get(normalizedTitle).push(file.relativePath);
    }

    // ── orphaned-page ──
    if (sidebarSlugs.size > 0) {
      // Only check content pages, not index pages or API pages
      if (!sidebarSlugs.has(slug)) {
        issues.push({
          rule: 'orphaned-page',
          severity: 'warning',
          file: file.relativePath,
          message: `Page is not linked in sidebar navigation (slug: ${slug})`,
        });
      }
    }
  }

  // ── duplicate-title (post-pass) ──
  for (const [title, paths] of titleMap) {
    if (paths.length > 1) {
      for (const p of paths) {
        issues.push({
          rule: 'duplicate-title',
          severity: 'warning',
          file: p,
          message: `Duplicate title "${title}" also in: ${paths.filter(x => x !== p).join(', ')}`,
        });
      }
    }
  }

  return { issues, totalFiles: files.length };
}

/**
 * Recursively extract all href slugs from sidebar config.
 */
function collectSidebarSlugs(groups, slugSet) {
  for (const group of groups) {
    if (!group.items) continue;
    for (const item of group.items) {
      if (item.href) {
        slugSet.add(item.href);
      }
      if (item.items) {
        collectSidebarSlugs([{ items: item.items }], slugSet);
      }
    }
  }
}
