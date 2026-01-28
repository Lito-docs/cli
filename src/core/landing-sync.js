/**
 * Landing Page Sync Module
 *
 * Supports two modes:
 * 1. Full custom landing (_landing/ folder with HTML/CSS/JS)
 * 2. Section-based landing (mix of custom HTML and default components)
 *
 * The landing page configuration in docs-config.json determines which mode is used.
 */

import pkg from 'fs-extra';
const { copy, ensureDir, readFile, writeFile, pathExists, readJson } = pkg;
import { join, relative, basename, extname } from 'path';
import { readdir } from 'fs/promises';

/**
 * Landing page types
 */
export const LANDING_TYPES = {
  NONE: 'none',           // No landing page, go straight to docs
  DEFAULT: 'default',     // Use template's default landing
  CONFIG: 'config',       // Landing defined in docs-config.json (hero, features, etc.)
  CUSTOM: 'custom',       // Full custom HTML/CSS/JS from _landing/ folder
  SECTIONS: 'sections',   // Section-based: mix of custom HTML and default components
};

/**
 * Default section types that templates should support
 */
export const DEFAULT_SECTION_TYPES = [
  'hero',
  'features',
  'cta',
  'testimonials',
  'pricing',
  'faq',
  'stats',
  'logos',
  'comparison',
  'footer',
];

/**
 * Detect landing page type from user's docs directory
 * @param {string} sourcePath - User's docs directory
 * @param {object} docsConfig - Parsed docs-config.json
 * @returns {Promise<{type: string, config: object}>}
 */
export async function detectLandingType(sourcePath, docsConfig) {
  const landingConfig = docsConfig?.landing || {};

  // Check if landing is explicitly disabled
  if (landingConfig.enabled === false) {
    return { type: LANDING_TYPES.NONE, config: landingConfig };
  }

  // Check for _landing folder (custom HTML/CSS/JS)
  const landingFolderPath = join(sourcePath, '_landing');
  const hasLandingFolder = await pathExists(landingFolderPath);

  // Determine type based on config
  if (landingConfig.type === 'custom' || (hasLandingFolder && !landingConfig.type)) {
    return { type: LANDING_TYPES.CUSTOM, config: landingConfig };
  }

  if (landingConfig.type === 'sections' && landingConfig.sections) {
    return { type: LANDING_TYPES.SECTIONS, config: landingConfig };
  }

  if (landingConfig.type === 'none') {
    return { type: LANDING_TYPES.NONE, config: landingConfig };
  }

  // Check for config-based landing (hero, features defined in config)
  if (landingConfig.hero || landingConfig.features) {
    return { type: LANDING_TYPES.CONFIG, config: landingConfig };
  }

  // Default to template's default landing
  return { type: LANDING_TYPES.DEFAULT, config: landingConfig };
}

/**
 * Sync custom landing page from _landing/ folder
 * @param {string} sourcePath - User's docs directory
 * @param {string} projectDir - Scaffolded project directory
 * @param {object} frameworkConfig - Framework configuration
 * @param {object} landingConfig - Landing configuration
 */
export async function syncCustomLanding(sourcePath, projectDir, frameworkConfig, landingConfig) {
  const landingSource = join(sourcePath, landingConfig.source || '_landing');

  if (!await pathExists(landingSource)) {
    console.warn(`Warning: Landing folder not found at ${landingSource}`);
    return;
  }

  // Read all files from _landing/
  const files = await readdir(landingSource, { withFileTypes: true });

  // Separate files by type
  const htmlFiles = [];
  const cssFiles = [];
  const jsFiles = [];
  const assetFiles = [];

  for (const file of files) {
    if (file.isDirectory()) {
      // Handle subdirectories (e.g., _landing/assets/)
      if (file.name === 'assets' || file.name === 'images') {
        assetFiles.push(file.name);
      }
      continue;
    }

    const ext = extname(file.name).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      htmlFiles.push(file.name);
    } else if (ext === '.css') {
      cssFiles.push(file.name);
    } else if (ext === '.js' || ext === '.mjs') {
      jsFiles.push(file.name);
    }
  }

  // Generate landing page based on framework
  await generateLandingForFramework(
    projectDir,
    frameworkConfig,
    {
      sourcePath: landingSource,
      htmlFiles,
      cssFiles,
      jsFiles,
      assetFiles,
      config: landingConfig,
    }
  );
}

/**
 * Sync section-based landing page
 * @param {string} sourcePath - User's docs directory
 * @param {string} projectDir - Scaffolded project directory
 * @param {object} frameworkConfig - Framework configuration
 * @param {object} landingConfig - Landing configuration with sections array
 */
