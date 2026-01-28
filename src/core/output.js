import pkg from 'fs-extra';
const { copy, ensureDir } = pkg;
import { join } from 'path';

/**
 * Copy built output to the specified output path
 * @param {string} projectDir - The scaffolded project directory
 * @param {string} outputPath - User's desired output path
 * @param {string} buildOutputDir - Framework's build output directory (default: 'dist')
 */
export async function copyOutput(projectDir, outputPath, buildOutputDir = 'dist') {
  const distPath = join(projectDir, buildOutputDir);

  // Ensure output directory exists
  await ensureDir(outputPath);

  // Copy built files to output
  await copy(distPath, outputPath, {
    overwrite: true,
  });
}
