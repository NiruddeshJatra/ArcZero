import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'portal' ? './' : '/games/arczero/',
  server: {
    open: true,
  },
  build: {
    outDir: mode === 'portal' ? 'dist-portal' : 'dist',
    sourcemap: true,
  },
}));
