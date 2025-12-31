import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy auth requests to bypass CORS
      '/auth': {
        target: 'https://auth.redmist.racing',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/auth/, ''),
      },
      // Proxy SignalR hub - needs WebSocket support
      '/signalr': {
        target: 'https://api.redmist.racing',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/signalr/, '/status/event-status'),
        ws: true,
      },
      // Proxy API requests to bypass CORS
      '/api': {
        target: 'https://api.redmist.racing',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
