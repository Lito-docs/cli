import pkg from 'fs-extra';
const { copy, ensureDir, remove, readFile, writeFile, pathExists } = pkg;
import { join, relative, sep } from 'path';
import { readdir, stat, utimes } from 'fs/promises';
import { syncLanding } from './landing-sync.js';

// Known locale codes (ISO 639-1)
const KNOWN_LOCALES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
  'ar', 'hi', 'bn', 'pa', 'id', 'ms', 'th', 'vi', 'tr', 'pl',
  'nl', 'sv', 'da', 'no', 'fi', 'cs', 'sk', 'hu', 'ro', 'bg',
  'uk', 'he', 'fa', 'ur', 'ta', 'te', 'mr', 'gu', 'kn', 'ml',
];

// Special folders that are not content
const SPECIAL_FOLDERS = ['_assets', '_css', '_images', '_static', '_landing', '_navbar', '_footer', 'public'];

/**
 * Get i18n configuration from docs-config.json
 */
async function getI18nConfig(sourcePath) {
  const configPath = join(sourcePath, 'docs-config.json');
  if (await pathExists(configPath)) {
    try {
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      return config.i18n || { defaultLocale: 'en', locales: ['en'] };
    } catch {
      return { defaultLocale: 'en', locales: ['en'] };
    }
  }
  return { defaultLocale: 'en', locales: ['en'] };
}

/**
 * Get full docs-config.json
 */
