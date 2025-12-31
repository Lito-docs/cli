import { existsSync } from 'fs';
import { resolve } from 'path';
import { intro, outro, spinner, log, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import { scaffoldProject, cleanupProject } from '../core/scaffold.js';
import { syncDocs } from '../core/sync.js';
import { generateConfig } from '../core/config.js';
import { runAstroBuild } from '../core/astro.js';
import { syncDocsConfig } from '../core/config-sync.js';
import { copyOutput } from '../core/output.js';
import { getTemplatePath } from '../core/template-fetcher.js';

export async function buildCommand(options) {
  try {
    // Validate input path
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath)) {
      log.error(`Input path does not exist: ${pc.cyan(inputPath)}`);
      process.exit(1);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' SuperDocs - Build ')));

    const s = spinner();

    // Step 0: Resolve template
    s.start('Resolving template...');
    const templatePath = await getTemplatePath(options.template, options.refresh);
    s.stop(templatePath ? `Using template: ${pc.cyan(templatePath)}` : 'Using bundled template');

    // Step 1: Scaffold temporary Astro project
    s.start('Setting up Astro project...');
    const projectDir = await scaffoldProject(templatePath);
    s.stop('Astro project scaffolded');

    // Step 2: Install dependencies
    const { installDependencies, runBinary } = await import('../core/package-manager.js');
    s.start('Installing dependencies...');
    await installDependencies(projectDir, { silent: true });
    s.stop('Dependencies installed');

    // Step 3: Sync docs to Astro
    s.start('Syncing documentation files...');
    await syncDocs(inputPath, projectDir);
    s.stop('Documentation synced');

    // Step 3.5: Sync docs config (auto-generate navigation)
    s.start('Generating navigation...');
    const userConfigPath = resolve(options.input, 'docs-config.json');
    await syncDocsConfig(projectDir, inputPath, userConfigPath);
    s.stop('Navigation generated');

    // Step 4: Generate config
    s.start('Generating Astro configuration...');
    await generateConfig(projectDir, options);
    s.stop('Configuration generated');

    // Step 5: Build with Astro
    s.start('Building site with Astro...');
    await runAstroBuild(projectDir);
    s.stop('Site built successfully');

    // Step 5.5: Generate Pagefind search index
    s.start('Generating search index...');
    await runBinary(projectDir, 'pagefind', ['--site', 'dist']);
    s.stop('Search index generated');

    // Step 6: Copy output
    const outputPath = resolve(options.output);
    s.start(`Copying output to ${pc.cyan(outputPath)}...`);
    await copyOutput(projectDir, outputPath);
    s.stop('Output copied');

    // Cleanup temp directory
    s.start('Cleaning up...');
    await cleanupProject();
    s.stop('Cleanup complete');

    outro(pc.green('Build completed successfully!'));
  } catch (error) {
    if (isCancel(error)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }

    // Attempt to cleanup even on error
    try {
      await cleanupProject();
    } catch (e) {
      // failed to cleanup
    }

    log.error(pc.red(error.message));
    if (error.stack) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
