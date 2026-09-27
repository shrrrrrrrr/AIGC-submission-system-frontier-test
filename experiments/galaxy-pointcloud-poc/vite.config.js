import { defineConfig } from 'vite';
import { galaxyPresetServer } from '../tools/galaxy-preset-server.mjs';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  server:{host:'127.0.0.1',fs:{allow:['..']}},
  plugins: [galaxyPresetServer()]
});
