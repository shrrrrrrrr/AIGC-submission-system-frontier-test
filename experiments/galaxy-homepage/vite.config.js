import { defineConfig } from 'vite';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, createReadStream } from 'node:fs';
import { galaxyPresetServer } from '../tools/galaxy-preset-server.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, '../galaxy-pointcloud-poc/public');
const manifest = JSON.parse(readFileSync(resolve(publicRoot, 'galaxies/manifest.json')));
const assets = new Set(['galaxies/manifest.json']);
for (const entry of manifest.assets) {
  const base = entry.directory;
  const meta = JSON.parse(readFileSync(resolve(publicRoot, base, 'metadata.json')));
  for (const file of [
    'metadata.json',
    meta.stars.layers.bright.file,
    meta.stars.layers.medium.file,
    meta.stars.layers.dust.file,
    meta.nebula.layers.front.file,
    meta.nebula.layers.mid.file,
    meta.nebula.layers.back.file,
    meta.foreground.file,
    meta.residual.file
  ]) assets.add(`${base}/${file}`);
}
export default defineConfig({
  base: './', publicDir: 'public',
  server: { fs: { allow: [resolve(root, '..')] } },
  plugins: [galaxyPresetServer({ writable: false }), {
    name: 'shared-enabled-galaxy-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '');
        if (!assets.has(path)) return next();
        const full = resolve(publicRoot, path);
        if (!full.startsWith(publicRoot + sep)) return next();
        res.setHeader('Content-Type', path.endsWith('.json') ? 'application/json' : path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
        createReadStream(full).pipe(res);
      });
    },
    generateBundle() {
      for (const name of assets) this.emitFile({ type: 'asset', fileName: name, source: readFileSync(resolve(publicRoot, name)) });
    }
  }],
  build: { outDir: 'dist', emptyOutDir: true }
});
