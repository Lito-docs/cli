import { existsSync } from 'fs';
import { resolve } from 'path';
import { intro, outro, spinner, log, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import { scaffoldProject, cleanupProject } from '../core/scaffold.js';
import { syncDocs } from '../core/sync.js';
import { generateConfig } from '../core/config.js';
import { syncDocsConfig } from '../core/config-sync.js';
import { copyOutput } from '../core/output.js';
import { getTemplatePath } from '../core/template-fetcher.js';
import { detectFramework, runFrameworkBuild, getOutputDir, needsSearchIndex } from '../core/framework-runner.js';

export async function buildCommand(options) {
  try {
    // Validate input path
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath)) {
      log.error(`Input path does not exist: ${pc.cyan(inputPath)}`);
      process.exit(1);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Build ')));

    const s = spinner();

    // Step 0: Resolve template
    s.start('Resolving template...');
    const templatePath = await getTemplatePath(options.template, options.refresh);
    s.stop(templatePath ? `Using template: ${pc.cyan(templatePath)}` : 'Using bundled template');

    // Step 1: Scaffold temporary project
    s.start('Setting up project...');
    const projectDir = await scaffoldProject(templatePath);
    s.stop('Project scaffolded');

    // Step 1.5: Detect framework
    s.start('Detecting framework...');
    const frameworkConfig = await detectFramework(projectDir);
    s.stop(`Using framework: ${pc.cyan(frameworkConfig.name)}`);

    // Step 2: Prepare project (Install dependencies, Sync docs, Generate navigation)
    const { installDependencies, runBinary } = await import('../core/package-manager.js');
    s.start('Preparing project (installing dependencies, syncing files)...');

    const userConfigPath = resolve(options.input, 'docs-config.json');

    await Promise.all([
      installDependencies(projectDir, { silent: true }),
      syncDocs(inputPath, projectDir, frameworkConfig),
      syncDocsConfig(projectDir, inputPath, userConfigPath)
    ]);

    s.stop('Project prepared (dependencies installed, docs synced, navigation generated)');

    // Step 4: Generate config (framework-aware)
    s.start(`Generating ${frameworkConfig.name} configuration...`);
    await generateConfig(projectDir, options, frameworkConfig);
    s.stop('Configuration generated');

    // Step 4.5: Configure for provider
    if (options.provider && options.provider !== 'static') {
      s.start(`Configuring for ${options.provider} (${options.rendering})...`);
      const { configureProvider } = await import('../core/providers.js');
      await configureProvider(projectDir, options.provider, options.rendering);
      s.stop(`Configured for ${options.provider}`);
    }

    // Step 5: Build with framework
    s.start(`Building site with ${frameworkConfig.name}...`);
    await runFrameworkBuild(projectDir, frameworkConfig);
    s.stop('Site built successfully');

    // Step 5.5: Generate Pagefind search index (only for static frameworks)
    if (needsSearchIndex(frameworkConfig)) {
      const outputDir = getOutputDir(frameworkConfig);
      s.start('Generating search index...');
      await runBinary(projectDir, 'pagefind', ['--site', outputDir]);
      s.stop('Search index generated');
    }

    // Step 6: Copy output
    const outputPath = resolve(options.output);
    const frameworkOutputDir = getOutputDir(frameworkConfig);
    s.start(`Copying output to ${pc.cyan(outputPath)}...`);
    await copyOutput(projectDir, outputPath, frameworkOutputDir);
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
