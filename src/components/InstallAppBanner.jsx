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
    <aside className="install-app-banner" role="dialog" aria-live="polite" aria-label="Uygulamayı yükle">
      <div className="install-app-banner-text">
        <strong>Mobil Uygulama</strong>
        {showNativeInstall ? (
          <span>Kuran23&apos;ü telefonuna yükleyip uygulama gibi kullan.</span>
        ) : (
          <span>Paylaş menüsünden <em>Ana Ekrana Ekle</em> ile hızlı erişim sağla.</span>
        )}
      </div>
      <div className="install-app-banner-actions">
        {showNativeInstall ? (
          <button className="install-app-primary" onClick={installApp} disabled={installing}>
            {installing ? 'Yükleniyor...' : 'Yükle'}
          </button>
        ) : (
          <button className="install-app-primary" onClick={closeBanner}>
            Anladım
          </button>
        )}
        <button className="install-app-secondary" onClick={closeBanner} aria-label="Kapat">
          Daha Sonra
        </button>
      </div>
    </aside>
  )
}
