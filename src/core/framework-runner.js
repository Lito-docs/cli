import { runBinary } from './package-manager.js';
import { join } from 'path';
import pkg from 'fs-extra';
const { pathExists, readJson } = pkg;

/**
 * Framework configuration schema
 * Templates can define their framework in lito-manifest.json or template-manifest.json
 */
const DEFAULT_FRAMEWORK_CONFIGS = {
  astro: {
    name: 'astro',
    commands: {
      dev: ['astro', ['dev']],
      build: ['astro', ['build']],
    },
    contentDir: 'src/pages',
    publicDir: 'public',
    configFile: 'astro.config.mjs',
    layoutInjection: true,
    layoutPath: 'layouts/MarkdownLayout.astro',
    apiLayoutPath: 'layouts/APILayout.astro',
  },
  react: {
    name: 'react',
    commands: {
      dev: ['vite', ['--host']],
      build: ['vite', ['build']],
    },
    contentDir: 'src/content',
    publicDir: 'public',
    configFile: 'vite.config.js',
    layoutInjection: false,
    useMDX: true,
    // HMR trigger file that will be updated when content changes
    hmrTriggerFile: 'src/.lito-hmr-trigger.js',
  },
  next: {
    name: 'next',
    commands: {
      dev: ['next', ['dev']],
      build: ['next', ['build']],
    },
    contentDir: 'content',
    publicDir: 'public',
    configFile: 'next.config.js',
    layoutInjection: false,
    useMDX: true,
  },
  vue: {
    name: 'vue',
    commands: {
      dev: ['vite', ['--host']],
      build: ['vite', ['build']],
    },
    contentDir: 'src/content',
    publicDir: 'public',
    configFile: 'vite.config.js',
    layoutInjection: false,
    // HMR trigger file that will be updated when content changes
    hmrTriggerFile: 'src/.lito-hmr-trigger.js',
  },
};

/**
 * Detect framework from template directory
 * Checks for lito-manifest.json, template-manifest.json, or infers from config files
 */
export async function detectFramework(projectDir) {
  // Check for lito-manifest.json first (preferred)
  const litoManifestPath = join(projectDir, 'lito-manifest.json');
  if (await pathExists(litoManifestPath)) {
    try {
      const manifest = await readJson(litoManifestPath);
      if (manifest.framework) {
        return mergeFrameworkConfig(manifest.framework, manifest);
      }
    } catch {
      // Fall through to other detection methods
    }
  }

  // Check for template-manifest.json (legacy)
  const templateManifestPath = join(projectDir, 'template-manifest.json');
  if (await pathExists(templateManifestPath)) {
    try {
      const manifest = await readJson(templateManifestPath);
      if (manifest.framework) {
        return mergeFrameworkConfig(manifest.framework, manifest);
      }
    } catch {
      // Fall through to inference
    }
  }

  // Infer from config files
  if (await pathExists(join(projectDir, 'astro.config.mjs')) ||
      await pathExists(join(projectDir, 'astro.config.js'))) {
    return DEFAULT_FRAMEWORK_CONFIGS.astro;
  }

  if (await pathExists(join(projectDir, 'next.config.js')) ||
      await pathExists(join(projectDir, 'next.config.mjs')) ||
      await pathExists(join(projectDir, 'next.config.ts'))) {
    return DEFAULT_FRAMEWORK_CONFIGS.next;
  }

  // Check package.json for framework hints
  const packageJsonPath = join(projectDir, 'package.json');
  if (await pathExists(packageJsonPath)) {
    try {
      const packageJson = await readJson(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['next']) return DEFAULT_FRAMEWORK_CONFIGS.next;
      if (deps['astro']) return DEFAULT_FRAMEWORK_CONFIGS.astro;
      if (deps['vue'] && deps['vite']) return DEFAULT_FRAMEWORK_CONFIGS.vue;
      if (deps['react'] && deps['vite']) return DEFAULT_FRAMEWORK_CONFIGS.react;
    } catch {
      // Fall through to default
    }
  }

  // Default to Astro (backward compatible)
  return DEFAULT_FRAMEWORK_CONFIGS.astro;
}

/**
 * Merge custom framework config with defaults
 */
function mergeFrameworkConfig(frameworkName, manifest) {
  const baseConfig = DEFAULT_FRAMEWORK_CONFIGS[frameworkName] || {
    name: frameworkName,
    contentDir: 'src/content',
    publicDir: 'public',
    layoutInjection: false,
  };

  return {
    ...baseConfig,
    ...manifest.frameworkConfig,
    name: frameworkName,
    // Allow manifest to override commands
    commands: {
      ...baseConfig.commands,
      ...manifest.commands,
    },
  };
}

/**
 * Run the framework's dev server
 */
export async function runFrameworkDev(projectDir, frameworkConfig, port = '4321') {
  const { commands } = frameworkConfig;
  const [binary, args] = commands.dev;

  const devArgs = [...args];

  // Add port based on framework
  if (frameworkConfig.name === 'astro') {
    devArgs.push('--port', port);
  } else if (frameworkConfig.name === 'next') {
    devArgs.push('-p', port);
  } else {
    // Vite-based frameworks
    devArgs.push('--port', port);
  }

  await runBinary(projectDir, binary, devArgs);
}

/**
 * Run the framework's build command
 */
export async function runFrameworkBuild(projectDir, frameworkConfig) {
  const { commands } = frameworkConfig;
  const [binary, args] = commands.build;

  await runBinary(projectDir, binary, args);
}

/**
 * Get the output directory for the built site
 */
export function getOutputDir(frameworkConfig) {
  switch (frameworkConfig.name) {
    case 'astro':
      return 'dist';
    case 'next':
      return '.next';
    case 'react':
    case 'vue':
      return 'dist';
    default:
      return 'dist';
  }
}

/**
 * Check if framework needs search indexing (pagefind)
 */
export function needsSearchIndex(frameworkConfig) {
  // Only static-output frameworks need pagefind
  return ['astro', 'react', 'vue'].includes(frameworkConfig.name);
}

export { DEFAULT_FRAMEWORK_CONFIGS };
