import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthModal.css'

export default function AuthModal({ isOpen, onClose }) {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

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

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? 'İşleniyor...' : 'Giriş Yap'}
                    </button>
                </form>

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
