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
 * To load the SDK from the Manalens CDN instead, set the src to
 * https://cdn.manalens.dev/web@0.5.0. The hash is the same; it is also in the
 * release notes of web-v0.5.0.
 */
export const MANALENS_SNIPPET_SRC = '/snippet.global.js';
export const MANALENS_SNIPPET_INTEGRITY = 'sha384-Qip2jzG2B+MR5a/+/sS+KIao4wZg0NemgALmFShR4yFW/A4wchaEZu8jdVcw1ITS';