export async function syncSectionsLanding(sourcePath, projectDir, frameworkConfig, landingConfig) {
  const sections = landingConfig.sections || [];
  const processedSections = [];

  for (const section of sections) {
    if (section.type === 'custom' && section.html) {
      // Load custom HTML for this section
      const htmlPath = join(sourcePath, section.html);
      if (await pathExists(htmlPath)) {
        const htmlContent = await readFile(htmlPath, 'utf-8');
        processedSections.push({
          ...section,
          type: 'custom',
          content: htmlContent,
        });
      } else {
        console.warn(`Warning: Section HTML not found: ${htmlPath}`);
        processedSections.push(section);
      }
    } else {
      // Use default component for this section type
      processedSections.push(section);
    }
  }

  // Generate sections landing for framework
  await generateSectionsLandingForFramework(
    projectDir,
    frameworkConfig,
    {
      sections: processedSections,
      config: landingConfig,
    }
  );
}

/**
 * Generate landing page for specific framework
 */
async function generateLandingForFramework(projectDir, frameworkConfig, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  switch (frameworkConfig.name) {
    case 'astro':
      await generateAstroLanding(projectDir, landingData);
      break;
    case 'react':
      await generateReactLanding(projectDir, landingData);
      break;
    case 'next':
      await generateNextLanding(projectDir, landingData);
      break;
    case 'vue':
      await generateVueLanding(projectDir, landingData);
      break;
    case 'nuxt':
      await generateNuxtLanding(projectDir, landingData);
      break;
    default:
      // Default to Astro-style
      await generateAstroLanding(projectDir, landingData);
  }
}

/**
 * Generate Astro landing page (standalone, no template imports)
 */
