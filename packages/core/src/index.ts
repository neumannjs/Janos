/**
 * @janos/core
 *
 * Core abstractions for Janos static site generator.
 * Provides filesystem, git, authentication, and content pipeline interfaces.
 */

// Filesystem module
export * from './fs/index.js';

// Git module
export * from './git/index.js';

// Authentication module
export * from './auth/index.js';

// Pipeline module
export * from './pipeline/index.js';

// Template engines
export * from './templates/index.js';

// Image processing
export * from './images/index.js';

/**
 * Version information
 */
export const VERSION = '0.1.0';