async function getDocsConfig(sourcePath) {
  const configPath = join(sourcePath, 'docs-config.json');
  if (await pathExists(configPath)) {
    try {
      return JSON.parse(await readFile(configPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Get versioning configuration from docs-config.json
 */
async function getVersioningConfig(sourcePath) {
  const configPath = join(sourcePath, 'docs-config.json');
  if (await pathExists(configPath)) {
    try {
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      return config.versioning || { enabled: false };
    } catch {
      return { enabled: false };
    }
  }
  return { enabled: false };
}

/**
 * Detect locale folders in the docs directory
 */
async function detectLocaleFolders(sourcePath, configuredLocales) {
  const detectedLocales = [];

  try {
    const entries = await readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderName = entry.name.toLowerCase();
        // Check if it's a known locale or configured locale
        if (KNOWN_LOCALES.includes(folderName) || configuredLocales.includes(folderName)) {
          detectedLocales.push(entry.name);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return detectedLocales;
}

/**
 * Detect version folders based on versioning config
 */
async function detectVersionFolders(sourcePath, versioningConfig) {
  if (!versioningConfig?.enabled || !versioningConfig?.versions?.length) {
    return [];
  }

  const versionFolders = [];

  try {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    const configuredPaths = versioningConfig.versions.map(v => v.path);

    for (const entry of entries) {
      if (entry.isDirectory() && configuredPaths.includes(entry.name)) {
        versionFolders.push(entry.name);
      }
    }
  } catch {
    // Ignore errors
  }

  return versionFolders;
}

/**
 * Sync documentation files to the project
 * @param {string} sourcePath - User's docs directory
 * @param {string} projectDir - Scaffolded project directory
 * @param {object} frameworkConfig - Framework configuration (optional, defaults to Astro)
 */
export async function syncDocs(sourcePath, projectDir, frameworkConfig = null) {
  // Default to Astro's src/pages for backward compatibility
  const contentDir = frameworkConfig?.contentDir || 'src/pages';
  const targetPath = join(projectDir, contentDir);
  const shouldInjectLayout = frameworkConfig?.layoutInjection !== false;

  // Clear existing pages (except index if it exists in template)
  await ensureDir(targetPath);

  // Get i18n configuration
  const i18nConfig = await getI18nConfig(sourcePath);
  const configuredLocales = i18nConfig.locales || ['en'];
  const defaultLocale = i18nConfig.defaultLocale || 'en';

  // Get versioning configuration
  const versioningConfig = await getVersioningConfig(sourcePath);
  const versionFolders = await detectVersionFolders(sourcePath, versioningConfig);

  // Detect locale folders
  const localeFolders = await detectLocaleFolders(sourcePath, configuredLocales);

  // Combine folders to exclude from root sync
  const excludeFolders = [...localeFolders, ...versionFolders];

  // Copy default content (root level, excluding locale and version folders)
  await copy(sourcePath, targetPath, {
    overwrite: true,
    filter: (src) => {
      const relativePath = relative(sourcePath, src);
      const firstSegment = relativePath.split(sep)[0];

      // Exclude special folders
      if (SPECIAL_FOLDERS.some(folder => relativePath.startsWith(folder))) {
        return false;
      }

      // Exclude locale and version folders (they'll be synced separately)
      if (excludeFolders.includes(firstSegment)) {
        return false;
      }

      // Exclude config files
      if (relativePath === 'docs-config.json' || relativePath === 'vercel.json') {
        return false;
      }

      // Only copy markdown/mdx files and directories
      return src.endsWith('.md') || src.endsWith('.mdx') || !src.includes('.');
    },
  });

  // Sync version folders
  await Promise.all(versionFolders.map(async (version) => {
    const versionSourcePath = join(sourcePath, version);
    const versionTargetPath = join(targetPath, version);

    await ensureDir(versionTargetPath);
    await copy(versionSourcePath, versionTargetPath, {
      overwrite: true,
      filter: (src) => {
        // Only copy markdown/mdx files and directories
        return src.endsWith('.md') || src.endsWith('.mdx') || !src.includes('.');
      },
    });

    // Inject layout into version markdown files (only for frameworks that need it)
    if (shouldInjectLayout) {
      await injectLayoutIntoMarkdown(versionTargetPath, targetPath, null, [], version, frameworkConfig);
    }
  }));

  // Sync locale folders
  await Promise.all(localeFolders.map(async (locale) => {
    const localeSourcePath = join(sourcePath, locale);
    const localeTargetPath = join(targetPath, locale);

    await ensureDir(localeTargetPath);
    await copy(localeSourcePath, localeTargetPath, {
      overwrite: true,
      filter: (src) => {
        // Only copy markdown/mdx files and directories
        return src.endsWith('.md') || src.endsWith('.mdx') || !src.includes('.');
      },
    });

    // Inject layout into locale markdown files (only for frameworks that need it)
    if (shouldInjectLayout) {
      await injectLayoutIntoMarkdown(localeTargetPath, targetPath, locale, [], null, frameworkConfig);
    }
  }));

  // Inject layout into default locale markdown files (only for frameworks that need it)
  if (shouldInjectLayout) {
    await injectLayoutIntoMarkdown(targetPath, targetPath, null, excludeFolders, null, frameworkConfig);
  }

  // Check for custom landing page conflict
  const hasUserIndex = ['index.md', 'index.mdx'].some(file =>
    pkg.existsSync(join(targetPath, file))
  );

  if (hasUserIndex) {
    const defaultIndexAstro = join(targetPath, 'index.astro');
    if (pkg.existsSync(defaultIndexAstro)) {
      await remove(defaultIndexAstro);
    }
  }

  // Sync user assets (images, css, static files)
  await syncUserAssets(sourcePath, projectDir);

  // Sync landing page (custom HTML/CSS/JS or sections)
  const docsConfig = await getDocsConfig(sourcePath);
  if (docsConfig.landing) {
    await syncLanding(sourcePath, projectDir, frameworkConfig, docsConfig);
  }

  // Trigger HMR for non-Astro frameworks (Vite-based)
  // Vite doesn't automatically watch content directories, so we need to trigger a reload
  if (frameworkConfig && frameworkConfig.name !== 'astro') {
    await triggerHMR(projectDir, frameworkConfig);
  }
}

/**
 * Sync user assets from docs folder to the Astro project
 */
async function syncUserAssets(sourcePath, projectDir) {
  const tasks = [];

  // Sync _assets folder to public/assets
  tasks.push((async () => {
    const assetsSource = join(sourcePath, '_assets');
    const assetsTarget = join(projectDir, 'public', 'assets');
    if (await pathExists(assetsSource)) {
      await ensureDir(assetsTarget);
      await copy(assetsSource, assetsTarget, { overwrite: true });
    }
  })());

  // Sync _images folder to public/images
  tasks.push((async () => {
    const imagesSource = join(sourcePath, '_images');
    const imagesTarget = join(projectDir, 'public', 'images');
    if (await pathExists(imagesSource)) {
      await ensureDir(imagesTarget);
      await copy(imagesSource, imagesTarget, { overwrite: true });
    }
  })());

  // Sync public folder to public root
  tasks.push((async () => {
    const publicSource = join(sourcePath, 'public');
    const publicTarget = join(projectDir, 'public');
    if (await pathExists(publicSource)) {
      await ensureDir(publicTarget);
      await copy(publicSource, publicTarget, { overwrite: true });
    }
  })());

  // Sync _css folder for custom styles
  tasks.push((async () => {
    const cssSource = join(sourcePath, '_css');
    const cssTarget = join(projectDir, 'src', 'styles');
    if (await pathExists(cssSource)) {
      await ensureDir(cssTarget);

      const cssTasks = [];

      // Copy custom.css if it exists
      const customCssSource = join(cssSource, 'custom.css');
      cssTasks.push((async () => {
        if (await pathExists(customCssSource)) {
          await copy(customCssSource, join(cssTarget, 'custom.css'), { overwrite: true });
        }
      })());

      // Copy theme.css override if it exists
      const themeOverrideSource = join(cssSource, 'theme.css');
      cssTasks.push((async () => {
        if (await pathExists(themeOverrideSource)) {
          await copy(themeOverrideSource, join(cssTarget, 'theme.css'), { overwrite: true });
        }
      })());

      // Copy any additional CSS files
      cssTasks.push((async () => {
        const cssFiles = await readdir(cssSource).catch(() => []);
        await Promise.all(cssFiles.map(async (file) => {
          if (file.endsWith('.css') && file !== 'custom.css' && file !== 'theme.css') {
            await copy(join(cssSource, file), join(cssTarget, file), { overwrite: true });
          }
        }));
      })());

      await Promise.all(cssTasks);
    }

    // Create/update custom.css import in global.css if custom.css exists
    const customCssPath = join(cssTarget, 'custom.css');
    const globalCssPath = join(cssTarget, 'global.css');

    if (await pathExists(customCssPath) && await pathExists(globalCssPath)) {
      let globalCss = await readFile(globalCssPath, 'utf-8');
      const customImport = '@import "./custom.css";';

      if (!globalCss.includes(customImport)) {
        // @import must come at the very top of the file (before @tailwind directives)
        // Only @charset can precede @import
        const lines = globalCss.split('\n');
        let insertIndex = 0;

        // Find position after @charset if it exists (only thing allowed before @import)
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith('@charset')) {
            insertIndex = i + 1;
            break;
          }
          // Stop at first non-empty, non-comment line
          if (trimmed && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('//')) {
            break;
          }
        }

        // Insert the import at the top (after @charset if present)
        lines.splice(insertIndex, 0, '/* User custom styles */', customImport, '');
        globalCss = lines.join('\n');
        await writeFile(globalCssPath, globalCss, 'utf-8');
      }
    }
  })());

  await Promise.all(tasks);
}

/**
 * Inject layout frontmatter into markdown files
 * @param {string} dir - Directory to process
 * @param {string} rootDir - Root pages directory
 * @param {string|null} locale - Current locale (null for default)
 * @param {string[]} skipFolders - Folders to skip (locale folders when processing root)
 * @param {string|null} version - Current version (null for non-versioned)
 * @param {object|null} frameworkConfig - Framework configuration for layout paths
 */
async function injectLayoutIntoMarkdown(dir, rootDir, locale = null, skipFolders = [], version = null, frameworkConfig = null) {
  const entries = await readdir(dir, { withFileTypes: true });

  // Get layout paths from framework config or use defaults
  const baseLayoutPath = frameworkConfig?.layoutPath || 'layouts/MarkdownLayout.astro';
  const apiLayoutPath = frameworkConfig?.apiLayoutPath || 'layouts/APILayout.astro';

  await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip locale folders when processing root
      if (skipFolders.includes(entry.name)) {
        return;
      }
      await injectLayoutIntoMarkdown(fullPath, rootDir, locale, [], version, frameworkConfig);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      let content = await readFile(fullPath, 'utf-8');

      // Calculate relative path to layout
      const relPath = relative(rootDir, fullPath);
      const depth = relPath.split(sep).length - 1;
      const layoutPath = '../'.repeat(depth + 1) + baseLayoutPath;

      // Check if file already has frontmatter
      if (content.startsWith('---')) {
        const endOfFrontmatter = content.indexOf('---', 3);
        if (endOfFrontmatter !== -1) {
          let frontmatterBlock = content.substring(3, endOfFrontmatter).trim();
          const body = content.substring(endOfFrontmatter + 3);

          // Determine which layout to use
          let targetLayout = layoutPath;
          if (frontmatterBlock.includes('api:')) {
            targetLayout = '../'.repeat(depth + 1) + apiLayoutPath;
          }

          // Add locale to frontmatter if present
          if (locale && !frontmatterBlock.includes('lang:')) {
            frontmatterBlock = `lang: ${locale}\n${frontmatterBlock}`;
          }

          // Add version to frontmatter if present
          if (version && !frontmatterBlock.includes('docVersion:')) {
            frontmatterBlock = `docVersion: ${version}\n${frontmatterBlock}`;
          }

          // Check if layout is already specified
          if (!frontmatterBlock.includes('layout:')) {
            content = `---\n${frontmatterBlock}\nlayout: ${targetLayout}\n---${body}`;
          } else {
            content = `---\n${frontmatterBlock}\n---${body}`;
          }
        }
      } else {
        // No frontmatter, add minimal frontmatter with layout
        const title = entry.name.replace(/\.(md|mdx)$/, '').replace(/-/g, ' ');
        const langLine = locale ? `lang: ${locale}\n` : '';
        const versionLine = version ? `docVersion: ${version}\n` : '';
        content = `---\n${langLine}${versionLine}title: ${title}\nlayout: ${layoutPath}\n---\n\n${content}`;
      }

      await writeFile(fullPath, content, 'utf-8');
    }
  }));
}

/**
 * Trigger HMR for Vite-based frameworks
 * Vite watches certain files for changes - we touch a trigger file to force a reload
 * @param {string} projectDir - Project directory
 * @param {object} frameworkConfig - Framework configuration
 */
async function triggerHMR(projectDir, frameworkConfig) {
  // Use framework-specific HMR trigger file if defined
  const triggerFilePath = frameworkConfig.hmrTriggerFile
    ? join(projectDir, frameworkConfig.hmrTriggerFile)
    : join(projectDir, 'src', '.lito-hmr-trigger.js');

  try {
    // Ensure parent directory exists
    await ensureDir(join(projectDir, 'src'));

    // Write a timestamp to the trigger file
    // This file should be imported in the app's entry point
    const timestamp = Date.now();
    const content = `// Auto-generated by Lito CLI for HMR triggering
// This file is updated when docs content changes
// Import this file in your app's entry point to enable content hot reload
export const LITO_CONTENT_VERSION = ${timestamp};
export const LITO_LAST_UPDATE = "${new Date().toISOString()}";

// Force Vite to treat this as a module that triggers HMR
if (import.meta.hot) {
  import.meta.hot.accept();
}
`;

    await writeFile(triggerFilePath, content, 'utf-8');
  } catch {
    // Fallback: Touch the main entry file or vite config
    const fallbackFiles = [
      join(projectDir, 'src', 'main.jsx'),
      join(projectDir, 'src', 'main.tsx'),
      join(projectDir, 'src', 'App.jsx'),
      join(projectDir, 'src', 'App.tsx'),
      join(projectDir, 'src', 'index.jsx'),
      join(projectDir, 'src', 'index.tsx'),
    ];

    for (const file of fallbackFiles) {
      if (await pathExists(file)) {
        try {
          // Touch the file by updating its mtime
          const now = new Date();
          await utimes(file, now, now);
          break;
        } catch {
          // Continue to next file
        }
      }
    }
  }
}
