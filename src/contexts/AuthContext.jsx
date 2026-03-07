import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

const USER_STORAGE_KEY = 'quran_user'
const TOKEN_STORAGE_KEY = 'quran_token'

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
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

  const login = async (username, password) => {
    try {
      const response = await fetch('/api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await response.json()

      if (data.success) {
        persistAuth(data.user, data.token || '')
        return { success: true, settings: data.settings }
      }

      return { success: false, error: data.error || 'Giriş yapılamadı.' }
    } catch {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' }
    }
  }

  const register = async (username, password, email, fullName, profileIcon) => {
    try {
      const response = await fetch('/api/auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, full_name: fullName, profile_icon: profileIcon })
      })
      const data = await response.json()

      if (data.success) {
        persistAuth(data.user, data.token || '')
        return { success: true }
      }

      return { success: false, error: data.error || 'Kayıt oluşturulamadı.' }
    } catch {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' }
    }
  }

  const logout = () => {
    persistAuth(null, '')
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
        register,
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