import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Allow Vercel’s Supabase integration vars (NEXT_PUBLIC_*) alongside VITE_*.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    proxy: {
      '/brreg-api': {
        target: 'https://data.brreg.no',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/brreg-api/, '/enhetsregisteret/api'),
      },
    },
  },
})
