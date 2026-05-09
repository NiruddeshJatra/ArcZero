import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/arczero/',
  server: {
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
