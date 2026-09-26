import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: { port: 5190 },
  build: { outDir: 'dist-render3', emptyOutDir: true, rollupOptions: { input: 'universe-entry.html' } },
});
