import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite blocks unknown hosts in dev. Allow *.localhost, so a local test
  // project with a domain such as site.localhost works.
  server: { port: 5173, allowedHosts: ['.localhost'] },
  preview: { port: 4173, allowedHosts: ['.localhost'] },
});
