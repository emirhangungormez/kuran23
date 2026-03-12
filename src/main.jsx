import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

if (typeof document !== 'undefined') {
  document.documentElement.lang = 'tr'
  document.documentElement.setAttribute('translate', 'no')
  document.documentElement.classList.add('notranslate')
  document.body?.setAttribute('translate', 'no')
  document.body?.classList.add('notranslate')
}

if (import.meta.env.PROD) {
  const noop = () => {}
  console.log = noop
  console.info = noop
  console.warn = noop
  console.debug = noop
}

const updateSW = registerSW({ immediate: true })

const CACHE_REFRESH_KEY = 'kuran23-cache-refresh-20260311-v1'

async function refreshCachesOnce() {
  if (typeof window === 'undefined') return

  let shouldReload = false

  try {
    if (window.localStorage?.getItem(CACHE_REFRESH_KEY) === '1') return

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      shouldReload = shouldReload || keys.length > 0
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.update()))
      shouldReload = shouldReload || registrations.length > 0
    }
  } catch {
    // Keep app running even if cache cleanup is blocked by the browser.
  } finally {
    try {
      window.localStorage?.setItem(CACHE_REFRESH_KEY, '1')
    } catch {}
  }

  if (shouldReload) {
    window.location.reload()
  }
}

refreshCachesOnce()

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
