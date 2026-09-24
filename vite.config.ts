import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 43123,
    host: '0.0.0.0',
    strictPort: true,
  },
})
