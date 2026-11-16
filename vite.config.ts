import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    // Amp portals and iPads on the LAN reach the dev server through other host names.
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
