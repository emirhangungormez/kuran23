import { useEffect, useMemo, useState } from 'react'
import './InstallAppBanner.css'

const DISMISS_KEY = 'kuran23_install_banner_dismissed_v1'
const INSTALLED_KEY = 'kuran23_pwa_installed_v1'

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  )
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(max-width: 900px)').matches ?? false
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const ios = /iPad|iPhone|iPod/.test(ua)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return ios && safari
}

export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installing, setInstalling] = useState(false)
  const iosMode = useMemo(() => isIosSafari(), [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!isMobileViewport()) return undefined
    if (isStandaloneMode()) return undefined
    if (localStorage.getItem(DISMISS_KEY) === '1') return undefined
    if (localStorage.getItem(INSTALLED_KEY) === '1') return undefined

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setVisible(true)
    }

    const onAppInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      setVisible(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    if (iosMode) {
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [iosMode])

  const closeBanner = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const installApp = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice?.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1')
        setVisible(false)
      }
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }

  if (!visible) return null

  const showNativeInstall = !!deferredPrompt

  return (
    <aside className="install-app-banner" role="dialog" aria-live="polite" aria-label={'Uygulamay\u0131 y\u00fckle'}>
      <div className="install-app-banner-text">
        <strong>
          {showNativeInstall
            ? "Kuran23'\u00fc cihaz\u0131n\u0131za y\u00fckleyin"
            : "Kuran23'\u00fc ana ekran\u0131n\u0131za ekleyin"}
        </strong>
      </div>
      <div className="install-app-banner-actions">
        <button className="install-app-secondary" onClick={closeBanner} aria-label="Kapat">
          Kapat
        </button>
        <button
          className="install-app-primary"
          onClick={showNativeInstall ? installApp : closeBanner}
          disabled={installing}
        >
          {showNativeInstall ? (installing ? 'Y\u00fckleniyor...' : 'Y\u00fckle') : 'Ekle'}
        </button>
      </div>
    </aside>
  )
}
