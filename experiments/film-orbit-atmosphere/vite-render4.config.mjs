import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: { port: 5190 },
  plugins: [{
    name: 'universe-root-entry',
    configureServer(server) {
      return () => server.middlewares.use((request, _response, next) => {
        if (request.url === '/' || request.url === '/index.html') request.url = '/universe-entry.html';
        next();
      });
    },
  }],
});
