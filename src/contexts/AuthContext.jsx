import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../infrastructure/supabaseClient'

const AuthContext = createContext()

const USER_STORAGE_KEY = 'quran_user'
const TOKEN_STORAGE_KEY = 'quran_token'
const USERNAME_EMAIL_DOMAIN = 'kuran23.local'

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function deriveUsernameFromEmail(email) {
  const local = String(email || '').split('@')[0] || ''
  return normalizeUsername(local) || `user_${Date.now()}`
}

function normalizeRedirectPath(path) {
  const raw = String(path || '').trim()
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

function mapProfileRow(row, authUser) {
  if (!row && !authUser) return null
  return {
    id: row?.id || authUser?.id,
    username: row?.username || authUser?.user_metadata?.username || deriveUsernameFromEmail(authUser?.email),
    full_name: row?.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.fullName || '',
    profile_icon: row?.profile_icon || authUser?.user_metadata?.profile_icon || 'muessis',
    bio: row?.bio || '',
    hatim_count: Number(row?.hatim_count || 0),
    is_super_admin: !!row?.is_super_admin,
    email: row?.email || authUser?.email || null,
    pro_expires_at: row?.pro_expires_at || null,
  }
}

async function ensureProfile(authUser, overrides = {}) {
  if (!authUser?.id) return null

  const username = normalizeUsername(overrides.username || authUser?.user_metadata?.username || deriveUsernameFromEmail(authUser?.email))
  const fullName = String(overrides.fullName || authUser?.user_metadata?.full_name || authUser?.user_metadata?.fullName || '').trim()
  const profileIcon = String(overrides.profileIcon || authUser?.user_metadata?.profile_icon || 'muessis').trim() || 'muessis'

  const payload = {
    id: authUser.id,
    username,
    full_name: fullName || null,
    email: authUser.email || null,
    profile_icon: profileIcon,
  }

  // Trigger generally creates row; upsert keeps metadata in sync for legacy users.
  await supabase.from('users').upsert(payload, { onConflict: 'id' })

  const { data: profileRow } = await supabase
    .from('users')
    .select('id,username,full_name,email,profile_icon,bio,hatim_count,is_super_admin,pro_expires_at')
    .eq('id', authUser.id)
    .maybeSingle()

  return mapProfileRow(profileRow, authUser)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem(USER_STORAGE_KEY)))
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  const persistAuth = (nextUser, nextToken) => {
    setUser(nextUser)
    setToken(nextToken || '')

    if (nextUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }

    if (nextToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data?.session
      if (!mounted) return

      if (!session?.user) {
        persistAuth(null, '')
        return
      }

      const profile = await ensureProfile(session.user)
      if (!mounted) return
      persistAuth(profile, session.access_token || '')
    }

    bootstrap()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (!session?.user) {
        persistAuth(null, '')
        return
      }
      const profile = await ensureProfile(session.user)
      if (!mounted) return
      persistAuth(profile, session.access_token || '')
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const login = async (usernameOrEmail, password) => {
    const raw = String(usernameOrEmail || '').trim()
    if (!raw || !password) {
      return { success: false, error: 'Kullanıcı adı/e-posta ve şifre gereklidir.' }
    }

    const email = raw.includes('@') ? raw.toLowerCase() : usernameToEmail(raw)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data?.user) {
        return { success: false, error: error?.message || 'Giriş yapılamadı.' }
      }

      const profile = await ensureProfile(data.user, {
        username: raw.includes('@') ? deriveUsernameFromEmail(raw) : raw,
      })
      persistAuth(profile, data.session?.access_token || '')
      return { success: true, settings: {} }
    } catch {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' }
    }
  }

  const register = async (username, password, email, fullName, profileIcon) => {
    const cleanUsername = normalizeUsername(username)
    const cleanEmail = String(email || '').trim().toLowerCase()

    if (!cleanUsername || !password) {
      return { success: false, error: 'Kullanıcı adı ve şifre gereklidir.' }
    }

    const signUpEmail = cleanEmail && isValidEmail(cleanEmail) ? cleanEmail : usernameToEmail(cleanUsername)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: String(fullName || '').trim(),
            profile_icon: profileIcon || 'muessis'
          }
        }
      })

      if (error) {
        return { success: false, error: error.message || 'Kayıt oluşturulamadı.' }
      }

      let activeUser = data?.user || null
      let activeSession = data?.session || null

      if (!activeSession) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email: signUpEmail, password })
        activeUser = signInData?.user || activeUser
        activeSession = signInData?.session || null
      }

      if (activeUser) {
        const profile = await ensureProfile(activeUser, {
          username: cleanUsername,
          fullName,
          profileIcon
        })
        persistAuth(profile, activeSession?.access_token || '')
      }

      return { success: true }
    } catch {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' }
    }
  }

  const loginWithGoogle = async (redirectPath = '/') => {
    const safePath = normalizeRedirectPath(redirectPath)
    const redirectTo = `${window.location.origin}${safePath}`

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })

      if (error) {
        return { success: false, error: error.message || 'Google ile giriş başlatılamadı.' }
      }

      if (data?.url) {
        window.location.assign(data.url)
      }

      return { success: true }
    } catch {
      return { success: false, error: 'Google ile giriş başlatılırken bağlantı hatası oluştu.' }
    }
  }

  const changePassword = async (oldPassword, newPassword) => {
    if (!oldPassword || !newPassword) {
      return { success: false, error: 'Tüm alanlar gereklidir.' }
    }

    if (String(newPassword).length < 6) {
      return { success: false, error: 'Yeni şifre en az 6 karakter olmalıdır.' }
    }

    const { data } = await supabase.auth.getSession()
    const session = data?.session
    const email = session?.user?.email

    if (!session?.user || !email) {
      return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: oldPassword })
    if (reauthError) {
      return { success: false, error: 'Mevcut şifre hatalı.' }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      return { success: false, error: updateError.message || 'Şifre güncellenemedi.' }
    }

    return { success: true, message: 'Şifreniz başarıyla güncellendi.' }
  }

  const logout = async () => {
    // Clear UI/session state immediately so logout never blocks the interface.
    persistAuth(null, '')
    setIsAuthOpen(false)

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignore network/auth revocation errors; local logout already completed.
    }
  }

  const authFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...options, headers })
  }

  const username = (user?.username || '').toLowerCase()
  const isSuperAdmin = !!user?.is_super_admin
  const isFounderAdmin = username === 'emirhangungormez'

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        register,
        changePassword,
        logout,
        authFetch,
        isLoggedIn: !!user,
        isSuperAdmin,
        isFounderAdmin,
        isAuthOpen,
        setIsAuthOpen
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
