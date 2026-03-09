import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookmarksProvider } from './contexts/BookmarksContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import usePlayerStore, { initAudioListeners } from './stores/usePlayerStore'
import { useShallow } from 'zustand/react/shallow'
import IntegratedPlayer from './components/IntegratedPlayer'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import SurahPage from './pages/SurahPage'
import VersePage from './pages/VersePage'
import JourneysPage from './pages/JourneysPage'
import ReadingPage from './pages/ReadingPage'
import FihristPage from './pages/FihristPage'
import AboutPage from './pages/AboutPage'
import SupportPage from './pages/SupportPage'
import SupportersPage from './pages/SupportersPage'
import TefsirlerPage from './pages/TefsirlerPage'
import LibraryBookPage from './pages/LibraryBookPage'
import ScrollToTop from './components/ScrollToTop'
import MoonPage from './pages/MoonPage'
import NotFoundPage from './pages/NotFoundPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthModal from './components/AuthModal'
import SignupPage from './pages/SignupPage'
import Footer from './components/Footer'
import SupportAdPrompt from './components/SupportAdPrompt'
import BottomNav from './components/BottomNav'
import InstallAppBanner from './components/InstallAppBanner'
import { SupporterProvider } from './contexts/SupporterContext'
import { useEffect } from 'react'
import './index.css'

function GlobalPlayerWrapper() {
  const {
    isPlaying, togglePlay, currentTime, duration, volume, setVolume,
    playbackSpeed, setPlaybackSpeed, isRepeat, toggleRepeat,
    playlist, currentTrackIndex, meta, playTrackAtIndex, mode,
    skipNext, skipPrevious
  } = usePlayerStore(useShallow(state => ({
    isPlaying: state.isPlaying,
    togglePlay: state.togglePlay,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    setVolume: state.setVolume,
    playbackSpeed: state.playbackSpeed,
    setPlaybackSpeed: state.setPlaybackSpeed,
    isRepeat: state.isRepeat,
    toggleRepeat: state.toggleRepeat,
    playlist: state.playlist,
    currentTrackIndex: state.currentTrackIndex,
    meta: state.meta,
    playTrackAtIndex: state.playTrackAtIndex,
    mode: state.mode,
    skipNext: state.skipNext,
    skipPrevious: state.skipPrevious
  })))
  const { settings } = useSettings()

  useEffect(() => {
    initAudioListeners(() => settings)
  }, [settings.defaultReciterId, settings.defaultTurkishReciterId])

  return (
    <IntegratedPlayer
      isVisible={settings.isPlayerVisible && mode !== 'none'}
      isPlaying={isPlaying}
      onTogglePlay={togglePlay}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      onVolumeChange={setVolume}
      playbackSpeed={playbackSpeed}
      onSpeedChange={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)}
      isRepeat={isRepeat}
      onToggleRepeat={toggleRepeat}
      verses={mode === 'playlist' ? playlist : []}
      currentVerseIndex={mode === 'playlist' ? currentTrackIndex : -1}
      onSelectVerse={playTrackAtIndex}
      surahNameAr={meta.surahNameAr}
      surahNameTr={meta.surahNameTr}
      surahNameEn={meta.surahNameEn}
      surahType={meta.surahType}
      ayahCount={meta.ayahCount}
      playingType={meta.playingType}
      showSegments={mode === 'playlist'}
      link={meta.link}
      skipNext={() => skipNext(settings)}
      skipPrevious={() => skipPrevious(settings)}
      ayahNo={meta.ayahNo}
      pageNumber={meta.pageNumber}
      juzNumber={meta.juzNumber}
      context={meta.context}
    />
  )
}

function AppContent() {
  const { isAuthOpen, setIsAuthOpen, isLoggedIn } = useAuth()
  const location = useLocation()
  const isSignupPage = location.pathname === '/kaydol' || location.pathname === '/giris'

  return (
    <>
      {!isSignupPage && <GlobalPlayerWrapper />}
      {isSignupPage ? (
        <main className="content-area">
          <Routes>
            <Route path="/kaydol" element={<SignupPage />} />
            <Route path="/giris" element={<SignupPage />} />
          </Routes>
        </main>
      ) : (
        <div className="app-layout has-mobile-nav">
          <main className="content-area">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/ay-evresi" element={<MoonPage />} />
              <Route path="/profil" element={isLoggedIn ? <ProfilePage /> : <Navigate to="/" replace />} />
              <Route path="/seruvenler" element={<JourneysPage />} />
              <Route path="/sure/:id" element={<SurahPage />} />
              <Route path="/sure/:surahId/:ayahNo" element={<VersePage />} />
              <Route path="/oku" element={<Navigate to="/oku/1" replace />} />
              <Route path="/oku/:page" element={<ReadingPage />} />
              <Route path="/fihrist" element={<FihristPage />} />
              <Route path="/hakkimizda" element={<AboutPage />} />
              <Route path="/destek" element={<SupportPage />} />
              <Route path="/ayakta-tutanlar" element={<SupportersPage />} />
              <Route path="/kutuphane" element={<TefsirlerPage />} />
              <Route path="/kutuphane/:bookId" element={<LibraryBookPage />} />
              <Route path="/tefsirler" element={<Navigate to="/kutuphane" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
          <BottomNav />
          <InstallAppBanner />
        </div>
      )}
      {!isSignupPage && <SupportAdPrompt />}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Avoid refetching when switching tabs
      retry: 1, // Only retry once on failure
      staleTime: 1000 * 60 * 60, // Data remains fresh for 1 hour
      gcTime: 1000 * 60 * 60 * 24 // Keep in cache for 24 hours
    }
  }
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <SupporterProvider>
            <SettingsProvider>
              <BookmarksProvider>
                <AppContent />
              </BookmarksProvider>
            </SettingsProvider>
          </SupporterProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
