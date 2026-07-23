import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Production build goes straight into backend/static/ — FastAPI serves it
  build: { outDir: '../backend/static', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api':              'http://localhost:8000',
      '/data/photos':      'http://localhost:8000',
      '/data/thumbnails':  'http://localhost:8000',
    },
  },
})
