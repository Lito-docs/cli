/**
 * Template Registry - Maps shorthand names to GitHub template URLs
 * 
 * Users can use these short names instead of full GitHub URLs:
 *   superdocs dev -i . --theme modern
 * 
 * Instead of:
 *   superdocs dev -i . --theme github:devrohit06/superdocs-theme-modern
 */

export const TEMPLATE_REGISTRY = {
    // Default template (fetched from GitHub)
    'default': 'github:DevRohit06/superdocs-default-template',

    // Official templates
    // 'modern': 'github:devrohit06/superdocs-theme-modern',
    // 'minimal': 'github:devrohit06/superdocs-theme-minimal',
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
