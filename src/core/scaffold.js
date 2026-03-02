import pkg from 'fs-extra';
const { ensureDir, emptyDir, copy, remove } = pkg;
import { homedir } from 'os';
import { join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { platform } from 'os';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base directory for all dev projects
const LITO_PROJECTS_DIR = join(homedir(), '.lito', 'dev-projects');

// Legacy single dev-project path (for migration cleanup)
const LEGACY_DIR = join(homedir(), '.lito', 'dev-project');

/**
 * Derive a short, unique directory name from an input path.
 * e.g. /home/user/my-docs → "my-docs-a1b2c3"
 */
function getProjectSlug(inputPath) {
  const resolved = resolve(inputPath);
  const hash = createHash('md5').update(resolved).digest('hex').slice(0, 8);
  const name = basename(resolved).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${name}-${hash}`;
}

/**
 * Get the project directory for a given input path.
 */
export function getProjectDir(inputPath) {
  const slug = getProjectSlug(inputPath);
  return join(LITO_PROJECTS_DIR, slug);
}

/**
 * Kill stale processes spawned from a specific project directory (Windows).
 * On Windows, .bin/*.exe files stay locked if a previous dev server
 * wasn't shut down cleanly. This finds and kills those processes.
 */
function killStaleProcesses(projectDir) {
  if (platform() !== 'win32') return;

  try {
    // Escape backslashes for WMIC LIKE pattern
    const escapedPath = projectDir.replace(/\\/g, '\\\\');
    const cmd = `wmic process where "ExecutablePath like '%${escapedPath}%'" get ProcessId /format:list 2>nul`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    const pids = output.match(/ProcessId=(\d+)/g);
    if (pids) {
      for (const match of pids) {
        const pid = match.split('=')[1];
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
        } catch { /* process may already be gone */ }
      }
      // Brief wait for OS to release file handles
      execSync('timeout /t 1 /nobreak >nul 2>&1', { timeout: 3000 });
    }
  } catch { /* wmic/taskkill not available or no matching processes */ }
}

/**
 * Safely empty a directory.
 * Retries with stale process cleanup on EPERM (Windows file lock).
 */
async function safeEmptyDir(dir) {
  try {
    await emptyDir(dir);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      killStaleProcesses(dir);

      // Retry — remove entirely then recreate
      try {
        await remove(dir);
      } catch { /* ignore */ }
      await ensureDir(dir);
    } else {
      throw err;
    }
  }
}

/**
 * Clean up the legacy single dev-project directory if it exists.
 */
async function cleanupLegacyDir() {
  try {
    await remove(LEGACY_DIR);
  } catch { /* ignore — may not exist or may be locked */ }
}

export async function scaffoldProject(customTemplatePath = null, inputPath = null) {
  const projectDir = inputPath ? getProjectDir(inputPath) : join(LITO_PROJECTS_DIR, '_default');

  await ensureDir(projectDir);
  await safeEmptyDir(projectDir);

  // Clean up legacy directory from older CLI versions
  await cleanupLegacyDir();

  const templatePath = customTemplatePath || join(__dirname, '../template');
  await copy(templatePath, projectDir, {
    filter: (src) => {
      const name = basename(src);

      // Exclude node_modules directory
      if (name === 'node_modules') return false;

      // Exclude lock files
      if (name === 'pnpm-lock.yaml' || name === 'bun.lock' ||
        name === 'package-lock.json' || name === 'yarn.lock') return false;

      // Exclude .astro cache directory (but NOT .astro component files)
      if (name === '.astro') return false;

      return true;
    }
  });

  return projectDir;
}

// Cleanup function to remove a specific project directory on exit
export async function cleanupProject(projectDir) {
  if (!projectDir) return;

  try {
    await remove(projectDir);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EBUSY') {
      killStaleProcesses(projectDir);
      try {
        await remove(projectDir);
      } catch { /* best-effort cleanup */ }
    }
  }
}
