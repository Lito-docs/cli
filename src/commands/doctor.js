import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import { intro, outro, log, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { validateConfig } from '../core/config-validator.js';
import { TEMPLATE_REGISTRY } from '../core/template-registry.js';

/**
 * Check result types
 */
const CHECK_PASS = 'pass';
const CHECK_WARN = 'warn';
const CHECK_FAIL = 'fail';

/**
 * Doctor command - Diagnose common issues
 */
export async function doctorCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : process.cwd();

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Doctor ')));

    log.message(pc.dim(`Checking: ${inputPath}`));
    log.message('');

    const checks = [];

    // Check 1: Directory exists
    checks.push(await checkDirectoryExists(inputPath));

    // Check 2: docs-config.json exists
    checks.push(await checkConfigExists(inputPath));

    // Check 3: Config is valid JSON
    const configCheck = await checkConfigValid(inputPath);
    checks.push(configCheck);

    // Check 4: Config passes validation
    if (configCheck.status === CHECK_PASS) {
      checks.push(await checkConfigSchema(inputPath));
    }

    // Check 5: Content files exist
    checks.push(await checkContentFiles(inputPath));

    // Check 6: Check for common issues
    checks.push(await checkCommonIssues(inputPath));

    // Check 7: Template cache
    checks.push(await checkTemplateCache());

    // Check 8: Node.js version
    checks.push(await checkNodeVersion());

    // Print results
    log.message('');
    log.message(pc.bold('Diagnostic Results:'));
    log.message('');

    let hasErrors = false;
    let hasWarnings = false;

    for (const check of checks) {
      const icon =
        check.status === CHECK_PASS
          ? pc.green('✓')
          : check.status === CHECK_WARN
          ? pc.yellow('!')
          : pc.red('✗');

      log.message(`  ${icon} ${check.name}`);

      if (check.message) {
        log.message(`    ${pc.dim(check.message)}`);
      }

      if (check.status === CHECK_FAIL) hasErrors = true;
      if (check.status === CHECK_WARN) hasWarnings = true;
    }

    log.message('');

    // Summary
    if (hasErrors) {
      log.error(pc.red('Some checks failed. Please fix the issues above.'));
      process.exit(1);
    } else if (hasWarnings) {
      log.warn(pc.yellow('Some warnings found. Your project should still work.'));
      outro(pc.yellow('Doctor completed with warnings'));
    } else {
      log.success(pc.green('All checks passed!'));
      outro(pc.green('Your project looks healthy! 🎉'));
    }
  } catch (error) {
    log.error(pc.red(error.message));
    process.exit(1);
  }
}

async function checkDirectoryExists(inputPath) {
  if (!existsSync(inputPath)) {
    return {
      name: 'Directory exists',
      status: CHECK_FAIL,
      message: `Directory not found: ${inputPath}`,
    };
  }

  const stat = statSync(inputPath);
  if (!stat.isDirectory()) {
    return {
      name: 'Directory exists',
      status: CHECK_FAIL,
      message: `Path is not a directory: ${inputPath}`,
    };
  }

  return {
    name: 'Directory exists',
    status: CHECK_PASS,
  };
}

async function checkConfigExists(inputPath) {
  const configPath = join(inputPath, 'docs-config.json');

  if (!existsSync(configPath)) {
    return {
      name: 'docs-config.json exists',
      status: CHECK_FAIL,
      message: `Run 'lito init' to create a configuration file`,
    };
  }

  return {
    name: 'docs-config.json exists',
    status: CHECK_PASS,
  };
}

async function checkConfigValid(inputPath) {
  const configPath = join(inputPath, 'docs-config.json');

  if (!existsSync(configPath)) {
    return {
      name: 'Config is valid JSON',
      status: CHECK_WARN,
      message: 'Skipped (no config file)',
    };
  }

  try {
    JSON.parse(readFileSync(configPath, 'utf-8'));
    return {
      name: 'Config is valid JSON',
      status: CHECK_PASS,
    };
  } catch (e) {
    return {
      name: 'Config is valid JSON',
      status: CHECK_FAIL,
      message: e.message,
    };
  }
}

async function checkConfigSchema(inputPath) {
  const configPath = join(inputPath, 'docs-config.json');

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const result = validateConfig(config, inputPath, { silent: true });

    if (!result.valid) {
      return {
        name: 'Config passes validation',
        status: CHECK_FAIL,
        message: result.errors.map((e) => e.message).join('; '),
      };
    }

    return {
      name: 'Config passes validation',
      status: CHECK_PASS,
    };
  } catch (e) {
    return {
      name: 'Config passes validation',
      status: CHECK_WARN,
      message: 'Could not validate',
    };
  }
}

async function checkContentFiles(inputPath) {
  try {
    const files = readdirSync(inputPath);
    const contentFiles = files.filter((f) => {
      const ext = extname(f).toLowerCase();
      return ['.md', '.mdx'].includes(ext);
    });

    if (contentFiles.length === 0) {
      return {
        name: 'Content files exist',
        status: CHECK_WARN,
        message: 'No .md or .mdx files found in root directory',
      };
    }

    return {
      name: 'Content files exist',
      status: CHECK_PASS,
      message: `Found ${contentFiles.length} content file(s)`,
    };
  } catch (e) {
    return {
      name: 'Content files exist',
      status: CHECK_WARN,
      message: 'Could not read directory',
    };
  }
}

async function checkCommonIssues(inputPath) {
  const issues = [];

  // Check for node_modules in docs folder (shouldn't be there)
  if (existsSync(join(inputPath, 'node_modules'))) {
    issues.push('node_modules folder found in docs (should be removed)');
  }

  // Check for package.json in docs folder (might cause conflicts)
  if (existsSync(join(inputPath, 'package.json'))) {
    issues.push('package.json in docs folder (may cause conflicts)');
  }

  // Check for .git in docs folder
  if (existsSync(join(inputPath, '.git'))) {
    issues.push('.git folder in docs (unusual structure)');
  }

  if (issues.length > 0) {
    return {
      name: 'No common issues',
      status: CHECK_WARN,
      message: issues.join('; '),
    };
  }

  return {
    name: 'No common issues',
    status: CHECK_PASS,
  };
}

async function checkTemplateCache() {
  const cacheDir = join(process.env.HOME || '~', '.lito', 'templates');

  if (!existsSync(cacheDir)) {
    return {
      name: 'Template cache',
      status: CHECK_PASS,
      message: 'No cached templates',
    };
  }

  try {
    const cached = readdirSync(cacheDir);
    return {
      name: 'Template cache',
      status: CHECK_PASS,
      message: `${cached.length} template(s) cached`,
    };
  } catch (e) {
    return {
      name: 'Template cache',
      status: CHECK_WARN,
      message: 'Could not read cache directory',
    };
  }
}

async function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major < 18) {
    return {
      name: 'Node.js version',
      status: CHECK_FAIL,
      message: `Node.js 18+ required (found ${version})`,
    };
  }

  if (major < 20) {
    return {
      name: 'Node.js version',
      status: CHECK_WARN,
      message: `Node.js 20+ recommended (found ${version})`,
    };
  }

  return {
    name: 'Node.js version',
    status: CHECK_PASS,
    message: version,
  };
}
