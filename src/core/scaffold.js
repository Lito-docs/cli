import pkg from 'fs-extra';
const { ensureDir, emptyDir, copy, remove } = pkg;
import { homedir } from 'os';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use a directory under the user's home to avoid resolution issues
// with bundlers (e.g. Turbopack) that fail to resolve node_modules from /tmp
const LITO_DIR = join(homedir(), '.lito', 'dev-project');

export async function scaffoldProject(customTemplatePath = null) {
  // Ensure the directory exists (creates if it doesn't)
  await ensureDir(LITO_DIR);

  // Empty the directory to ensure a clean state
  await emptyDir(LITO_DIR);

  const tempDir = LITO_DIR;

  // Use custom template path if provided, otherwise use bundled template
  const templatePath = customTemplatePath || join(__dirname, '../template');
  await copy(templatePath, tempDir, {
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

  return tempDir;
}

// Cleanup function to remove the temp directory on exit
export async function cleanupProject() {
  try {
    await remove(LITO_DIR);
  } catch (error) {
    // Ignore errors during cleanup (directory might not exist)
  }
}
