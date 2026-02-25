import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
