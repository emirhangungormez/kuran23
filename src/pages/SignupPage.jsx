import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { profileIcons } from '../data/profileIcons'
import './SignupPage.css'

export default function SignupPage() {
    const { register, login, loginWithGoogle, isLoggedIn } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [step, setStep] = useState(1)

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        loginPassword: '',
        fullName: '',
        profileIcon: 'muessis',
        surveySource: '',
        surveyGoal: ''
    })
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [openSelect, setOpenSelect] = useState('')
    const surveySelectsRef = useRef(null)
    const submitIntentRef = useRef(false)
    const [authMode, setAuthMode] = useState(location.pathname === '/giris' ? 'login' : 'signup')

    const nextPath = useMemo(() => {
        const next = new URLSearchParams(location.search).get('next') || ''
        if (next.startsWith('/') && !next.startsWith('//')) return next
        return '/'
    }, [location.search])

    const surveySourceOptions = [
        { value: '', label: 'Seçiniz' },
        { value: 'arkadas', label: 'Arkadaş tavsiyesi' },
        { value: 'sosyal-medya', label: 'Sosyal medya' },
        { value: 'arama-motoru', label: 'Arama motoru' },
        { value: 'diger', label: 'Diğer' }
    ]

    const surveyGoalOptions = [
        { value: '', label: 'Seçiniz' },
        { value: 'okuma', label: 'Düzenli okuma' },
        { value: 'meal-tefsir', label: 'Meal ve tefsir inceleme' },
        { value: 'ezber', label: 'Ezber takibi' },
        { value: 'dinleme', label: 'Sesli dinleme' }
    ]

    useEffect(() => {
        if (isLoggedIn) {
            navigate(nextPath)
        }
    }, [isLoggedIn, navigate, nextPath])

    useEffect(() => {
        setAuthMode(location.pathname === '/giris' ? 'login' : 'signup')
        setError('')
    }, [location.pathname])

    useEffect(() => {
        const onOutsideClick = (event) => {
            if (surveySelectsRef.current && !surveySelectsRef.current.contains(event.target)) {
                setOpenSelect('')
            }
        }

        document.addEventListener('mousedown', onOutsideClick)
        return () => document.removeEventListener('mousedown', onOutsideClick)
    }, [])

    useEffect(() => {
        if (step === 3) {
            setOpenSelect('')
        }
    }, [formData.surveySource, formData.surveyGoal, step])

    const getPasswordStrength = (pwd) => {
        let score = 0
        if (!pwd) return { score: 0, label: 'Giriniz', level: 'empty' }
        if (pwd.length >= 6) score += 1
        if (pwd.length >= 10) score += 1
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
        if (/\d/.test(pwd)) score += 1
        if (/[^A-Za-z0-9]/.test(pwd)) score += 1

        if (score <= 2) return { score, label: 'Zayıf', level: 'weak' }
        if (score <= 4) return { score, label: 'Orta', level: 'medium' }
        return { score, label: 'Güçlü', level: 'strong' }
    }

    const passwordStrength = getPasswordStrength(formData.password)

    const validateStepOne = () => {
        const username = formData.username.trim()
        if (username.length < 3) {
            setError('Kullanıcı adı en az 3 karakter olmalıdır.')
            return false
        }
        if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
            setError('Kullanıcı adı sadece harf, sayı, nokta, alt çizgi ve tire içerebilir.')
            return false
        }
        if (formData.password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır.')
            return false
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Şifre tekrarı eşleşmiyor.')
            return false
        }
        return true
    }

    const validateStepTwo = () => {
        const fullName = formData.fullName.trim()
        if (!fullName) {
            setError('İsim zorunludur.')
            return false
        }
        return true
    }

    const handleNext = () => {
        setError('')
        if (step === 1 && !validateStepOne()) return
        if (step === 2 && !validateStepTwo()) return
        setStep((prev) => Math.min(3, prev + 1))
    }

    const handleBack = () => {
        setError('')
        setStep((prev) => Math.max(1, prev - 1))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (authMode === 'login') {
            const username = formData.username.trim()
            if (!username || !formData.loginPassword) {
                setError('Kullanıcı adı ve şifre gereklidir.')
                return
            }

            setLoading(true)
            try {
                const result = await login(username, formData.loginPassword)
                if (result.success) {
                    navigate(nextPath)
                    return
                }
                setError(result.error || 'Giriş yapılamadı.')
            } catch {
                setError('Sunucuya bağlanırken bir hata oluştu.')
            } finally {
                setLoading(false)
            }
            return
        }

        if (step < 3) {
            handleNext()
            return
        }

        if (!submitIntentRef.current) return
        submitIntentRef.current = false

        const username = formData.username.trim()
        const fullName = formData.fullName.trim()

        if (!validateStepOne() || !validateStepTwo()) return

        setLoading(true)
        try {
            const result = await register(username, formData.password, '', fullName, formData.profileIcon)

            if (result.success) {
                localStorage.setItem(
                    'signup_survey',
                    JSON.stringify({
                        source: formData.surveySource || '',
                        goal: formData.surveyGoal || '',
                        created_at: new Date().toISOString()
                    })
                )
                navigate(nextPath)
                return
            }

            setError(result.error || 'Kayıt oluşturulamadı.')
        } catch {
            setError('Sunucuya bağlanırken bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleAuth = async () => {
        setError('')
        setGoogleLoading(true)
        try {
            const result = await loginWithGoogle(nextPath)
            if (!result.success) {
                setError(result.error || 'Google ile giriş başlatılamadı.')
            }
        } catch {
            setError('Google ile giriş başlatılırken bir hata oluştu.')
        } finally {
            setGoogleLoading(false)
        }
    }

    const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || 'Seçiniz'

    const renderCustomSelect = ({ id, label, value, onChange, options }) => (
        <div className="signup-custom-select-label">
            <span className="signup-custom-select-title">{label}</span>
            <div className={`signup-custom-select ${openSelect === id ? 'open' : ''}`}>
                <button
                    type="button"
                    className="signup-custom-select-trigger"
                    onClick={() => setOpenSelect((prev) => (prev === id ? '' : id))}
                >
                    <span>{getOptionLabel(options, value)}</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </button>

                {openSelect === id && (
                    <div className="signup-custom-select-menu">
                        {options.map((option) => (
                            <button
                                key={`${id}-${option.value || 'empty'}`}
                                type="button"
                                className={`signup-custom-select-option ${value === option.value ? 'active' : ''}`}
                                onClick={() => {
                                    onChange(option.value)
                                    setOpenSelect('')
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="signup-page">
            <section className="signup-shell">
                <aside className="signup-visual">
                    <div className="signup-visual-inner">
                        <div className="signup-copy">
                            <h1>
                                Mushaf'ı Daima
                                <br />
                                Yanında Taşı
                            </h1>
                            <p>Hesabını oluştur ve kaldığın yerden devam et.</p>
                        </div>

                        {authMode === 'signup' ? (
                            <div className="signup-steps">
                                <article className={`signup-step ${step === 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
                                    <span>1</span>
                                    <strong>Hesap Güvenliği</strong>
                                </article>
                                <article className={`signup-step ${step === 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
                                    <span>2</span>
                                    <strong>Profili Tamamla</strong>
                                </article>
                                <article className={`signup-step ${step === 3 ? 'active' : ''}`}>
                                    <span>3</span>
                                    <strong>Kısa Anket</strong>
                                </article>
                            </div>
                        ) : null}
                    </div>
                </aside>

                <section className="signup-form-panel">
                    <div className="signup-header">
                        {authMode === 'login' ? (
                            <>
                                <h2>Giriş Yap</h2>
                                <p>Hesabınla giriş yaparak kaldığın yerden devam et.</p>
                            </>
                        ) : (
                            <>
                                <h2>
                                    {step === 1 && 'Hesap Güvenliği'}
                                    {step === 2 && 'Profili Tamamla'}
                                    {step === 3 && 'Kısa Anket'}
                                </h2>
                                <p>
                                    {step === 1 && 'Kullanıcı adı ve şifreni belirle.'}
                                    {step === 2 && 'İsmini ve profil resmini seç.'}
                                    {step === 3 && 'Deneyimi iyileştirmemiz için kısa bir anket.'}
                                </p>
                            </>
                        )}
                    </div>

                    {error && <div className="signup-error">{error}</div>}

                    <button
                        type="button"
                        className="signup-google-btn"
                        onClick={handleGoogleAuth}
                        disabled={loading || googleLoading}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#EA4335" d="M12 10.3v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.1-4.8 9.1-7.2 0-.5-.1-.9-.1-1.3H12z" />
                        </svg>
                        <span>{googleLoading ? 'Google yönlendiriliyor...' : 'Google ile Giriş Yap'}</span>
                    </button>

                    <form className="signup-form" onSubmit={handleSubmit}>
                        {authMode === 'login' && (
                            <>
                                <label>
                                    Kullanıcı Adı
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="kullaniciadi"
                                        required
                                    />
                                </label>
                                <label>
                                    Şifre
                                    <input
                                        type="password"
                                        value={formData.loginPassword}
                                        onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                                        placeholder="Şifrenizi girin"
                                        required
                                    />
                                </label>
                            </>
                        )}

                        {authMode === 'signup' && step === 1 && (
                            <>
                                <label>
                                    Kullanıcı Adı
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="kullaniciadi"
                                        required
                                    />
                                </label>
                                <label>
                                    Şifre
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Şifrenizi girin"
                                        required
                                    />
                                </label>
                                <label>
                                    Şifre (Tekrar)
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        placeholder="Şifrenizi tekrar girin"
                                        required
                                    />
                                </label>
                                <div className="signup-strength">
                                    <div className="signup-strength-head">
                                        <span>Şifre Gücü:</span>
                                        <strong className={`strength-text ${passwordStrength.level}`}>{passwordStrength.label}</strong>
                                    </div>
                                    <div className="signup-strength-bar">
                                        <div
                                            className={`signup-strength-fill ${passwordStrength.level}`}
                                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                        />
                                    </div>
                                    <p className="signup-hint">Basit şifre kullanabilirsiniz, ancak daha güçlü şifre önerilir.</p>
                                </div>
                            </>
                        )}

                        {authMode === 'signup' && step === 2 && (
                            <>
                                <label>
                                    İsim
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        placeholder="Adınız"
                                        required
                                    />
                                </label>
                                <div className="signup-icon-group">
                                    <span className="signup-icon-label">Profil resmi</span>
                                    <div className="signup-icon-grid">
                                        {profileIcons.map((icon) => (
                                            <button
                                                key={icon.id}
                                                type="button"
                                                className={`signup-icon-btn ${formData.profileIcon === icon.id ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, profileIcon: icon.id })}
                                                title={icon.name}
                                            >
                                                {icon.component ? (
                                                    <icon.component size={34} />
                                                ) : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 34, height: 34 }}>
                                                        {icon.path}
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {authMode === 'signup' && step === 3 && (
                            <div className="signup-survey-selects" ref={surveySelectsRef}>
                                {renderCustomSelect({
                                    id: 'survey-source',
                                    label: "Kuran23'ü nasıl duydunuz?",
                                    value: formData.surveySource,
                                    onChange: (selectedValue) => setFormData({ ...formData, surveySource: selectedValue }),
                                    options: surveySourceOptions
                                })}

                                {renderCustomSelect({
                                    id: 'survey-goal',
                                    label: 'En çok hangi amaçla kullanacaksınız?',
                                    value: formData.surveyGoal,
                                    onChange: (selectedValue) => setFormData({ ...formData, surveyGoal: selectedValue }),
                                    options: surveyGoalOptions
                                })}
                            </div>
                        )}

                        <div className="signup-actions">
                            {authMode === 'signup' && step > 1 && (
                                <button type="button" className="signup-back-btn" onClick={handleBack}>
                                    Geri
                                </button>
                            )}

                            {authMode === 'signup' && step < 3 ? (
                                <button type="button" className="signup-next-btn" onClick={handleNext}>
                                    Devam
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="signup-submit-btn"
                                    disabled={loading}
                                    onClick={() => {
                                        submitIntentRef.current = authMode === 'signup'
                                    }}
                                >
                                    {loading ? 'İşleniyor...' : authMode === 'login' ? 'Giriş Yap' : 'Kaydol'}
                                </button>
                            )}
                        </div>
                    </form>

                    <p className="signup-footer-link">
                        {authMode === 'login' ? (
                            <>Hesabın yok mu? <Link to="/kaydol">Kaydol</Link></>
                        ) : (
                            <>Zaten hesabın var mı? <Link to="/giris">Giriş yap</Link></>
                        )}
                    </p>
                    <p className="signup-footer-link signup-footer-home">
                        <Link to="/">Anasayfaya dön</Link>
                    </p>
                </section>
            </section>
        </div>
    )
}
