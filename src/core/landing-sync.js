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
 * Add is:inline to all <script> and <style> tags in HTML so Astro ships
 * them as-is. Without this, Astro treats scripts as ES modules (scoping
 * declarations, breaking onclick handlers) and scopes styles (breaking
 * global CSS like :root variables, animations, etc.).
 */
function inlineForAstro(html) {
  // Add is:inline to <script> tags that don't already have it
  html = html.replace(/<script(?![^>]*is:inline)([^>]*>)/gi, '<script is:inline$1');
  // Add is:inline to <style> tags that don't already have is:inline or is:global
  html = html.replace(/<style(?![^>]*is:(?:inline|global))([^>]*>)/gi, '<style is:inline$1');
  return html;
}

/**
 * Check if HTML is a full document (has <html> or <!doctype>).
 * If so, extract head content, body content, and html/body attributes
 * so we can merge them into the Astro template properly.
 */
function parseFullHtmlDocument(html) {
  const isFullDoc = /<!doctype\s+html|<html[\s>]/i.test(html);
  if (!isFullDoc) return null;

  // Extract <html> tag attributes
  const htmlTagMatch = html.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? htmlTagMatch[1].trim() : '';

  // Extract <head> inner content
  const headMatch = html.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  const headContent = headMatch ? headMatch[1].trim() : '';

  // Extract <body> tag attributes and inner content
  const bodyTagMatch = html.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyTagMatch ? bodyTagMatch[1].trim() : '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';

  return { htmlAttrs, headContent, bodyContent, bodyAttrs };
}

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

  // Check if navbar/footer are explicitly hidden
  const navbarHidden = landingConfig.navbar === false;
  const footerHidden = landingConfig.footer === false;

  // Separate files by type
  const htmlFiles = [];
  const cssFiles = [];
  const jsFiles = [];
  const assetFiles = [];
  let navbarHtml = null;
  let footerHtml = null;

  for (const file of files) {
    if (file.isDirectory()) {
      // Handle subdirectories (e.g., _landing/assets/)
      if (file.name === 'assets' || file.name === 'images') {
        assetFiles.push(file.name);
      }
      continue;
    }

    const ext = extname(file.name).toLowerCase();
    const name = basename(file.name, ext).toLowerCase();

    if (ext === '.html' || ext === '.htm') {
      // Detect custom navbar/footer HTML files (skip if hidden)
      if (!navbarHidden && (name === 'navbar' || name === 'nav' || name === 'header')) {
        navbarHtml = file.name;
      } else if (!footerHidden && name === 'footer') {
        footerHtml = file.name;
      } else if (!((name === 'navbar' || name === 'nav' || name === 'header') || name === 'footer')) {
        htmlFiles.push(file.name);
      }
    } else if (ext === '.css') {
      cssFiles.push(file.name);
    } else if (ext === '.js' || ext === '.mjs') {
      jsFiles.push(file.name);
    }
  }

  // Read custom navbar/footer content if present
  let navbarContent = navbarHidden ? '__hidden__' : null;
  let footerContent = footerHidden ? '__hidden__' : null;

  if (!navbarHidden && navbarHtml) {
    navbarContent = await readFile(join(landingSource, navbarHtml), 'utf-8');
  }
  if (!footerHidden && footerHtml) {
    footerContent = await readFile(join(landingSource, footerHtml), 'utf-8');
  }

  // Also check config for custom navbar/footer (skip if hidden)
  if (!navbarHidden && !navbarContent && landingConfig.navbar?.html) {
    const navPath = join(landingSource, '..', landingConfig.navbar.html);
    if (await pathExists(navPath)) {
      navbarContent = await readFile(navPath, 'utf-8');
    }
  }
  if (!footerHidden && !footerContent && landingConfig.footer?.html) {
    const footerPath = join(landingSource, '..', landingConfig.footer.html);
    if (await pathExists(footerPath)) {
      footerContent = await readFile(footerPath, 'utf-8');
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
      navbarContent,
      footerContent,
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

  // Check if navbar/footer are explicitly hidden
  const navbarHidden = landingConfig.navbar === false;
  const footerHidden = landingConfig.footer === false;

  // Check for custom navbar/footer in _landing/ folder
  const landingSource = join(sourcePath, landingConfig.source || '_landing');
  let navbarContent = navbarHidden ? '__hidden__' : null;
  let footerContent = footerHidden ? '__hidden__' : null;

  if (!navbarHidden) {
    const navbarNames = ['navbar.html', 'nav.html', 'header.html'];
    for (const name of navbarNames) {
      const navPath = join(landingSource, name);
      if (await pathExists(navPath)) {
        navbarContent = await readFile(navPath, 'utf-8');
        break;
      }
    }
  }

  if (!footerHidden) {
    const footerPath = join(landingSource, 'footer.html');
    if (await pathExists(footerPath)) {
      footerContent = await readFile(footerPath, 'utf-8');
    }
  }

  // Also check config for custom navbar/footer (skip if hidden)
  if (!navbarHidden && !navbarContent && landingConfig.navbar?.html) {
    const navPath = join(sourcePath, landingConfig.navbar.html);
    if (await pathExists(navPath)) {
      navbarContent = await readFile(navPath, 'utf-8');
    }
  }
  if (!footerHidden && !footerContent && landingConfig.footer?.html) {
    const fPath = join(sourcePath, landingConfig.footer.html);
    if (await pathExists(fPath)) {
      footerContent = await readFile(fPath, 'utf-8');
    }
  }

  // Generate sections landing for framework
  await generateSectionsLandingForFramework(
    projectDir,
    frameworkConfig,
    {
      sections: processedSections,
      navbarContent,
      footerContent,
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
  const { sourcePath, htmlFiles, cssFiles, jsFiles, navbarContent, footerContent, config } = landingData;

  // Read main HTML file
  const mainHtml = htmlFiles.includes('index.html') ? 'index.html' : htmlFiles[0];
  if (!mainHtml) {
    console.warn('Warning: No HTML file found in _landing/');
    return;
  }

  let htmlContent = await readFile(join(sourcePath, mainHtml), 'utf-8');

  // Make all <script> tags in the user's HTML pass through Astro untouched
  htmlContent = inlineForAstro(htmlContent);

  // Read CSS files and write to a separate file
  let cssContent = '';
  for (const cssFile of cssFiles) {
    const css = await readFile(join(sourcePath, cssFile), 'utf-8');
    cssContent += `/* ${cssFile} */\n${css}\n\n`;
  }

  // Write landing CSS to a separate file so Vite processes it through the full pipeline
  const landingCssPath = join(projectDir, 'src', 'styles', 'landing.css');
  await writeFile(landingCssPath, cssContent, 'utf-8');

  // Read JS files
  let jsContent = '';
  for (const jsFile of jsFiles) {
    const js = await readFile(join(sourcePath, jsFile), 'utf-8');
    jsContent += `// ${jsFile}\n${js}\n\n`;
  }

  // Check if the user's HTML is a full document (has <html>, <head>, <body>)
  const parsed = parseFullHtmlDocument(htmlContent);

  let astroContent;

  if (parsed) {
    // Full HTML document: merge the user's head/body into the Astro page
    // instead of nesting an entire HTML document inside another one.
    astroContent = generateAstroFromFullDoc(parsed, { cssFiles, jsContent, navbarContent, footerContent });
  } else {
    // HTML fragment: wrap it in a full Astro page
    astroContent = generateAstroFromFragment(htmlContent, { jsContent, navbarContent, footerContent });
  }

  // Write to index.astro
  const indexPath = join(projectDir, 'src', 'pages', 'index.astro');
  await writeFile(indexPath, astroContent, 'utf-8');

  // Copy assets if they exist
  await copyLandingAssets(sourcePath, projectDir);
}

/**
 * Generate Astro page from a full HTML document.
 * Extracts <head> and <body> content, preserves the user's structure.
 */
function generateAstroFromFullDoc(parsed, { cssFiles, jsContent, navbarContent, footerContent }) {
  const { htmlAttrs, headContent, bodyContent, bodyAttrs } = parsed;

  // Determine header/footer rendering
  const navbarIsHidden = navbarContent === '__hidden__';
  const footerIsHidden = footerContent === '__hidden__';
  const hasCustomNavbar = !navbarIsHidden && !!navbarContent;
  const hasCustomFooter = !footerIsHidden && !!footerContent;

  const headerImport = navbarIsHidden || hasCustomNavbar ? '' : "import Header from '../components/Header.astro';";
  const footerImport = footerIsHidden || hasCustomFooter ? '' : "import Footer from '../components/Footer.astro';";
  const headerRender = navbarIsHidden
    ? ''
    : hasCustomNavbar
      ? `<header class="landing-custom-navbar">\n      ${inlineForAstro(navbarContent)}\n    </header>`
      : '<Header />';
  const footerRender = footerIsHidden
    ? ''
    : hasCustomFooter
      ? `<footer class="landing-custom-footer">\n      ${inlineForAstro(footerContent)}\n    </footer>`
      : '<Footer />';

  return `---
// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder (full HTML document)
import '../styles/landing.css';
${headerImport}
${footerImport}
---

<!doctype html>
<html ${htmlAttrs}>
  <head>
    ${headContent}
  </head>
  <body ${bodyAttrs}>
    ${headerRender}

    ${bodyContent}

    ${footerRender}

    ${jsContent ? `<script is:inline>\n${jsContent}\n</script>` : ''}
  </body>
</html>
`;
}

/**
 * Generate Astro page from an HTML fragment.
 * Wraps it in a full Astro page with Lito's defaults.
 */
function generateAstroFromFragment(htmlContent, { jsContent, navbarContent, footerContent }) {
  const navbarIsHidden = navbarContent === '__hidden__';
  const footerIsHidden = footerContent === '__hidden__';
  const hasCustomNavbar = !navbarIsHidden && !!navbarContent;
  const hasCustomFooter = !footerIsHidden && !!footerContent;

  const headerImport = navbarIsHidden || hasCustomNavbar ? '' : "import Header from '../components/Header.astro';";
  const footerImport = footerIsHidden || hasCustomFooter ? '' : "import Footer from '../components/Footer.astro';";
  const headerRender = navbarIsHidden
    ? ''
    : hasCustomNavbar
      ? `<header class="landing-custom-navbar">\n      ${inlineForAstro(navbarContent)}\n    </header>`
      : '<Header />';
  const footerRender = footerIsHidden
    ? ''
    : hasCustomFooter
      ? `<footer class="landing-custom-footer">\n      ${inlineForAstro(footerContent)}\n    </footer>`
      : '<Footer />';

  return `---
// Custom landing page - auto-generated by Lito CLI
// Source: _landing/ folder
import '../styles/global.css';
import '../styles/landing.css';
${headerImport}
${footerImport}
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
  </head>
  <body class="bg-background text-foreground font-sans antialiased">
    ${headerRender}

    <main class="landing-custom">
      ${htmlContent}
    </main>

    ${footerRender}

    ${jsContent ? `<script is:inline>\n${jsContent}\n</script>` : ''}
  </body>
</html>
`;
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
  const { sections, navbarContent, footerContent, config } = landingData;

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

  // Determine header/footer: hidden ('__hidden__'), custom (string HTML), or default (null)
  const navbarIsHidden = navbarContent === '__hidden__';
  const footerIsHidden = footerContent === '__hidden__';
  const hasCustomNavbar = !navbarIsHidden && !!navbarContent;
  const hasCustomFooter = !footerIsHidden && !!footerContent;

  const headerImport = navbarIsHidden || hasCustomNavbar ? '' : "import Header from '../components/Header.astro';";
  const footerImport = footerIsHidden || hasCustomFooter ? '' : "import Footer from '../components/Footer.astro';";
  const headerRender = navbarIsHidden
    ? ''
    : hasCustomNavbar
      ? `<header class="landing-custom-navbar">\n      ${inlineForAstro(navbarContent)}\n    </header>`
      : '<Header />';
  const footerRender = footerIsHidden
    ? ''
    : hasCustomFooter
      ? `<footer class="landing-custom-footer">\n      ${inlineForAstro(footerContent)}\n    </footer>`
      : '<Footer />';

  const astroContent = `---
// Sections-based landing page - auto-generated by Lito CLI
import '../styles/global.css';
${headerImport}
${footerImport}
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
    ${headerRender}

    <main class="landing-sections">
      ${sectionRenders}
    </main>

    ${footerRender}
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
