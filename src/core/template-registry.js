/**
 * Template Registry - Maps shorthand names to GitHub template URLs
 *
 * Users can use these short names instead of full GitHub URLs:
 *   lito dev -i . --theme modern
 *
 * Instead of:
 *   lito dev -i . --theme github:devrohit06/lito-theme-modern
 */

export const TEMPLATE_REGISTRY = {
    // Default template - Astro-based
    'default': 'github:Lito-docs/lito-astro-template',

    // Framework-specific templates
    'astro': 'github:Lito-docs/lito-astro-template',
    'react': 'github:Lito-docs/lito-react-template',
    'next': 'github:Lito-docs/lito-next-template',
    'vue': 'github:Lito-docs/lito-vue-template',
    'nuxt': 'github:Lito-docs/lito-nuxt-template',
};

/**
 * Resolve a registry name to a GitHub URL or null for bundled
 * Returns undefined if the name is not in the registry
 */
export function resolveRegistryName(name) {
    if (name in TEMPLATE_REGISTRY) {
        return TEMPLATE_REGISTRY[name];
    }
    return undefined;
}

/**
 * Get all available template names from the registry
 */
export function getRegistryNames() {
    return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * Get template info from registry
 */
export function getRegistryInfo(name) {
    if (name in TEMPLATE_REGISTRY) {
        return {
            name,
            source: TEMPLATE_REGISTRY[name] || 'bundled',
            isBundled: TEMPLATE_REGISTRY[name] === null
        };
    }
    return null;
}
