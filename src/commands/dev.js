import { existsSync } from 'fs';
import { resolve } from 'path';
import { intro, outro, spinner, log, note, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { scaffoldProject, cleanupProject } from '../core/scaffold.js';
import { syncDocs } from '../core/sync.js';
import { generateConfig } from '../core/config.js';
import { syncDocsConfig } from '../core/config-sync.js';
import { getTemplatePath } from '../core/template-fetcher.js';
import { detectFramework, runFrameworkDev } from '../core/framework-runner.js';

export async function devCommand(options) {
  try {
    // Validate input path
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath)) {
      log.error(`Input path does not exist: ${pc.cyan(inputPath)}`);
      process.exit(1);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Dev Server ')));

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

    // Register cleanup handlers
    const cleanup = async () => {
      s.start('Cleaning up...');
      await cleanupProject();
      s.stop('Cleanup complete');
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Step 2: Prepare project (Install dependencies, Sync docs, Generate navigation)
    const { installDependencies } = await import('../core/package-manager.js');
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

    // Step 4: Setup file watcher with debouncing
    log.info(pc.cyan('Watching for file changes...'));

    let syncTimeout = null;
    let isSyncing = false;

    const debouncedSync = async () => {
      if (isSyncing) return;

      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }

      syncTimeout = setTimeout(async () => {
        if (isSyncing) return;
        isSyncing = true;

        try {
          await Promise.all([
            syncDocs(inputPath, projectDir, frameworkConfig),
            syncDocsConfig(projectDir, inputPath, userConfigPath)
          ]);
          log.success('Documentation and config re-synced');
        } catch (error) {
          log.error('Sync failed: ' + error.message);
        } finally {
          isSyncing = false;
        }
      }, 300); // 300ms debounce
    };

    const watcher = chokidar.watch(inputPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true, // Don't trigger for existing files
    });

    watcher.on('change', async (path) => {
      log.info(`File changed: ${pc.dim(path)}`);
      debouncedSync();
    });

    watcher.on('add', async (path) => {
      log.success(`File added: ${pc.dim(path)}`);
      debouncedSync();
    });

    watcher.on('unlink', async (path) => {
      log.warning(`File removed: ${pc.dim(path)}`);
      debouncedSync();
    });

    // Step 5: Start framework dev server
    note(`Starting ${frameworkConfig.name} dev server at http://localhost:${options.port}`, 'Dev Server');
    await runFrameworkDev(projectDir, frameworkConfig, options.port);

  } catch (error) {
    if (isCancel(error)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }
    log.error(pc.red('Dev server failed: ' + error.message));
    if (error.stack) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
