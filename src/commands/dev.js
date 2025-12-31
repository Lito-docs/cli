import { existsSync } from 'fs';
import { resolve } from 'path';
import { intro, outro, spinner, log, note, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { scaffoldProject, cleanupProject } from '../core/scaffold.js';
import { syncDocs } from '../core/sync.js';
import { generateConfig } from '../core/config.js';
import { runAstroDev } from '../core/astro.js';
import { syncDocsConfig } from '../core/config-sync.js';
import { getTemplatePath } from '../core/template-fetcher.js';

export async function devCommand(options) {
  try {
    // Validate input path
    const inputPath = resolve(options.input);
    if (!existsSync(inputPath)) {
      log.error(`Input path does not exist: ${pc.cyan(inputPath)}`);
      process.exit(1);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' SuperDocs - Dev Server ')));

    const s = spinner();

    // Step 0: Resolve template
    s.start('Resolving template...');
    const templatePath = await getTemplatePath(options.template, options.refresh);
    s.stop(templatePath ? `Using template: ${pc.cyan(templatePath)}` : 'Using bundled template');

    // Step 1: Scaffold temporary Astro project
    s.start('Setting up Astro project...');
    const projectDir = await scaffoldProject(templatePath);
    s.stop('Astro project scaffolded');

    // Register cleanup handlers
    const cleanup = async () => {
      s.start('Cleaning up...');
      await cleanupProject();
      s.stop('Cleanup complete');
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Step 2: Install dependencies
    const { installDependencies } = await import('../core/package-manager.js');
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
          await syncDocs(inputPath, projectDir);
          log.success('Documentation re-synced');
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

    // Step 5: Start Astro dev server
    note(`Starting Astro dev server at http://localhost:${options.port}`, 'Dev Server');
    await runAstroDev(projectDir, options.port);

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
