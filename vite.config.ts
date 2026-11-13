import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps the build portable (works on GitHub Pages sub-paths too)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
