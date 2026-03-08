import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthModal.css'

export default function AuthModal({ isOpen, onClose }) {
    const { login, loginWithGoogle } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const result = await login(formData.username, formData.password)
            if (result.success) {
                onClose()
                return
            }
            setError(result.error || 'Giriş başarısız.')
        } catch (err) {
            setError('Bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const openSignupPage = () => {
        onClose()
        navigate('/kaydol')
    }

    const handleGoogleLogin = async () => {
        setError('')
        setGoogleLoading(true)

        try {
            const next = `${location.pathname || '/'}${location.search || ''}`
            const result = await loginWithGoogle(next)
            if (!result.success) {
                setError(result.error || 'Google ile giriş başlatılamadı.')
            }
        } catch (_err) {
            setError('Google ile giriş başlatılırken bir hata oluştu.')
        } finally {
            setGoogleLoading(false)
        }
    }

    return (
        <div className="auth-modal-overlay" onClick={onClose}>
            <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="auth-modal-close" onClick={onClose}>&times;</button>

                <div className="auth-modal-header">
                    <h2>Giriş Yap</h2>
                    <p>Hesabınıza erişin ve verilerinizi senkronize edin.</p>
                </div>

                {error && <div className="auth-modal-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Kullanıcı Adı</label>
                        <input
                            type="text"
                            required
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Kullanıcı adınız"
                        />
                    </div>

                    <div className="form-group">
                        <label>Şifre</label>
                        <input
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Şifreniz"
                        />
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={loading || googleLoading}>
                        {loading ? 'İşleniyor...' : 'Giriş Yap'}
                    </button>
                </form>

                <button
                    type="button"
                    className="auth-google-btn"
                    onClick={handleGoogleLogin}
                    disabled={loading || googleLoading}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#EA4335" d="M12 10.3v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.1-4.8 9.1-7.2 0-.5-.1-.9-.1-1.3H12z" />
                    </svg>
                    <span>{googleLoading ? 'Google yönlendiriliyor...' : 'Google ile Giriş Yap'}</span>
                </button>

                <div className="auth-modal-footer">
                    <p>
                        Hesabınız yok mu?
                        <button type="button" className="auth-modal-open-signup" onClick={openSignupPage}>
                            Kaydol
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
