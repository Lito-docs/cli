import { Command } from "commander";
import pc from "picocolors";
import { buildCommand } from "./commands/build.js";
import { devCommand } from "./commands/dev.js";
import { ejectCommand } from "./commands/eject.js";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { previewCommand } from "./commands/preview.js";
import { doctorCommand } from "./commands/doctor.js";
import { infoCommand } from "./commands/info.js";
import {
  templateListCommand,
  templateCacheCommand,
} from "./commands/template.js";
import { checkForUpdates, upgradeCommand } from "./core/update-check.js";

export async function cli() {
  const program = new Command();

  // Check for updates in the background (non-blocking)
  checkForUpdates();

  program
    .name("lito")
    .description(
      "Beautiful documentation sites from Markdown. Fast, simple, and open-source."
    )
    .version("0.6.0");

  program
    .command("build")
    .description("Build the documentation site")
    .requiredOption("-i, --input <path>", "Path to the docs folder")
    .option(
      "-o, --output <path>",
      "Output directory for the built site",
      "./dist"
    )
    .option(
      "-t, --template <name>",
      "Template to use (default, github:owner/repo, or local path)",
      "default"
    )
    .option("-b, --base-url <url>", "Base URL for the site", "/")
    .option("--name <name>", "Project name")
    .option("--description <description>", "Project description")
    .option("--primary-color <color>", "Primary theme color (hex)")
    .option("--accent-color <color>", "Accent theme color (hex)")
    .option("--favicon <path>", "Favicon path")
    .option("--logo <path>", "Logo path")
    .option("--provider <name>", "Hosting provider optimization (vercel, netlify, cloudflare, static)", "static")
    .option("--rendering <type>", "Rendering mode (static, server, hybrid)", "static")
    .option("--search", "Enable search functionality", false)
    .option("--refresh", "Force re-download template (bypass cache)", false)
    .action(buildCommand);

  program
    .command("dev")
    .description("Start development server with watch mode")
    .requiredOption("-i, --input <path>", "Path to the docs folder")
    .option(
      "-t, --template <name>",
      "Template to use (default, github:owner/repo, or local path)",
      "default"
    )
    .option("-b, --base-url <url>", "Base URL for the site", "/")
    .option("--name <name>", "Project name")
    .option("--description <description>", "Project description")
    .option("--primary-color <color>", "Primary theme color (hex)")
    .option("--accent-color <color>", "Accent theme color (hex)")
    .option("--favicon <path>", "Favicon path")
    .option("--logo <path>", "Logo path")
    .option("--search", "Enable search functionality", false)
    .option("-p, --port <number>", "Port for dev server", "4321")
    .option("--refresh", "Force re-download template (bypass cache)", false)
    .action(devCommand);

  program
    .command("eject")
    .description("Export the full Astro project source code")
    .requiredOption("-i, --input <path>", "Path to the docs folder")
    .option(
      "-o, --output <path>",
      "Output directory for the project",
      "./astro-docs-project"
    )
    .option(
      "-t, --template <name>",
      "Template to use (default, github:owner/repo, or local path)",
      "default"
    )
    .option("-b, --base-url <url>", "Base URL for the site", "/")
    .option("--name <name>", "Project name")
    .option("--description <description>", "Project description")
    .option("--primary-color <color>", "Primary theme color (hex)")
    .option("--accent-color <color>", "Accent theme color (hex)")
    .option("--favicon <path>", "Favicon path")
    .option("--logo <path>", "Logo path")
    .option("--search", "Enable search functionality", false)
    .option("--refresh", "Force re-download template (bypass cache)", false)
    .action(ejectCommand);

  // Initialize a new project
  program
    .command("init")
    .description("Initialize a new documentation project")
    .option("-o, --output <path>", "Output directory for the project")
    .option("-n, --name <name>", "Project name")
    .option("-t, --template <name>", "Template to use", "default")
    .option("--sample", "Create sample documentation pages", true)
    .action(initCommand);

  // Validate configuration
  program
    .command("validate")
    .description("Validate docs-config.json configuration")
    .option("-i, --input <path>", "Path to the docs folder")
    .option("-q, --quiet", "Quiet mode for CI (exit code only)")
    .action(validateCommand);

  // Preview production build
  program
    .command("preview")
    .description("Preview production build locally")
    .option("-i, --input <path>", "Path to docs folder (will build if no dist exists)")
    .option("-o, --output <path>", "Path to built site", "./dist")
    .option("-t, --template <name>", "Template to use if building", "default")
    .option("-b, --base-url <url>", "Base URL for the site", "/")
    .option("-p, --port <number>", "Port for preview server", "4321")
    .action(previewCommand);

  // Doctor - diagnose issues
  program
    .command("doctor")
    .description("Diagnose common issues with your docs project")
    .option("-i, --input <path>", "Path to the docs folder")
    .action(doctorCommand);

  // Info - show project information
  program
    .command("info")
    .description("Show project information and statistics")
    .option("-i, --input <path>", "Path to the docs folder")
    .action(infoCommand);

  // Template management commands
  const templateCmd = program
    .command("template")
    .description("Manage documentation templates");

  templateCmd
    .command("list")
    .description("List available templates")
    .action(templateListCommand);

  templateCmd
    .command("cache")
    .description("Manage template cache")
    .option("--clear", "Clear all cached templates")
    .action(templateCacheCommand);

  program
    .command("upgrade")
    .description("Check for updates and upgrade to the latest version")
    .action(upgradeCommand);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(pc.red("Error:"), error.message);
    process.exit(1);
  }
}
