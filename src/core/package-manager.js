import { execa } from 'execa';

let detectedManager = null;

export async function getPackageManager() {
    if (detectedManager) return detectedManager;

    // Check for Bun first (fastest) - keeping preference for Bun as per user rules if available
    try {
        await execa('bun', ['--version']);
        detectedManager = 'bun';
        return 'bun';
    } catch { }

    // Check for pnpm
    try {
        await execa('pnpm', ['--version']);
        detectedManager = 'pnpm';
        return 'pnpm';
    } catch { }

    // Check for yarn
    try {
        await execa('yarn', ['--version']);
        detectedManager = 'yarn';
        return 'yarn';
    } catch { }

    // Default to npm
    detectedManager = 'npm';
    return 'npm';
}

export async function installDependencies(projectDir, { silent = true } = {}) {
    const manager = await getPackageManager();

    await execa(manager, ['install'], {
        cwd: projectDir,
        stdio: silent ? 'pipe' : 'inherit',
        env: { ...process.env, CI: 'true' }, // Force non-interactive mode
    });
}

export async function installPackage(projectDir, packageName, { dev = false, silent = true } = {}) {
    const manager = await getPackageManager();
    const args = manager === 'npm' ? ['install'] : ['add'];
    
    if (dev) {
        args.push('-D');
    }
    
    args.push(packageName);

    await execa(manager, args, {
        cwd: projectDir,
        stdio: silent ? 'pipe' : 'inherit',
    });
}

/**
 * Spawns a locally installed project binary (e.g. 'astro').
 * Avoid package-manager wrapper processes so Ctrl+C behaves predictably.
 */
export async function spawnBinary(projectDir, binary, args = [], execaOptions = {}) {
    const subprocess = execa(binary, args, {
        cwd: projectDir,
        preferLocal: true,
        ...execaOptions,
        windowsHide: process.platform === 'win32',
    });

    return { subprocess };
}

/**
 * Runs a binary to completion using the package manager.
 */
export async function runBinary(projectDir, binary, args = []) {
    const { subprocess } = await spawnBinary(projectDir, binary, args);
    await subprocess;
}

export async function getRunInstruction(script) {
    const manager = await getPackageManager();
    if (manager === 'npm') {
        return `npm run ${script}`;
    }
    return `${manager} run ${script}`;
}

export async function getInstallInstruction() {
    const manager = await getPackageManager();
    return `${manager} install`;
}
