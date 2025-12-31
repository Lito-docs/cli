import { intro, outro, spinner, log, note } from '@clack/prompts';
import pc from 'picocolors';
import { listCachedTemplates, clearTemplateCache } from '../core/template-fetcher.js';
import { getRegistryNames, getRegistryInfo } from '../core/template-registry.js';

/**
 * List available templates
 */
export async function templateListCommand() {
    intro(pc.inverse(pc.cyan(' SuperDocs - Templates ')));

    // Show registry templates
    const names = getRegistryNames();

    log.info(pc.bold('Available Templates:'));
    console.log('');

    for (const name of names) {
        const info = getRegistryInfo(name);
        console.log(`  ${pc.blue('●')} ${pc.bold(name)} ${pc.dim(`→ ${info.source}`)}`);
    }

    console.log('');
    log.info(pc.dim('You can also use GitHub URLs directly:'));
    console.log(pc.dim('  superdocs dev -i . --template github:owner/repo'));
    console.log(pc.dim('  superdocs dev -i . --template github:owner/repo#v1.0.0'));
    console.log('');

    // Show cached templates
    const cached = await listCachedTemplates();
    if (cached.length > 0) {
        log.info(pc.bold('Cached Templates:'));
        console.log('');
        for (const t of cached) {
            const age = Math.round((Date.now() - t.cachedAt) / (1000 * 60));
            console.log(`  ${pc.yellow('●')} ${t.owner}/${t.repo}#${t.ref} ${pc.dim(`(cached ${age}m ago)`)}`);
        }
        console.log('');
    }

    outro(pc.dim('Use --template to select a template'));
}

/**
 * Manage template cache
 */
export async function templateCacheCommand(options) {
    intro(pc.inverse(pc.cyan(' SuperDocs - Template Cache ')));

    if (options.clear) {
        const s = spinner();
        s.start('Clearing template cache...');
        await clearTemplateCache();
        s.stop('Template cache cleared');
        outro(pc.green('Done!'));
        return;
    }

    // Show cache info
    const cached = await listCachedTemplates();

    if (cached.length === 0) {
        log.info('No templates cached.');
        outro('');
        return;
    }

    log.info(pc.bold(`${cached.length} template(s) cached:`));
    console.log('');

    for (const t of cached) {
        const age = Math.round((Date.now() - t.cachedAt) / (1000 * 60 * 60));
        console.log(`  ${pc.cyan(t.owner)}/${pc.cyan(t.repo)}#${pc.yellow(t.ref)}`);
        console.log(`    ${pc.dim(`Cached ${age}h ago`)}`);
    }

    console.log('');
    note('superdocs template cache --clear', 'To clear cache');
    outro('');
}
