/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // En desarrollo, la API corre en el puerto por defecto de Django (8000).
  server: { proxy: { '/api': 'http://localhost:8000', '/media': 'http://localhost:8000' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 1,
    // Node 25 trae un localStorage experimental que tapa al de jsdom.
    execArgv: ['--no-experimental-webstorage'],
  },
})
