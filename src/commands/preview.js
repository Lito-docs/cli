import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { intro, log, spinner, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import { execa } from 'execa';

/**
 * Preview command - Build and preview production site locally
 */
export async function previewCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : null;
    const outputPath = resolve(options.output || './dist');
    const port = options.port || '4321';

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Preview Production Build ')));

    const s = spinner();

    // Check if dist exists, if not run build first
    if (!existsSync(outputPath)) {
      if (!inputPath) {
        log.error(`Output directory ${pc.cyan(outputPath)} does not exist.`);
        log.message('');
        log.message('Either:');
        log.message(`  1. Run ${pc.cyan('lito build -i <docs>')} first`);
        log.message(`  2. Use ${pc.cyan('lito preview -i <docs>')} to build and preview`);
        process.exit(1);
      }

      log.warn(`Output directory not found. Building first...`);
      log.message('');

      // Run build command
      const { buildCommand } = await import('./build.js');
      await buildCommand({
        input: inputPath,
        output: outputPath,
        template: options.template || 'default',
        baseUrl: options.baseUrl || '/',
        provider: 'static',
      });

      console.clear();
      intro(pc.inverse(pc.cyan(' Lito - Preview Production Build ')));
    }

    // Check for index.html in output
    const indexPath = join(outputPath, 'index.html');
    if (!existsSync(indexPath)) {
      log.error(`No index.html found in ${pc.cyan(outputPath)}`);
      log.message('This directory may not contain a valid build output.');
      process.exit(1);
    }

    log.success(`Serving ${pc.cyan(outputPath)}`);
    log.message('');
    log.message(`  ${pc.bold('Local:')}   ${pc.cyan(`http://localhost:${port}`)}`);
    log.message('');
    log.message(pc.dim('Press Ctrl+C to stop'));
    log.message('');

    // Use npx serve or a simple HTTP server
    try {
      // Try using 'serve' package
      await execa('npx', ['serve', outputPath, '-l', port], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (serveError) {
      // Fallback to Python's http.server if serve isn't available
      try {
        await execa('python3', ['-m', 'http.server', port, '-d', outputPath], {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
      } catch (pythonError) {
        log.error('Could not start preview server.');
        log.message('');
        log.message('Please install a static server:');
        log.message(`  ${pc.cyan('npm install -g serve')}`);
        log.message('');
        log.message('Or manually serve the output:');
        log.message(`  ${pc.cyan(`npx serve ${outputPath}`)}`);
        process.exit(1);
      }
    }
  } catch (error) {
    if (isCancel(error)) {
      cancel('Preview stopped.');
      process.exit(0);
    }

    log.error(pc.red(error.message));
    process.exit(1);
  }
}
