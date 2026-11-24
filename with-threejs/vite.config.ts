import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // The game version from package.json, for context.app.app_version.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Vite blocks unknown hosts in dev. Allow *.localhost, so a local test
  // project with a domain such as game.localhost works.
  server: { port: 5173, allowedHosts: ['.localhost'] },
  preview: { port: 4173, allowedHosts: ['.localhost'] },
  // three.js is most of the bundle.
  build: { chunkSizeWarningLimit: 1000 },
});
