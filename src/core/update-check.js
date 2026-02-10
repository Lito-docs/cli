import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pc from 'picocolors';
import { confirm } from '@clack/prompts';

const execAsync = promisify(exec);

const PACKAGE_NAME = '@litodocs/cli';

/**
 * Get the current installed version from package.json
 */
export function getCurrentVersion() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}

/**
 * Fetch the latest version from npm registry
 */
async function getLatestVersion() {
  try {
    const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version`, {
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Compare two semver versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Upgrade the package using the detected package manager
 */
async function upgradePackage() {
  const packageManagers = ['pnpm', 'yarn', 'npm'];

  for (const pm of packageManagers) {
    try {
      await execAsync(`${pm} --version`, { timeout: 2000 });

      console.log(pc.cyan(`\nUpgrading using ${pm}...`));

      const command = pm === 'yarn'
        ? `yarn global add ${PACKAGE_NAME}@latest`
        : `${pm} install -g ${PACKAGE_NAME}@latest`;

      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      if (stdout) console.log(stdout);

      console.log(pc.green(`\n✓ Successfully upgraded ${PACKAGE_NAME}!`));
      console.log(pc.dim('Please restart your terminal or run the command again.\n'));
      return true;
    } catch {
      continue;
    }
  }

  console.log(pc.yellow('\nCould not auto-upgrade. Please run manually:'));
  console.log(pc.cyan(`  npm install -g ${PACKAGE_NAME}@latest\n`));
  return false;
}

/**
 * Check for updates and prompt user to upgrade
 */
export async function checkForUpdates() {
  try {
    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion();

    if (!latestVersion) {
      return; // Silently fail if we can't check
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      console.log('');
      console.log(pc.yellow('╭─────────────────────────────────────────────────╮'));
      console.log(pc.yellow('│') + '  Update available! ' + pc.dim(`${currentVersion}`) + ' → ' + pc.green(`${latestVersion}`) + pc.yellow('            │'));
      console.log(pc.yellow('│') + pc.dim(`  Run: lito upgrade`) + pc.yellow('                              │'));
      console.log(pc.yellow('╰─────────────────────────────────────────────────╯'));
      console.log('');
    }
  } catch {
    // Silently fail - don't interrupt the user's workflow
  }
}

/**
 * Upgrade command handler
 */
export async function upgradeCommand() {
  console.log(pc.cyan('\n🔍 Checking for updates...\n'));

  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();

  if (!latestVersion) {
    console.log(pc.yellow('Could not check for updates. Please check your internet connection.\n'));
    return;
  }

  console.log(`  Current version: ${pc.dim(currentVersion)}`);
  console.log(`  Latest version:  ${pc.green(latestVersion)}\n`);

  if (compareVersions(latestVersion, currentVersion) <= 0) {
    console.log(pc.green('✓ You are already on the latest version!\n'));
    return;
  }

  const shouldUpgrade = await confirm({
    message: `Upgrade from ${currentVersion} to ${latestVersion}?`,
    initialValue: true,
  });

  if (shouldUpgrade) {
    await upgradePackage();
  } else {
    console.log(pc.dim('\nUpgrade cancelled.\n'));
  }
}
