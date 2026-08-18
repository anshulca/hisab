import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/regress.mts',
    outDir: 'scripts/.tmp-regress',
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:util'],
    },
  },
  optimizeDeps: {
    exclude: ['jspdf', 'jspdf-autotable'],
    include: ['jspdf', 'jspdf-autotable'],
  },
  ssr: { noExternal: ['jspdf', 'jspdf-autotable'] },
});