import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { intro, outro, log, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { validateConfig, isPortableConfig, getCoreConfigKeys, getExtensionKeys } from '../core/config-validator.js';

/**
 * Validate command - Validate docs-config.json
 */
export async function validateCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : process.cwd();
    const configPath = join(inputPath, 'docs-config.json');

    // Quick mode for CI - just exit with code
    if (options.quiet) {
      if (!existsSync(configPath)) {
        process.exit(1);
      }
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const result = validateConfig(config, inputPath, { silent: true });
        process.exit(result.valid ? 0 : 1);
      } catch (e) {
        process.exit(1);
      }
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Validate Configuration ')));

    const s = spinner();

    // Check if config file exists
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
    outro(pc.green('Validation complete!'));
  } catch (error) {
    log.error(pc.red(error.message));
    if (error.stack && !options.quiet) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
