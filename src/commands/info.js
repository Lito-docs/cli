import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import { intro, outro, log } from '@clack/prompts';
import pc from 'picocolors';
import { TEMPLATE_REGISTRY } from '../core/template-registry.js';
import { getCoreConfigKeys, getExtensionKeys, isPortableConfig } from '../core/config-validator.js';

/**
 * Info command - Show project information
 */
export async function infoCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : process.cwd();
    const configPath = join(inputPath, 'docs-config.json');

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Project Info ')));

    log.message(pc.dim(`Path: ${inputPath}`));
    log.message('');

    // Check if config exists
    if (!existsSync(configPath)) {
      log.warn('No docs-config.json found in this directory.');
      log.message('');
      log.message(`Run ${pc.cyan('lito init')} to create a new project.`);
      outro('');
      return;
    }

    // Parse config
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (e) {
      log.error(`Failed to parse docs-config.json: ${e.message}`);
      process.exit(1);
    }

    // Project info
    log.message(pc.bold('📦 Project'));
    log.message(`  ${pc.cyan('Name:')} ${config.metadata?.name || pc.dim('(not set)')}`);
    if (config.metadata?.description) {
      log.message(`  ${pc.cyan('Description:')} ${config.metadata.description}`);
    }
    log.message('');

    // Content stats
    const stats = getContentStats(inputPath);
    log.message(pc.bold('📄 Content'));
    log.message(`  ${pc.cyan('Markdown files:')} ${stats.mdFiles}`);
    log.message(`  ${pc.cyan('MDX files:')} ${stats.mdxFiles}`);
    log.message(`  ${pc.cyan('Total pages:')} ${stats.mdFiles + stats.mdxFiles}`);
    if (stats.directories > 0) {
      log.message(`  ${pc.cyan('Subdirectories:')} ${stats.directories}`);
    }
    log.message('');

    // Navigation
    if (config.navigation) {
      log.message(pc.bold('🧭 Navigation'));
      const sidebarGroups = config.navigation.sidebar?.length || 0;
      const sidebarItems = config.navigation.sidebar?.reduce(
        (acc, g) => acc + (g.items?.length || 0),
        0
      ) || 0;
      const navbarLinks = config.navigation.navbar?.links?.length || 0;

      log.message(`  ${pc.cyan('Sidebar groups:')} ${sidebarGroups}`);
      log.message(`  ${pc.cyan('Sidebar items:')} ${sidebarItems}`);
      log.message(`  ${pc.cyan('Navbar links:')} ${navbarLinks}`);
      log.message('');
    }

    // Features
    log.message(pc.bold('⚡ Features'));
    const features = [
      { name: 'Search', enabled: config.search?.enabled },
      { name: 'i18n', enabled: config.i18n?.enabled },
      { name: 'Versioning', enabled: config.versioning?.enabled },
      { name: 'Dark Mode', enabled: config.theme?.darkMode !== false },
    ];

    for (const feature of features) {
      const icon = feature.enabled ? pc.green('✓') : pc.dim('○');
      log.message(`  ${icon} ${feature.name}`);
    }
    log.message('');

    // Branding
    if (config.branding) {
      log.message(pc.bold('🎨 Branding'));
      if (config.branding.logo) {
        const logo = config.branding.logo;
        if (typeof logo === 'string') {
          log.message(`  ${pc.cyan('Logo:')} ${logo}`);
        } else if (logo.light || logo.dark) {
          log.message(`  ${pc.cyan('Logo:')} ${logo.light || logo.dark} ${logo.light && logo.dark ? '(light/dark)' : ''}`);
        }
      }
      if (config.branding.favicon) {
        log.message(`  ${pc.cyan('Favicon:')} ${config.branding.favicon}`);
      }
      if (config.branding.colors?.primary) {
        log.message(`  ${pc.cyan('Primary color:')} ${config.branding.colors.primary}`);
      }
      if (config.branding.colors?.accent) {
        log.message(`  ${pc.cyan('Accent color:')} ${config.branding.colors.accent}`);
      }
      log.message('');
    }

    // Config compatibility
    log.message(pc.bold('🔧 Configuration'));
    const portable = isPortableConfig(config);
    const usedCoreKeys = getCoreConfigKeys().filter((k) => k in config);
    const usedExtKeys = getExtensionKeys().filter((k) => k in config);

    log.message(`  ${pc.cyan('Core keys:')} ${usedCoreKeys.join(', ') || 'none'}`);
    if (usedExtKeys.length > 0) {
      log.message(`  ${pc.cyan('Extension keys:')} ${usedExtKeys.join(', ')}`);
    }
    log.message(
      `  ${pc.cyan('Portable:')} ${portable ? pc.green('Yes') : pc.yellow('No (uses extensions)')}`
    );
    log.message('');

    // Available templates
    log.message(pc.bold('📋 Available Templates'));
    for (const [name, source] of Object.entries(TEMPLATE_REGISTRY)) {
      log.message(`  ${pc.cyan(name)}: ${pc.dim(source)}`);
    }
    log.message('');

    // CLI info
    log.message(pc.bold('🔧 Environment'));
    log.message(`  ${pc.cyan('Node.js:')} ${process.version}`);
    log.message(`  ${pc.cyan('Platform:')} ${process.platform}`);

    const cacheDir = join(process.env.HOME || '~', '.lito', 'templates');
    if (existsSync(cacheDir)) {
      const cached = readdirSync(cacheDir).length;
      log.message(`  ${pc.cyan('Cached templates:')} ${cached}`);
    }

    outro('');
  } catch (error) {
    log.error(pc.red(error.message));
    process.exit(1);
  }
}

/**
 * Get content statistics for a docs directory
 */
function getContentStats(inputPath) {
  const stats = {
    mdFiles: 0,
    mdxFiles: 0,
    directories: 0,
  };

  function scan(dir) {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        // Skip special directories
        if (entry.startsWith('_') || entry.startsWith('.') || entry === 'node_modules') {
          continue;
        }

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          stats.directories++;
          scan(fullPath);
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (ext === '.md') stats.mdFiles++;
          if (ext === '.mdx') stats.mdxFiles++;
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  scan(inputPath);
  return stats;
}
