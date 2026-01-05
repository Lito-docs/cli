import pkg from 'fs-extra';
const { readFile, writeFile, pathExists } = pkg;
import { join } from 'path';
import { readdir } from 'fs/promises';
import { validateConfig } from './config-validator.js';

/**
 * Auto-generates navigation structure from docs folder
 */
export async function generateNavigationFromDocs(docsPath) {
  const sidebar = [];

  try {
    const entries = await readdir(docsPath, { withFileTypes: true });

    // Group files by directory
    const groups = new Map();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirName = entry.name;
        const dirPath = join(docsPath, dirName);
        const files = await readdir(dirPath);

        const items = files
          .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
          .map(f => ({
            label: formatLabel(f.replace(/\.(md|mdx)$/, '')),
            slug: `${dirName}/${f.replace(/\.(md|mdx)$/, '')}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        if (items.length > 0) {
          groups.set(dirName, {
            label: formatLabel(dirName),
            items,
          });
        }
      }
    }

    // Add root-level files
    const rootFiles = entries
      .filter(e => e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.mdx')) && e.name !== 'index.md')
      .map(e => ({
        label: formatLabel(e.name.replace(/\.(md|mdx)$/, '')),
        slug: e.name.replace(/\.(md|mdx)$/, ''),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (rootFiles.length > 0) {
      sidebar.push({
        label: 'Getting Started',
        icon: 'lucide:rocket',
        items: rootFiles,
      });
    }

    // Add directory groups sorted alphabetically
    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
    for (const group of sortedGroups) {
      sidebar.push(group);
    }

  } catch (error) {
    console.warn('Could not auto-generate navigation:', error.message);
  }

  return sidebar;
}

/**
 * Merges user config with auto-generated navigation
 * @param {object} options - Sync options
 * @param {boolean} options.validate - Whether to validate the config (default: true)
 */
export async function syncDocsConfig(projectDir, docsPath, userConfigPath, options = {}) {
  const { validate = true } = options;
  const configPath = join(projectDir, 'docs-config.json');

  // Read base config from template
  let config = JSON.parse(await readFile(configPath, 'utf-8'));

  // If user has a custom config, merge it
  if (userConfigPath && await pathExists(userConfigPath)) {
    const userConfig = JSON.parse(await readFile(userConfigPath, 'utf-8'));

    // Validate user config before merging (only core config is validated)
    if (validate) {
      const validationResult = validateConfig(userConfig, projectDir);
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map(e => `${e.path}: ${e.message}`).join('\n  ');
        throw new Error(`Configuration validation failed:\n  ${errorMessages}`);
      }
    }

    config = deepMerge(config, userConfig);
  }

  // Auto-generate navigation if not provided
  if (!config.navigation?.sidebar || config.navigation.sidebar.length === 0) {
    config.navigation.sidebar = await generateNavigationFromDocs(docsPath);
  }

  // Write merged config
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

  return { config };
}

function formatLabel(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    // Arrays should be replaced, not merged
    if (Array.isArray(source[key])) {
      output[key] = source[key];
    } else if (source[key] instanceof Object && key in target && !Array.isArray(target[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}
