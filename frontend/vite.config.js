import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  if (!env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL is required. Set it in .env.local or the build environment.',
    )
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
