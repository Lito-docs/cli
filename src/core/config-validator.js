/**
 * Configuration Validator
 *
 * Validates user docs-config.json against the core schema.
 * Core config is strictly validated - extensions are always allowed
 * (templates simply ignore what they don't support).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Core schema defines portable config across all templates
const CORE_SCHEMA_PATH = join(__dirname, '../schema/core-schema.json');

// Core config keys that all templates must support
const CORE_CONFIG_KEYS = [
  'metadata',
  'branding',
  'navigation',
  'search',
  'seo',
  'i18n',
  'assets'
];

// Extension keys that are template-specific (optional, never cause errors)
const EXTENSION_KEYS = [
  'footer',
  'theme',
  'landing',
  'integrations',
  'versioning'
];

/**
 * Load the core schema
 */
function loadCoreSchema() {
  if (!existsSync(CORE_SCHEMA_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(CORE_SCHEMA_PATH, 'utf-8'));
}

/**
 * Load template manifest from project directory
 */
export function loadTemplateManifest(projectDir) {
  const manifestPath = join(projectDir, 'template.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Validate configuration against core schema (basic validation)
 * Only validates REQUIRED fields and types - extensions are always allowed.
 */
function validateCoreConfig(config, schema) {
  const errors = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in config)) {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing`
        });
      }
    }
  }

  // Check metadata.name is required
  if (config.metadata && !config.metadata.name) {
    errors.push({
      path: 'metadata.name',
      message: "Required field 'metadata.name' is missing"
    });
  }

  // Validate types for core fields
  if (config.metadata && typeof config.metadata !== 'object') {
    errors.push({
      path: 'metadata',
      message: "'metadata' must be an object"
    });
  }

  if (config.navigation?.sidebar && !Array.isArray(config.navigation.sidebar)) {
    errors.push({
      path: 'navigation.sidebar',
      message: "'navigation.sidebar' must be an array"
    });
  }

  if (config.navigation?.navbar?.links && !Array.isArray(config.navigation.navbar.links)) {
    errors.push({
      path: 'navigation.navbar.links',
      message: "'navigation.navbar.links' must be an array"
    });
  }

  // Validate sidebar items structure
  if (config.navigation?.sidebar && Array.isArray(config.navigation.sidebar)) {
    config.navigation.sidebar.forEach((group, i) => {
      if (!group.label) {
        errors.push({
          path: `navigation.sidebar[${i}].label`,
          message: `Sidebar group at index ${i} is missing required 'label' field`
        });
      }
      if (group.items && !Array.isArray(group.items)) {
        errors.push({
          path: `navigation.sidebar[${i}].items`,
          message: `Sidebar group '${group.label}' items must be an array`
        });
      }
    });
  }

  return errors;
}

/**
 * Validate user configuration
 *
 * Only validates core config structure. Extensions are always allowed -
 * templates simply ignore what they don't support.
 *
 * @param {object} config - User's docs-config.json content
 * @param {string} projectDir - Path to the project directory
 * @param {object} options - Validation options
 * @param {boolean} options.silent - If true, don't print anything
 * @returns {{ valid: boolean, errors: Array }}
 */
export function validateConfig(config, projectDir, options = {}) {
  const { silent = false } = options;

  const coreSchema = loadCoreSchema();

  // Only validate core config - extensions are always allowed
  const coreErrors = coreSchema ? validateCoreConfig(config, coreSchema) : [];

  const result = {
    valid: coreErrors.length === 0,
    errors: coreErrors,
    manifest: loadTemplateManifest(projectDir)
  };

  if (!silent && coreErrors.length > 0) {
    printValidationErrors(coreErrors);
  }

  return result;
}

/**
 * Print validation errors to console
 */
function printValidationErrors(errors) {
  console.log(pc.red('\n✗ Configuration validation failed:\n'));
  for (const error of errors) {
    console.log(pc.red(`  • ${error.path}: ${error.message}`));
  }
  console.log('');
}

/**
 * Get list of portable (core) config keys
 */
export function getCoreConfigKeys() {
  return [...CORE_CONFIG_KEYS];
}

/**
 * Get list of extension config keys
 */
export function getExtensionKeys() {
  return [...EXTENSION_KEYS];
}

/**
 * Extract only core config from a full config object
 */
export function extractCoreConfig(config) {
  const coreConfig = {};
  for (const key of CORE_CONFIG_KEYS) {
    if (key in config) {
      coreConfig[key] = config[key];
    }
  }
  return coreConfig;
}

/**
 * Extract only extension config from a full config object
 */
export function extractExtensionConfig(config) {
  const extensionConfig = {};
  for (const key of EXTENSION_KEYS) {
    if (key in config) {
      extensionConfig[key] = config[key];
    }
  }
  return extensionConfig;
}

/**
 * Check if config is portable (uses only core config)
 * Useful for users who want to ensure their config works with any template.
 */
export function isPortableConfig(config) {
  for (const key of EXTENSION_KEYS) {
    if (key in config) {
      return false;
    }
  }
  return true;
}
