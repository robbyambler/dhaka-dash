import { defineConfig } from 'vite';

// Local dev and tests serve from '/'. The GitHub Pages workflow sets PAGES_BASE=/dhaka-dash/.
export default defineConfig({
  base: process.env.PAGES_BASE || '/',
});
