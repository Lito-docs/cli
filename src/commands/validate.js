import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { intro, outro, log, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { validateConfig, isPortableConfig, getCoreConfigKeys, getExtensionKeys } from '../core/config-validator.js';
import { lintContent } from '../core/content-linter.js';
import { checkLinks } from '../core/link-checker.js';

/**
 * Validate command - Validate docs-config.json
 */
export async function validateCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : process.cwd();
    const configPath = join(inputPath, 'docs-config.json');

    const runContent = options.content || options.all;
    const runLinks = options.links || options.all;
    const strict = options.strict || false;

    // Quick mode for CI - just exit with code
    if (options.quiet) {
      let hasErrors = false;

      // Config validation
      if (!existsSync(configPath)) {
        process.exit(1);
      }
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const result = validateConfig(config, inputPath, { silent: true });
        if (!result.valid) hasErrors = true;

        // Content linting
        if (runContent) {
          const lint = await lintContent(inputPath, { config });
          const hasLintErrors = lint.issues.some(i => i.severity === 'error');
          const hasLintWarnings = lint.issues.some(i => i.severity === 'warning');
          if (hasLintErrors || (strict && hasLintWarnings)) hasErrors = true;
        }

        // Link checking
        if (runLinks) {
          const linkResult = await checkLinks(inputPath);
          if (linkResult.brokenLinks.length > 0) hasErrors = true;
        }
      } catch (e) {
        hasErrors = true;
      }

      process.exit(hasErrors ? 1 : 0);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Validate Configuration ')));

    const s = spinner();

    // ── Config validation ──
    s.start('Looking for docs-config.json...');

    if (!existsSync(configPath)) {
      s.stop(pc.red('Configuration file not found'));
      log.error(`No docs-config.json found at ${pc.cyan(inputPath)}`);
      log.message('');
      log.message(`Run ${pc.cyan('lito init')} to create a new project with a config file.`);
      process.exit(1);
    }

    s.stop(`Found: ${pc.cyan(configPath)}`);

    // Parse JSON
    s.start('Parsing configuration...');
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
      s.stop('Configuration parsed');
    } catch (parseError) {
      s.stop(pc.red('Invalid JSON'));
      log.error('Failed to parse docs-config.json:');
      log.error(pc.red(parseError.message));
      process.exit(1);
    }

    // Validate
    s.start('Validating configuration...');
    const result = validateConfig(config, inputPath, { silent: true });

    if (!result.valid) {
      s.stop(pc.red('Validation failed'));
      log.message('');
      log.error(pc.bold('Configuration errors:'));
      for (const error of result.errors) {
        log.error(`  ${pc.red('•')} ${pc.yellow(error.path)}: ${error.message}`);
      }
      log.message('');
      process.exit(1);
    }

    s.stop(pc.green('Configuration is valid'));

    // Show summary
    log.message('');
    log.success(pc.bold('Configuration Summary:'));
    log.message('');

    // Metadata
    if (config.metadata) {
      log.message(`  ${pc.cyan('Name:')} ${config.metadata.name || pc.dim('(not set)')}`);
      if (config.metadata.description) {
        log.message(`  ${pc.cyan('Description:')} ${config.metadata.description}`);
      }
    }

    // Navigation
    if (config.navigation) {
      const sidebarGroups = config.navigation.sidebar?.length || 0;
      const navbarLinks = config.navigation.navbar?.links?.length || 0;
      log.message(`  ${pc.cyan('Sidebar groups:')} ${sidebarGroups}`);
      log.message(`  ${pc.cyan('Navbar links:')} ${navbarLinks}`);
    }

    // Features
    log.message('');
    log.message(pc.bold('  Features:'));
    log.message(`    ${config.search?.enabled ? pc.green('✓') : pc.dim('○')} Search`);
    log.message(`    ${config.i18n?.enabled ? pc.green('✓') : pc.dim('○')} i18n`);
    log.message(`    ${config.versioning?.enabled ? pc.green('✓') : pc.dim('○')} Versioning`);

    // Portability check
    log.message('');
    const portable = isPortableConfig(config);
    if (portable) {
      log.message(`  ${pc.green('✓')} ${pc.dim('Portable config (works with any template)')}`);
    } else {
      const usedExtensions = getExtensionKeys().filter(key => key in config);
      log.message(`  ${pc.yellow('!')} ${pc.dim(`Uses template extensions: ${usedExtensions.join(', ')}`)}`);
    }

    log.message('');

    // Track if any checks failed
    let hasFailure = false;

    // ── Content linting ──
    if (runContent) {
      log.message(pc.dim('─'.repeat(50)));
      log.message('');
      s.start('Linting documentation content...');

      const lint = await lintContent(inputPath, { config });

      const errors = lint.issues.filter(i => i.severity === 'error');
      const warnings = lint.issues.filter(i => i.severity === 'warning');

      if (lint.issues.length === 0) {
        s.stop(pc.green(`Content is clean (${lint.totalFiles} files checked)`));
      } else {
        s.stop(pc.yellow(`Found ${lint.issues.length} issue(s) in ${lint.totalFiles} files`));
        log.message('');

        if (errors.length > 0) {
          log.error(pc.bold(`Errors (${errors.length}):`));
          for (const issue of errors) {
            log.error(`  ${pc.red('✗')} ${pc.cyan(issue.file)}: ${issue.message} ${pc.dim(`[${issue.rule}]`)}`);
          }
          log.message('');
          hasFailure = true;
        }

        if (warnings.length > 0) {
          log.warn(pc.bold(`Warnings (${warnings.length}):`));
          for (const issue of warnings) {
            log.warn(`  ${pc.yellow('!')} ${pc.cyan(issue.file)}: ${issue.message} ${pc.dim(`[${issue.rule}]`)}`);
          }
          log.message('');
          if (strict) hasFailure = true;
        }
      }
    }

    // ── Link checking ──
    if (runLinks) {
      log.message(pc.dim('─'.repeat(50)));
      log.message('');
      s.start('Checking for broken links...');

      const linkResult = await checkLinks(inputPath);

      if (linkResult.brokenLinks.length === 0) {
        s.stop(pc.green(`All ${linkResult.totalLinks} links are valid (${linkResult.checkedFiles} files)`));
      } else {
        s.stop(pc.yellow(`Found ${linkResult.brokenLinks.length} broken link(s)`));
        log.message('');

        // Group by file
        const byFile = new Map();
        for (const bl of linkResult.brokenLinks) {
          if (!byFile.has(bl.file)) byFile.set(bl.file, []);
          byFile.get(bl.file).push(bl);
        }

        for (const [file, links] of byFile) {
          log.message(`  ${pc.bold(pc.cyan(file))}`);
          for (const bl of links) {
            const label = bl.text ? ` (${pc.dim(bl.text)})` : '';
            log.message(`    ${pc.red('✗')} ${bl.link}${label}`);
            if (bl.suggestion) {
              log.message(`      ${pc.dim('Did you mean:')} ${pc.green(bl.suggestion)}`);
            }
          }
        }
        log.message('');
        hasFailure = true;
      }
    }

    if (hasFailure) {
      outro(pc.red('Validation complete with errors'));
      process.exit(1);
    } else {
      outro(pc.green('Validation complete!'));
    }
  } catch (error) {
    log.error(pc.red(error.message));
    if (error.stack && !options.quiet) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
