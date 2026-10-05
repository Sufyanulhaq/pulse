import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // VITE_BASE is the folder the site is served from, for example /pulse/ on GitHub Pages.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