async function generateAstroLanding(projectDir, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Read CSS files
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Read JS files
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += `// ${jsFile}\n${js}\n\n`;
  }

  // Generate standalone Astro component
  const astroContent = `---
// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { getConfigFile } from '../utils/config';

const config = await getConfigFile();
---

<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{config.metadata?.name || 'Home'}</title>
    <meta name="description" content={config.metadata?.description || ''} />
    <link rel="icon" href={config.branding?.favicon || '/favicon.svg'} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet" />
    <script is:inline>
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    </script>
    <style>
      ${cssContent}
    </style>
  </head>
  <body class="bg-background text-foreground font-sans antialiased">
    <Header />

    <main class="landing-custom">
      ${htmlContent}
    </main>

    <Footer />

    ${jsContent ? `<script>\n${jsContent}\n</script>` : ''}
  </body>
</html>
`;

  // Write to index.astro
  const indexPath = join(projectDir, 'src', 'pages', 'index.astro');
  await writeFile(indexPath, astroContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate React landing page (standalone)
 */
async function generateReactLanding(projectDir, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Read CSS files
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Write CSS to a separate file
  const cssPath = join(projectDir, 'src', 'styles', 'landing.css');
  await ensureDir(join(projectDir, 'src', 'styles'));
  await writeFile(cssPath, cssContent, 'utf-8');

  // Read JS files for inline script
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += `// ${jsFile}\n${js}\n\n`;
  }

  // Generate standalone React component
  const reactContent = `// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder
import { useEffect } from 'react';
import '../styles/landing.css';

export default function LandingPage() {
  useEffect(() => {
    // Landing page scripts
    ${jsContent}
  }, []);

  return (
    <main
      className="landing-custom"
      dangerouslySetInnerHTML={{ __html: \`${htmlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }}
    />
  );
}
`;

  // Write to index page
  const landingPath = join(projectDir, 'src', 'pages', 'index.jsx');
  await ensureDir(join(projectDir, 'src', 'pages'));
  await writeFile(landingPath, reactContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate Next.js landing page (standalone)
 */
async function generateNextLanding(projectDir, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Read CSS files
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Write CSS to globals or landing file
  const cssPath = join(projectDir, 'app', 'landing.css');
  await ensureDir(join(projectDir, 'app'));
  await writeFile(cssPath, cssContent, 'utf-8');

  // Read JS files
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += `// ${jsFile}\n${js}\n\n`;
  }

  // Generate standalone Next.js page
  const nextContent = `// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder
'use client';

import { useEffect } from 'react';
import './landing.css';

export default function Home() {
  useEffect(() => {
    // Landing page scripts
    ${jsContent}
  }, []);

  return (
    <main
      className="landing-custom"
      dangerouslySetInnerHTML={{ __html: \`${htmlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }}
    />
  );
}
`;

  // Write to page.jsx (Next.js 13+ app router)
  const pagePath = join(projectDir, 'app', 'page.jsx');
  await writeFile(pagePath, nextContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate Vue landing page (standalone)
 */
async function generateVueLanding(projectDir, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Read CSS files
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Read JS files
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += js + '\n';
  }

  // Generate standalone Vue SFC
  const vueContent = `<script setup>
// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder
import { onMounted, ref } from 'vue';

const landingHtml = ref(\`${htmlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);

onMounted(() => {
  // Landing page scripts
  ${jsContent}
});
</script>

<template>
  <main class="landing-custom" v-html="landingHtml"></main>
</template>

<style scoped>
${cssContent}
</style>
`;

  // Write to index page
  const vuePath = join(projectDir, 'src', 'pages', 'index.vue');
  await ensureDir(join(projectDir, 'src', 'pages'));
  await writeFile(vuePath, vueContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate Nuxt landing page (standalone)
 */
async function generateNuxtLanding(projectDir, landingData) {
  const { sourcePath, htmlFiles, cssFiles, jsFiles, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Read CSS files
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Read JS files
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += js + '\n';
  }

  // Generate standalone Nuxt page
  const nuxtContent = `<script setup>
// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder

const landingHtml = \`${htmlContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

onMounted(() => {
  // Landing page scripts
  ${jsContent}
});
</script>

<template>
  <main class="landing-custom" v-html="landingHtml"></main>
</template>

<style scoped>
${cssContent}
</style>
`;

  // Write to index page
  const nuxtPath = join(projectDir, 'pages', 'index.vue');
  await ensureDir(join(projectDir, 'pages'));
  await writeFile(nuxtPath, nuxtContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate sections-based landing for framework
 */
async function generateSectionsLandingForFramework(projectDir, frameworkConfig, landingData) {
  const { sections, config } = landingData;

  // For now, we'll generate a JSON manifest that templates can read
  // Templates are responsible for rendering the sections
  const manifestPath = join(projectDir, 'src', 'data', 'landing-sections.json');
  await ensureDir(join(projectDir, 'src', 'data'));

  await writeFile(manifestPath, JSON.stringify({
    type: 'sections',
    sections: sections,
  }, null, 2), 'utf-8');

  // Additionally, generate a default sections component for Astro
  if (frameworkConfig.name === 'astro') {
    await generateAstroSectionsLanding(projectDir, landingData);
  }
}

/**
 * Generate Astro sections landing page
 */
async function generateAstroSectionsLanding(projectDir, landingData) {
  const { sections, config } = landingData;

  // Generate section renders
  const sectionRenders = sections.map((section, index) => {
    if (section.type === 'custom' && section.content) {
      // Custom HTML section
      return `
  <!-- Custom Section ${index + 1} -->
  <section class="landing-section landing-section-custom" id="section-${index}">
    <Fragment set:html={\`${section.content.replace(/`/g, '\\`')}\`} />
  </section>`;
    } else {
      // Default component section - template must provide these components
      const componentName = section.type.charAt(0).toUpperCase() + section.type.slice(1) + 'Section';
      return `
  <!-- ${section.type} Section -->
  {Astro.glob('../components/landing/${componentName}.astro').then(m => m[0] ? <m[0].default {...${JSON.stringify(section.props || {})}} /> : null)}`;
    }
  }).join('\n');

  const astroContent = `---
// Sections-based landing page - auto-generated by Lito CLI
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { getConfigFile } from '../utils/config';

const config = await getConfigFile();
---

<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{config.metadata?.name || 'Home'}</title>
    <link rel="icon" href={config.branding?.favicon || '/favicon.svg'} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap" rel="stylesheet" />
    <script is:inline>
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    </script>
  </head>
  <body class="bg-background text-foreground font-sans antialiased">
    <Header />

    <main class="landing-sections">
      ${sectionRenders}
    </main>

    <Footer />
  </body>
</html>
`;

  // Only write if custom sections are defined
  if (sections.some(s => s.type === 'custom')) {
    const indexPath = join(projectDir, 'src', 'pages', 'index.astro');
    await writeFile(indexPath, astroContent, 'utf-8');
  }
}

/**
 * Copy landing assets to public directory
 */
async function copyLandingAssets(sourcePath, projectDir) {
  const assetDirs = ['assets', 'images', 'img', 'icons'];

  for (const dir of assetDirs) {
    const assetSource = join(sourcePath, dir);
    if (await pathExists(assetSource)) {
      const assetTarget = join(projectDir, 'public', 'landing', dir);
      await ensureDir(assetTarget);
      await copy(assetSource, assetTarget, { overwrite: true });
    }
  }

  // Also copy any image files directly in _landing/
  try {
    const files = await readdir(sourcePath);
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (imageExts.includes(ext)) {
        const src = join(sourcePath, file);
        const dest = join(projectDir, 'public', 'landing', file);
        await ensureDir(join(projectDir, 'public', 'landing'));
        await copy(src, dest, { overwrite: true });
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Main landing sync function
 * @param {string} sourcePath - User's docs directory
 * @param {string} projectDir - Scaffolded project directory
 * @param {object} frameworkConfig - Framework configuration
 * @param {object} docsConfig - Parsed docs-config.json
 */
export async function syncLanding(sourcePath, projectDir, frameworkConfig, docsConfig) {
  const { type, config } = await detectLandingType(sourcePath, docsConfig);

  switch (type) {
    case LANDING_TYPES.NONE:
      // Remove default landing page, show docs index directly
      // This is handled by templates based on config
      break;

    case LANDING_TYPES.CUSTOM:
      await syncCustomLanding(sourcePath, projectDir, frameworkConfig, config);
      break;

    case LANDING_TYPES.SECTIONS:
      await syncSectionsLanding(sourcePath, projectDir, frameworkConfig, config);
      break;

    case LANDING_TYPES.CONFIG:
    case LANDING_TYPES.DEFAULT:
      // These are handled by templates reading docs-config.json
      // Just ensure the config is synced (done elsewhere)
      break;
  }

  return { type, config };
}
