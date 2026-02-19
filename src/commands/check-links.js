import { resolve } from 'path';
import { intro, outro, log, spinner } from '@clack/prompts';
import pc from 'picocolors';
import { checkLinks } from '../core/link-checker.js';

/**
 * Check links command — scan docs for broken internal links.
 */
export async function checkLinksCommand(options) {
  try {
    const inputPath = options.input ? resolve(options.input) : process.cwd();

    // Quiet mode for CI
    if (options.quiet) {
      const result = await checkLinks(inputPath);
      process.exit(result.brokenLinks.length > 0 ? 1 : 0);
    }

    console.clear();
    intro(pc.inverse(pc.cyan(' Lito - Check Links ')));

    const s = spinner();
    s.start('Scanning documentation for broken links...');

    const result = await checkLinks(inputPath);

    if (result.brokenLinks.length === 0) {
      s.stop(pc.green('All links are valid!'));
      log.message('');
      log.success(`Checked ${pc.bold(result.totalLinks)} links across ${pc.bold(result.checkedFiles)} files`);
      log.message('');
      outro(pc.green('No broken links found!'));
      return;
    }

    s.stop(pc.yellow(`Found ${result.brokenLinks.length} broken link(s)`));
    log.message('');

    // Group broken links by file
    const byFile = new Map();
    for (const bl of result.brokenLinks) {
      if (!byFile.has(bl.file)) byFile.set(bl.file, []);
      byFile.get(bl.file).push(bl);
    }

    for (const [file, links] of byFile) {
      log.message(pc.bold(pc.cyan(file)));
      for (const bl of links) {
        const label = bl.text ? ` (${pc.dim(bl.text)})` : '';
        log.message(`  ${pc.red('✗')} ${bl.link}${label}`);
        if (bl.suggestion) {
          log.message(`    ${pc.dim('Did you mean:')} ${pc.green(bl.suggestion)}`);
        }
      }
      log.message('');
    }

    log.message(pc.dim('─'.repeat(50)));
    log.message(`${pc.bold('Summary:')} ${pc.red(result.brokenLinks.length + ' broken')} out of ${result.totalLinks} links in ${result.checkedFiles} files`);
    log.message('');

    if (options.strict) {
      outro(pc.red('Link check failed (strict mode)'));
      process.exit(1);
    } else {
      outro(pc.yellow('Link check complete with warnings'));
    }
  } catch (error) {
    log.error(pc.red(error.message));
    if (error.stack && !options.quiet) {
      log.error(pc.gray(error.stack));
    }
    process.exit(1);
  }
}
