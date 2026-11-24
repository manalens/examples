// The values that the Base layout puts in the analytics script tag.

/**
 * The project Publishable key (mana_pk_...). It is public and safe in a page.
 * Empty turns analytics off: the layout then adds no script tag.
 * PUBLIC_ variables go into the built pages, so never put a Secret key here.
 */
export const MANALENS_PUBLISHABLE_KEY: string = import.meta.env.PUBLIC_MANALENS_PUBLISHABLE_KEY ?? '';

/** The collector URL, without /v0/events. */
export const MANALENS_ENDPOINT: string = import.meta.env.PUBLIC_MANALENS_ENDPOINT ?? '';

/**
 * The SDK file and its Subresource Integrity hash. scripts/snippet.mjs copies
 * the file from the installed package to public/, and fails when its hash is
 * not this value. Change the file and the hash together.
 *
 * TODO: when the package is on npm, use the pinned jsDelivr URL
 * (https://cdn.jsdelivr.net/npm/@manalens/web@0.1.0/dist/snippet.global.js)
 * and the hash from the release notes.
 */
export const MANALENS_SNIPPET_SRC = '/snippet.global.js';
export const MANALENS_SNIPPET_INTEGRITY = 'sha384-fa8kKszqkVfGui08QOz2J2//SfGAhBS1MhSmBAJBj7sgBPjb2L0/SFqJd6YiLE6o';
