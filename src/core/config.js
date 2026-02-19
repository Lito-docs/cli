import pkg from "fs-extra";
const { readFile, writeFile, ensureDir, pathExists } = pkg;
import { join } from "path";
import { generateThemeStyles } from "./colors.js";

/**
 * Generate configuration for the project
 * @param {string} projectDir - The scaffolded project directory
 * @param {object} options - CLI options
 * @param {object|null} frameworkConfig - Framework configuration (optional)
 */
export async function generateConfig(projectDir, options, frameworkConfig = null) {
  const {
    baseUrl,
    name,
    description,
    primaryColor,
    accentColor,
    favicon,
    logo,
  } = options;

  // Update docs-config.json with metadata and theme options
  const configPath = join(projectDir, "docs-config.json");
  let config = JSON.parse(await readFile(configPath, "utf-8"));

  // Update metadata
  if (name) {
    config.metadata = config.metadata || {};
    config.metadata.name = name;
  }

  if (description) {
    config.metadata = config.metadata || {};
    config.metadata.description = description;
  }

  // Update theme colors
  if (primaryColor || accentColor) {
    config.theme = config.theme || {};
    config.branding = config.branding || {};
    config.branding.colors = config.branding.colors || {};

    if (primaryColor) {
      config.theme.primaryColor = primaryColor;
      config.branding.colors.primary = primaryColor;
    }
    if (accentColor) {
      config.theme.accentColor = accentColor;
      config.branding.colors.accent = accentColor;
    }
  }

  // Update branding
  if (favicon || logo) {
    config.branding = config.branding || {};
    if (favicon) config.branding.favicon = favicon;
    if (logo) config.branding.logo = config.branding.logo || {};
    if (logo) config.branding.logo.src = logo;
  }

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

  // Generate theme styles
  if (config.branding?.colors?.primary) {
    const themeStyles = generateThemeStyles(config.branding.colors);
    const stylesDir = join(projectDir, "src", "styles");
    await ensureDir(stylesDir);
    await writeFile(join(stylesDir, "generated-theme.css"), themeStyles, "utf-8");
  } else {
    // Write empty file to avoid import error
    const stylesDir = join(projectDir, "src", "styles");
    await ensureDir(stylesDir);
    await writeFile(join(stylesDir, "generated-theme.css"), "/* No generated theme styles */", "utf-8");
  }

  // Update astro.config.mjs with base URL and site URL (only for Astro)
  const frameworkName = frameworkConfig?.name || 'astro';

  if (frameworkName === 'astro' && ((baseUrl && baseUrl !== "/") || config.metadata?.url)) {
    const astroConfigPath = join(projectDir, "astro.config.mjs");
    if (await pathExists(astroConfigPath)) {
      let content = await readFile(astroConfigPath, "utf-8");

      let injection = "export default defineConfig({\n";

      if (baseUrl && baseUrl !== "/") {
        injection += `  base: '${baseUrl}',\n`;
      }

      if (config.metadata?.url) {
        injection += `  site: '${config.metadata.url}',\n`;
      }

      // Add base/site option to defineConfig
      content = content.replace(
        "export default defineConfig({",
        injection
      );

      await writeFile(astroConfigPath, content, "utf-8");
    }
  }

  // Inject llms.txt integration into astro.config.mjs
  if (frameworkName === 'astro' && config.integrations?.llmsTxt?.enabled && config.metadata?.url) {
    const astroConfigPath = join(projectDir, "astro.config.mjs");
    if (await pathExists(astroConfigPath)) {
      let content = await readFile(astroConfigPath, "utf-8");

      // Add import after the last existing import line
      const importLine = `import astroLlmsTxt from '@4hse/astro-llms-txt';`;
      if (!content.includes(importLine)) {
        const lines = content.split('\n');
        let lastImportIdx = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ')) lastImportIdx = i;
        }
        lines.splice(lastImportIdx + 1, 0, importLine);
        content = lines.join('\n');
      }

      // Build the integration call
      const llmsTitle = config.integrations.llmsTxt.title || config.metadata.name || 'Documentation';
      const llmsDesc = config.integrations.llmsTxt.description || config.metadata.description || '';
      const llmsConfig = `    astroLlmsTxt({
      title: ${JSON.stringify(llmsTitle)},
      description: ${JSON.stringify(llmsDesc)},
      docSet: [
        {
          title: ${JSON.stringify(llmsTitle + ' - Full Documentation')},
          description: ${JSON.stringify('Complete documentation content')},
          url: '/llms-full.txt',
          include: ['**'],
          mainSelector: 'article',
          ignoreSelectors: ['nav', '.sidebar', '.toc', 'footer', '.breadcrumbs'],
        },
        {
          title: ${JSON.stringify(llmsTitle + ' - Structure')},
          description: ${JSON.stringify('Documentation structure overview')},
          url: '/llms-small.txt',
          include: ['**'],
          onlyStructure: true,
          mainSelector: 'article',
          ignoreSelectors: ['nav', '.sidebar', '.toc', 'footer', '.breadcrumbs'],
        },
      ],
    }),`;

      // Insert after sitemap() in integrations array
      if (content.includes('sitemap(),')) {
        content = content.replace(
          'sitemap(),',
          `sitemap(),\n${llmsConfig}`
        );
      } else {
        // Fallback: insert at start of integrations array
        content = content.replace(
          'integrations: [',
          `integrations: [\n${llmsConfig}`
        );
      }

      await writeFile(astroConfigPath, content, "utf-8");
    }
  }

  // Inject redirects into astro.config.mjs
  if (frameworkName === 'astro' && config.redirects && Object.keys(config.redirects).length > 0) {
    const astroConfigPath = join(projectDir, "astro.config.mjs");
    if (await pathExists(astroConfigPath)) {
      let content = await readFile(astroConfigPath, "utf-8");

      // Build redirects object for Astro config
      const redirectEntries = Object.entries(config.redirects).map(([source, dest]) => {
        if (typeof dest === 'string') {
          return `    '${source}': '${dest}'`;
        }
        return `    '${source}': { status: ${dest.status || 301}, destination: '${dest.destination}' }`;
      });

      const redirectsBlock = `  redirects: {\n${redirectEntries.join(',\n')}\n  },`;

      content = content.replace(
        "export default defineConfig({",
        `export default defineConfig({\n${redirectsBlock}`
      );

      await writeFile(astroConfigPath, content, "utf-8");
    }
  }

  // Update vite.config.js for React/Vue frameworks
  if (['react', 'vue'].includes(frameworkName) && baseUrl && baseUrl !== "/") {
    const viteConfigPath = join(projectDir, "vite.config.js");
    if (await pathExists(viteConfigPath)) {
      let content = await readFile(viteConfigPath, "utf-8");

      // Add base option to defineConfig
      if (content.includes("defineConfig({")) {
        content = content.replace(
          "defineConfig({",
          `defineConfig({\n  base: '${baseUrl}',`
        );
        await writeFile(viteConfigPath, content, "utf-8");
      }
    }
  }

  // Update next.config.js for Next.js
  if (frameworkName === 'next' && baseUrl && baseUrl !== "/") {
    const nextConfigPath = join(projectDir, "next.config.js");
    if (await pathExists(nextConfigPath)) {
      let content = await readFile(nextConfigPath, "utf-8");

      // Add basePath to Next.js config
      if (!content.includes("basePath")) {
        content = content.replace(
          "module.exports = {",
          `module.exports = {\n  basePath: '${baseUrl}',`
        );
        await writeFile(nextConfigPath, content, "utf-8");
      }
    }
  }
}
