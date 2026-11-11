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

  if (!env.VITE_SHORT_URL) {
    throw new Error(
      'VITE_SHORT_URL is required. Set it in .env.local or the build environment.',
    )
  }

  const siteUrl = (
    env.VITE_SITE_URL || 'http://localhost:5173'
  ).replace(/\/$/, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'site-url-html',
        transformIndexHtml(html) {
          return html.replaceAll('%SITE_URL%', siteUrl)
        },
      },
    ],
  }
})
