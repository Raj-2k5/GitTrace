import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/github-login': {
        target: 'https://github.com/login',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-login/, '')
      }
    }
  }
})
