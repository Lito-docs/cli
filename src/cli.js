import { Command } from "commander";
import pc from "picocolors";
import { buildCommand } from "./commands/build.js";
import { devCommand } from "./commands/dev.js";
import { ejectCommand } from "./commands/eject.js";
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
