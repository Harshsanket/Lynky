import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initBotId } from 'botid/client/core'
import './index.css'
import App from './App.jsx'

// Register the high-value API paths with Vercel BotID. The server-side check
// fails open outside Vercel, so local development is unaffected.
initBotId({
  protect: [
    { path: '/api/v1/urls', method: 'POST' },
    { path: '/api/v1/api/stats/usage', method: 'GET' },
  ],
})

// React entry point — mounts the app into #root.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
