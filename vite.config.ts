import { defineConfig } from 'vite';

// Relative base so the built bundle works when packed into an .ehpk.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
});
