import { existsSync } from 'fs';
import { resolve } from 'path';
import { intro, outro, spinner, log, note, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import fs from 'fs-extra';
import { scaffoldProject, cleanupProject } from '../core/scaffold.js';
import { syncDocs } from '../core/sync.js';
import { generateConfig } from '../core/config.js';
import { syncDocsConfig } from '../core/config-sync.js';
import { getTemplatePath } from '../core/template-fetcher.js';

export async function ejectCommand(options) {
  try {
    // Validate input path
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath)) {
      log.error(`Input path does not exist: ${pc.cyan(inputPath)}`);
      process.exit(1);
    }

    const outputPath = resolve(options.output);
    if (existsSync(outputPath)) {
      log.error(`Output path already exists: ${pc.cyan(outputPath)}`);
      log.warning('Please provide a path to a non-existent directory to avoid overwriting files.');
      process.exit(1);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' SuperDocs - Eject ')));

    const s = spinner();

    // Step 0: Resolve template
    s.start('Resolving template...');
    const templatePath = await getTemplatePath(options.template, options.refresh);
    s.stop(templatePath ? `Using template: ${pc.cyan(templatePath)}` : 'Using bundled template');

    // Step 1: Scaffold temporary Astro project
    s.start('Scaffolding Astro project...');
    const projectDir = await scaffoldProject(templatePath);
    s.stop('Astro project scaffolded');

    // Step 2: Sync docs to Astro
    s.start('Syncing documentation files...');
    await syncDocs(inputPath, projectDir);
    s.stop('Documentation synced');

    // Step 3: Sync docs config (auto-generate navigation)
    s.start('Generating navigation...');
    const userConfigPath = resolve(options.input, 'docs-config.json');
    await syncDocsConfig(projectDir, inputPath, userConfigPath);
    s.stop('Navigation generated');

    // Step 4: Generate config
    s.start('Generating Astro configuration...');
    await generateConfig(projectDir, options);
    s.stop('Configuration generated');

    // Step 5: Copy entire project to output
    s.start('Exporting project source code...');
    await fs.copy(projectDir, outputPath);
    s.stop(`Project exported to ${pc.cyan(outputPath)}`);

    // Clean up temp directory
    s.start('Cleaning up...');
    await cleanupProject();
    s.stop('Cleanup complete');

    // Step 6: Final instructions
    const { getInstallInstruction, getRunInstruction } = await import('../core/package-manager.js');
    const installCmd = await getInstallInstruction();
    const devCmd = await getRunInstruction('dev');

    note(`${pc.cyan(`cd ${options.output}`)}\n${pc.cyan(installCmd)}\n${pc.cyan(devCmd)}`, 'To get started');

    outro(pc.green('Project ejected successfully!'));

  } catch (error) {
    if (isCancel(error)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }
    log.error(pc.red('Eject failed: ' + error.message));
    if (error.stack) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
