import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Demo / smoke-test app for the react-swipe-tabs library. Resolves the
// `react-swipe-tabs` import to the workspace package's built dist/ output.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
