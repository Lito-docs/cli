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
import { execa } from 'execa';

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
    const projectDir = await scaffoldProject(templatePath, inputPath);
    s.stop('Project scaffolded');

    // Step 1.5: Detect framework
    s.start('Detecting framework...');
    const frameworkConfig = await detectFramework(projectDir);
    s.stop(`Using framework: ${pc.cyan(frameworkConfig.name)}`);

    let watcher = null;
    let serverProcess = null;
    let syncTimeout = null;
    let isSyncing = false;
    let isCleaningUp = false;
    let isCapturingInput = false;

    const handleRawInput = (key) => {
      if (key === '\u0003') {
        handleSigInt();
      }
    };

    const startInputCapture = () => {
      if (process.platform !== 'win32' || !process.stdin.isTTY || isCapturingInput) {
        return;
      }

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', handleRawInput);
      isCapturingInput = true;
    };

    const stopInputCapture = () => {
      if (!isCapturingInput || !process.stdin.isTTY) {
        return;
      }

      process.stdin.off('data', handleRawInput);
      try {
        process.stdin.setRawMode(false);
      } catch {}
      isCapturingInput = false;
    };

    // Windows: kill the child process tree
    const killServer = async () => {
      const proc = serverProcess;
      serverProcess = null;
      if (!proc || !proc.pid) return;

      try {
        if (process.platform === 'win32') {
          await execa('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            reject: false,
            windowsHide: true,
          });
        } else {
          proc.kill('SIGTERM');
          setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
        }
      } catch {
        // ignore
      }
    };

    // Windows: free the port if taskkill missed anything
    const stopPortProcesses = async () => {
      if (process.platform !== 'win32') return;
      const port = Number(options.port);
      if (!Number.isInteger(port) || port <= 0) return;

      await execa('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; ` +
        `if ($conns) { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; ` +
        `foreach ($pid in $pids) { taskkill /PID $pid /T /F | Out-Null } }`
      ], {
        stdio: 'ignore',
        reject: false,
        windowsHide: true,
      });
    };

    // Cleanup
    const cleanup = async (exitCode = 0) => {
      if (isCleaningUp) return;
      isCleaningUp = true; // set eagerly before any await

      process.off('SIGINT', handleSigInt);
      process.off('SIGTERM', handleSigTerm);
      process.off('SIGBREAK', handleSigBreak);

      // Stop raw stdin listener on Windows
      stopInputCapture();

      s.start('Cleaning up...');
      if (syncTimeout) clearTimeout(syncTimeout);
      if (watcher) await watcher.close();

      await killServer();           // <-- uses killServer, not stopServer
      await stopPortProcesses();
      await cleanupProject(projectDir);
      s.stop('Cleanup complete');
      process.exit(exitCode);
    };

    const handleSigInt = () => {
      log.warn('Ctrl+C received. Stopping dev server...');
      cleanup(0);
    };
    const handleSigTerm = () => cleanup(0);
    const handleSigBreak = () => {
      log.warn('Interrupt received. Stopping dev server...');
      cleanup(0);
    };

    process.on('SIGINT', handleSigInt);
    process.on('SIGTERM', handleSigTerm);
    process.on('SIGBREAK', handleSigBreak);

    // Prepare project
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

    const debouncedSync = async () => {
      if (isSyncing) return;
      if (syncTimeout) clearTimeout(syncTimeout);

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

    watcher = chokidar.watch(inputPath, {
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
    const { subprocess } = await runFrameworkDev(projectDir, frameworkConfig, options.port);
    serverProcess = subprocess;

    if (serverProcess.stdout) serverProcess.stdout.pipe(process.stdout);
    if (serverProcess.stderr) serverProcess.stderr.pipe(process.stderr);
    startInputCapture();

    try {
      await serverProcess;
      await cleanup(0);
    } catch {
      await cleanup(1);
    }

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
