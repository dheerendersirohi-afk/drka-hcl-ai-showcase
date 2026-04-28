import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/drka-hcl-ai-showcase/' : '/',
  envDir: '..',
  plugins: [react()],
  build: {
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5180,
  },
  preview: {
    host: '0.0.0.0',
    port: 4180,
  },
});
