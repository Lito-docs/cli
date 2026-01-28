import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { intro, outro, text, select, confirm, spinner, log, isCancel, cancel } from '@clack/prompts';
import pc from 'picocolors';
import { TEMPLATE_REGISTRY } from '../core/template-registry.js';

/**
 * Default docs-config.json template
 */
function createDefaultConfig(projectName, framework) {
  return {
    metadata: {
      name: projectName,
      description: `Documentation for ${projectName}`,
    },
    branding: {
      colors: {
        primary: '#10b981',
        accent: '#3b82f6',
      },
    },
    navigation: {
      navbar: {
        links: [
          { label: 'Docs', href: '/' },
          { label: 'GitHub', href: 'https://github.com' },
        ],
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', href: '/introduction' },
            { label: 'Quick Start', href: '/quickstart' },
          ],
        },
      ],
    },
    search: {
      enabled: true,
    },
  };
}

/**
 * Sample introduction page content
 */
function createIntroductionPage(projectName) {
  return `---
title: Introduction
description: Welcome to ${projectName}
---

# Welcome to ${projectName}

This is your documentation home. Edit this file at \`introduction.mdx\` to get started.

## Features

<CardGroup cols={2}>
  <Card title="Fast" icon="bolt">
    Built for speed with static site generation
  </Card>
  <Card title="Flexible" icon="puzzle-piece">
    Customize with MDX components
  </Card>
</CardGroup>

## Next Steps

- Read the [Quick Start](/quickstart) guide
- Explore the MDX components available
- Customize your \`docs-config.json\`
`;
}

/**
 * Sample quickstart page content
 */
function createQuickstartPage(projectName) {
  return `---
title: Quick Start
description: Get up and running with ${projectName}
---

# Quick Start

Get your documentation site running in minutes.

## Installation

<Steps>
  <Step title="Install Lito CLI">
    \`\`\`bash
    npm install -g @aspect-ui/lito
    \`\`\`
  </Step>

  <Step title="Start Development Server">
    \`\`\`bash
    lito dev -i ./docs
    \`\`\`
  </Step>

  <Step title="Build for Production">
    \`\`\`bash
    lito build -i ./docs -o ./dist
    \`\`\`
  </Step>
</Steps>

## Configuration

Edit \`docs-config.json\` to customize your site:

\`\`\`json
{
  "metadata": {
    "name": "${projectName}",
    "description": "Your project description"
  }
}
\`\`\`

> [!TIP]
> Run \`lito validate\` to check your configuration for errors.
`;
}

/**
 * Init command - Initialize a new documentation project
 */
export async function initCommand(options) {
  try {
    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Initialize New Project ')));

    // Determine output directory
    let outputDir = options.output ? resolve(options.output) : null;

    if (!outputDir) {
      const dirAnswer = await text({
        message: 'Where should we create your docs?',
        placeholder: './docs',
        defaultValue: './docs',
        validate: (value) => {
          if (!value) return 'Please enter a directory path';
        },
      });

      if (isCancel(dirAnswer)) {
        cancel('Operation cancelled.');
        process.exit(0);
      }

      outputDir = resolve(dirAnswer);
    }

    // Check if directory exists and has content
    if (existsSync(outputDir)) {
      const files = await import('fs').then(fs => fs.readdirSync(outputDir));
      if (files.length > 0) {
        const overwrite = await confirm({
          message: `Directory ${pc.cyan(outputDir)} is not empty. Continue anyway?`,
          initialValue: false,
        });

        if (isCancel(overwrite) || !overwrite) {
          cancel('Operation cancelled.');
          process.exit(0);
        }
      }
    }

    // Project name
    let projectName = options.name;
    if (!projectName) {
      const nameAnswer = await text({
        message: 'What is your project name?',
        placeholder: 'My Docs',
        defaultValue: 'My Docs',
      });

      if (isCancel(nameAnswer)) {
        cancel('Operation cancelled.');
        process.exit(0);
      }

      projectName = nameAnswer;
    }

    // Framework/template selection
    const templates = Object.keys(TEMPLATE_REGISTRY);
    let selectedTemplate = options.template;

    if (!selectedTemplate) {
      const templateAnswer = await select({
        message: 'Which template would you like to use?',
        options: templates.map((t) => ({
          value: t,
          label: t === 'default' ? `${t} (Astro - Recommended)` : t,
          hint: TEMPLATE_REGISTRY[t],
        })),
      });

      if (isCancel(templateAnswer)) {
        cancel('Operation cancelled.');
        process.exit(0);
      }

      selectedTemplate = templateAnswer;
    }

    // Create sample content?
    let createSample = options.sample !== false;
    if (!options.sample) {
      const sampleAnswer = await confirm({
        message: 'Create sample documentation pages?',
        initialValue: true,
      });

      if (isCancel(sampleAnswer)) {
        cancel('Operation cancelled.');
        process.exit(0);
      }

      createSample = sampleAnswer;
    }

    // Create project
    const s = spinner();
    s.start('Creating project structure...');

    // Create directories
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(join(outputDir, '_assets'), { recursive: true });
    mkdirSync(join(outputDir, '_images'), { recursive: true });

    // Create docs-config.json
    const config = createDefaultConfig(projectName, selectedTemplate);
    writeFileSync(
      join(outputDir, 'docs-config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create sample pages if requested
    if (createSample) {
      writeFileSync(
        join(outputDir, 'introduction.mdx'),
        createIntroductionPage(projectName)
      );
      writeFileSync(
        join(outputDir, 'quickstart.mdx'),
        createQuickstartPage(projectName)
      );
    }

    s.stop('Project created');

    // Success message
    log.success(pc.green('Project initialized successfully!'));
    log.message('');
    log.message(pc.bold('Next steps:'));
    log.message('');
    log.message(`  ${pc.cyan('cd')} ${outputDir}`);
    log.message(`  ${pc.cyan('lito dev')} -i .`);
    log.message('');
    log.message(pc.dim(`Template: ${selectedTemplate}`));
    log.message(pc.dim(`Config: ${join(outputDir, 'docs-config.json')}`));

    outro(pc.green('Happy documenting! 📚'));
  } catch (error) {
    if (isCancel(error)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }

    log.error(pc.red(error.message));
    if (error.stack) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
