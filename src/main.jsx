import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

if (import.meta.env.PROD) {
  const noop = () => {}
  console.log = noop
  console.info = noop
  console.warn = noop
  console.debug = noop
}

const updateSW = registerSW({ immediate: true })

if ('caches' in window) {
  caches.delete('audio-assets').catch(() => {})
  caches.delete('audio-stream').catch(() => {})
}

if (typeof updateSW === 'function') {
  window.addEventListener('focus', () => {
    updateSW(true)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
