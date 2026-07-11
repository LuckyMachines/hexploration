import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const internalPublicDirs = ['simulator', 'bridge', 'growth', 'fun', 'local-stack', 'verification'];

function stripInternalPublicArtifacts() {
  return {
    name: 'strip-internal-public-artifacts',
    closeBundle() {
      if (process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true') return;
      for (const dir of internalPublicDirs) {
        rmSync(resolve('dist', dir), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripInternalPublicArtifacts()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          viem: ['viem', 'viem/chains', 'viem/accounts'],
        },
      },
    },
  },
  server: {
    port: 5502,
    strictPort: true,
  },
  preview: {
    port: 4502,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
