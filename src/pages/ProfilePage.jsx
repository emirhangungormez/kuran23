import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { getTranslationsList, getVerse } from '../services/api'
import { profileIcons } from '../data/profileIcons'
import { useSupporter } from '../contexts/SupporterContext'
import './ProfilePage.css'
import ProfileHeader from '../components/ProfileHeader'
import PlaylistsManager from '../components/PlaylistsManager'
import { PlaylistsProvider } from '../context/PlaylistsContext'
import GlobalNav from '../components/GlobalNav'
import RecentVerses from '../components/RecentVerses'
import RecentSurahs from '../components/RecentSurahs'
import SavedItems from '../components/SavedItems'
import LastReadPage from '../components/LastReadPage'
import JourneysPromoCard from '../components/JourneysPromoCard'
import UsageStatsPanel from '../components/UsageStatsPanel'
import { ARABIC_FONT_OPTIONS, getArabicFontFamily, getSettingNumber } from '../utils/typography'
import { normalizeArabicDisplayText } from '../utils/textEncoding'
import { isTafsirSpeechSupported, subscribeTafsirVoices } from '../services/tafsirSpeech'


export default function ProfilePage() {
    const fontPreviewSample = 'وَنَضَعُ الْمَوَازِينَ الْقِسْطَ'
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('son')
    const { settings, updateSettings, toggleAuthor } = useSettings();
    const { canAccessUsageAnalytics, remainingAdsToUnlock } = useSupporter()
    const { user, isLoggedIn, changePassword } = useAuth()
    const userId = user?.id || settings?.userId || '';
    const [isPlaylistOpen, setIsPlaylistOpen] = useState(false)
    const [availableTranslations, setAvailableTranslations] = useState([])
    const [availableTafsirVoices, setAvailableTafsirVoices] = useState([])
    const [showIconModal, setShowIconModal] = useState(false)
    const [exampleVerse, setExampleVerse] = useState(null)
    const [settingsVerse, setSettingsVerse] = useState(null)
    const [isMealsExpanded, setIsMealsExpanded] = useState(true)
    const [dragOverState, setDragOverState] = useState({ list: null, targetId: null })

    const dragItem = useRef(null)

    // Password Change State
    const [passwordData, setPasswordData] = useState({ old: '', new: '' })
    const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' })
    const [isPasswordLoading, setIsPasswordLoading] = useState(false)

    useEffect(() => {
        if (!isLoggedIn) {
            navigate('/')
            return
        }
        getTranslationsList().then(setAvailableTranslations)

        // Fetch shorter typography showcase verse for faster visual comparison (Anbiya 21:47)
        getVerse(21, 47, settings.defaultAuthorId).then(v => {
            if (v) setSettingsVerse(v)
        })

        // Fetch example verse (Bakara 2:106) for comparison
        getVerse(2, 106).then(v => {
            if (v) setExampleVerse(v)
        })

    }, [isLoggedIn, navigate, settings.defaultAuthorId])

    useEffect(() => {
        if (!isTafsirSpeechSupported()) return undefined
        return subscribeTafsirVoices(setAvailableTafsirVoices)
    }, [])

    const fontSizePercent = Math.min(100, Math.max(0, ((settings.fontSize - 14) / 18) * 100))
    const arabicScale = getSettingNumber(settings.arabicScale, 1.5)
    const translationScale = getSettingNumber(settings.translationScale, 1)
    const transcriptionScaleRaw = getSettingNumber(settings.transcriptionScale, 0.72)
    const transcriptionScale = Math.min(1.1, Math.max(0.45, transcriptionScaleRaw))
    const getRangePercent = (value, min, max) => Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
    const arabicScalePercent = getRangePercent(arabicScale, 0.9, 2.2)
    const translationScalePercent = getRangePercent(translationScale, 0.8, 1.8)
    const transcriptionScalePercent = getRangePercent(transcriptionScale, 0.45, 1.1)
    const tafsirMealAuthorId = Number(settings.tafsirVerseAuthorId || settings.defaultAuthorId || 77)
    const tafsirVoiceRate = Number(settings.tafsirVoiceRate || 1)
    const settingsVerseArabic = normalizeArabicDisplayText(
        String(settingsVerse?.verse || settingsVerse?.verse_simplified || 'قُلْ هُوَ اللَّهُ أَحَدٌ').replace(/<[^>]+>/g, '')
    )
    const settingsVerseRef = `${String(settingsVerse?.surah?.name || 'Enbiya').toLocaleUpperCase('tr-TR')} · ${settingsVerse?.verse_number || 47}. AYET`
    const getTranslationLangBadge = (translation) => {
        const lang = String(translation?.language || '').toLowerCase()
        return lang.includes('en') || lang.includes('ingiliz') || lang.includes('english') ? 'ENG' : 'TR'
    }

    const translationsById = availableTranslations.reduce((acc, t) => {
        acc[t.id] = t
        return acc
    }, {})

    const coreTranslations = settings.coreAuthorIds
        .map(id => translationsById[id])
        .filter(Boolean)

    const activeTranslations = settings.selectedAuthorIds
        .map(id => translationsById[id])
        .filter(Boolean)
    const inactiveTranslations = availableTranslations.filter(t =>
        !settings.coreAuthorIds.includes(t.id) && !settings.selectedAuthorIds.includes(t.id)
    )

    // Drag and drop handlers
    const handleDragStart = useCallback((e, translationId, sourceList) => {
        dragItem.current = { id: translationId, sourceList }
        e.dataTransfer.effectAllowed = 'move'
        e.currentTarget.style.opacity = '0.5'
    }, [])

    const handleDragEnd = useCallback((e) => {
        e.currentTarget.style.opacity = '1'
        dragItem.current = null
        setDragOverState({ list: null, targetId: null })
    }, [])

    const handleDropToCore = useCallback((e, targetId) => {
        e.preventDefault()
        const dragged = dragItem.current
        if (!dragged) return
        let newCoreIds = [...settings.coreAuthorIds]
        let newActiveIds = [...settings.selectedAuthorIds]
        newCoreIds = newCoreIds.filter(id => id !== dragged.id)
        newActiveIds = newActiveIds.filter(id => id !== dragged.id)
        const targetIndex = targetId !== undefined ? newCoreIds.indexOf(targetId) : -1
        const actualTarget = targetIndex >= 0 ? targetIndex : newCoreIds.length
        newCoreIds.splice(actualTarget, 0, dragged.id)
        updateSettings({ coreAuthorIds: newCoreIds, selectedAuthorIds: newActiveIds })
        setDragOverState({ list: null, targetId: null })
    }, [settings.coreAuthorIds, settings.selectedAuthorIds, updateSettings])

    const handleDropToActive = useCallback((e, targetId) => {
        e.preventDefault()
        const dragged = dragItem.current
        if (!dragged) return
        let newCoreIds = [...settings.coreAuthorIds]
        let newActiveIds = [...settings.selectedAuthorIds]
        newCoreIds = newCoreIds.filter(id => id !== dragged.id)
        newActiveIds = newActiveIds.filter(id => id !== dragged.id)
        const targetIndex = targetId !== undefined ? newActiveIds.indexOf(targetId) : -1
        const actualTarget = targetIndex >= 0 ? targetIndex : newActiveIds.length
        newActiveIds.splice(actualTarget, 0, dragged.id)
        updateSettings({ coreAuthorIds: newCoreIds, selectedAuthorIds: newActiveIds })
        setDragOverState({ list: null, targetId: null })
    }, [settings.coreAuthorIds, settings.selectedAuthorIds, updateSettings])

    const handleDropToInactive = useCallback((e, targetId) => {
        e.preventDefault()
        const dragged = dragItem.current
        if (!dragged) return
        const newCoreIds = settings.coreAuthorIds.filter(id => id !== dragged.id)
        const newActiveIds = settings.selectedAuthorIds.filter(id => id !== dragged.id)
        if (dragged.sourceList === 'inactive') {
            const allInactive = availableTranslations
                .map(t => t.id)
                .filter(id => !newCoreIds.includes(id) && !newActiveIds.includes(id) && id !== dragged.id)
            const targetIndex = targetId !== undefined ? allInactive.indexOf(targetId) : -1
            const insertAt = targetIndex >= 0 ? targetIndex : allInactive.length
            allInactive.splice(insertAt, 0, dragged.id)
            const reorderedSelected = settings.selectedAuthorIds.filter(id => !allInactive.includes(id))
            updateSettings({ coreAuthorIds: newCoreIds, selectedAuthorIds: reorderedSelected })
            setDragOverState({ list: null, targetId: null })
            return
        }
        updateSettings({ coreAuthorIds: newCoreIds, selectedAuthorIds: newActiveIds })
        setDragOverState({ list: null, targetId: null })
    }, [settings.coreAuthorIds, settings.selectedAuthorIds, availableTranslations, updateSettings])

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        if (!passwordData.old || !passwordData.new) {
            setPasswordStatus({ type: 'error', message: 'Lütfen tüm alanları doldurun.' })
            return
        }
        setIsPasswordLoading(true)
        setPasswordStatus({ type: '', message: '' })
        try {
            const result = await changePassword(passwordData.old, passwordData.new)
            if (result.success) {
                setPasswordStatus({ type: 'success', message: 'Şifreniz başarıyla güncellendi.' })
                setPasswordData({ old: '', new: '' })
            } else {
                setPasswordStatus({ type: 'error', message: result.error || 'Bir hata oluştu.' })
            }
        } catch {
            setPasswordStatus({ type: 'error', message: 'Sunucuyla bağlantı kurulamadı.' })
        } finally {
            setIsPasswordLoading(false)
        }
    }

    return (
        <div className="page profile-view">
            <GlobalNav />
            <div className="page-content">
                {!isPlaylistOpen && (
                    <>
                        <Link to="/" className="back-link hidden-mobile">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                            <span>Ana Sayfa</span>
                        </Link>
                        <ProfileHeader onEditAvatar={() => setShowIconModal(true)} />
                        <div className="section-divider" style={{ marginTop: '32px', marginBottom: '24px' }} />

                        <div className="profile-top-row">
                            <LastReadPage />
                            <JourneysPromoCard />
                        </div>
                    </>
                )}

                <div style={{ position: 'relative' }}>
                    <PlaylistsProvider userId={userId}>
                        <PlaylistsManager
                            userId={userId}
                            onPlaylistOpen={setIsPlaylistOpen}
                            basePath="/profil"
                            openInRoute="/profil"
                        />
                    </PlaylistsProvider>
                </div>

                {!isPlaylistOpen && (
                    <>
                        <div className="profile-tabs">
                            <button className={`profile-tab ${activeTab === 'son' ? 'active' : ''}`} onClick={() => setActiveTab('son')}>Son Ziyaretler</button>
                            <button className={`profile-tab ${activeTab === 'kayitli' ? 'active' : ''}`} onClick={() => setActiveTab('kayitli')}>Kaydedilenler</button>
                            <button className={`profile-tab ${activeTab === 'sure' ? 'active' : ''}`} onClick={() => setActiveTab('sure')}>Vakit Analizi</button>
                            <button className={`profile-tab ${activeTab === 'ayarlar' ? 'active' : ''}`} onClick={() => setActiveTab('ayarlar')}>Ayarlar</button>
                        </div>

                        {activeTab === 'son' && (
                            <div className="profile-tab-content">
                                <RecentVerses />
                                <RecentSurahs />
                            </div>
                        )}

                        {activeTab === 'kayitli' && (
                            <div className="profile-tab-content">
                                <SavedItems />
                            </div>
                        )}

                        {activeTab === 'sure' && (
                            <div className="profile-tab-content tab-with-header">
                                <section className="tab-shared-header">
                                    <h2 className="tab-shared-title">Vakit Analizi</h2>
                                </section>
                                {canAccessUsageAnalytics ? (
                                    <UsageStatsPanel />
                                ) : (
                                    <section className="settings-section analytics-lock-card">
                                        <h3>Vakit Analizi Kilitli</h3>
                                        <p>
                                            Bu alan yalnızca Destekçi profillerde açık. Reklam izleyerek destek puanı toplayın ve
                                            Pro özellikleri açın.
                                        </p>
                                        <p className="analytics-lock-meta">
                                            Bir sonraki destekçi açılımı için kalan reklam: <strong>{remainingAdsToUnlock}</strong>
                                        </p>
                                        <Link to="/destek" className="meals-toggle-btn" style={{ alignSelf: 'flex-start' }}>
                                            Destekçi Modunu Aç
                                        </Link>
                                    </section>
                                )}
                            </div>
                        )}

                        {activeTab === 'ayarlar' && (
                            <div className="profile-tab-content settings-list">
                                <section className="tab-shared-header">
                                    <h2 className="tab-shared-title">Ayarlar</h2>
                                </section>

                                <section className="settings-section typography-section">
                                    <p className="settings-kicker">YAZI TİPİ</p>
                                    <h3>Arapça Font ve Boyutlar</h3>
                                    <p className="typography-subtitle">
                                        Okuma ekranlarındaki tüm Arapça, okunuş ve meal metinleri bu seçimlerle eşzamanlı güncellenir.
                                    </p>

                                    <div className="font-preview-card">
                                        <div className="font-preview-head">
                                            <span className="font-preview-meta">{settingsVerseRef}</span>
                                        </div>
                                        <div
                                            className="font-preview-arabic"
                                            dir="rtl"
                                            style={{
                                                fontFamily: getArabicFontFamily(settings.arabicFont),
                                                fontSize: `${Math.max(28, settings.fontSize * arabicScale * 1.2)}px`
                                            }}
                                        >
                                            {settingsVerseArabic}
                                        </div>
                                    </div>

                                    <div className="font-chip-grid">
                                        {ARABIC_FONT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`font-chip ${settings.arabicFont === option.value ? 'active' : ''}`}
                                                onClick={() => updateSettings({ arabicFont: option.value })}
                                            >
                                                <span
                                                    className="font-chip-arabic"
                                                    dir="rtl"
                                                    style={{ fontFamily: getArabicFontFamily(option.value) }}
                                                >
                                                    {fontPreviewSample}
                                                </span>
                                                <span className="font-chip-name">{option.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="typography-controls-card">
                                        <div className="typography-sliders">
                                            <div className="setting-item">
                                                <label>Temel Boyut</label>
                                                <div className="font-size-control">
                                                    <input
                                                        type="range"
                                                        min="14"
                                                        max="32"
                                                        value={settings.fontSize}
                                                        onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                                                        className="settings-range"
                                                        style={{ '--range-fill': `${fontSizePercent}%` }}
                                                    />
                                                    <span className="font-size-value">{settings.fontSize}px</span>
                                                </div>
                                            </div>
                                            <div className="setting-item">
                                                <label>Arapça Boyutu</label>
                                                <div className="font-size-control">
                                                    <input
                                                        type="range"
                                                        min="0.9"
                                                        max="2.2"
                                                        step="0.05"
                                                        value={arabicScale}
                                                        onChange={(e) => updateSettings({ arabicScale: parseFloat(e.target.value) })}
                                                        className="settings-range"
                                                        style={{ '--range-fill': `${arabicScalePercent}%` }}
                                                    />
                                                    <span className="font-size-value">{Math.round(settings.fontSize * arabicScale)}px</span>
                                                </div>
                                            </div>
                                            <div className="setting-item">
                                                <label>Meal Tefsir Boyutu</label>
                                                <div className="font-size-control">
                                                    <input
                                                        type="range"
                                                        min="0.8"
                                                        max="1.8"
                                                        step="0.05"
                                                        value={translationScale}
                                                        onChange={(e) => updateSettings({ translationScale: parseFloat(e.target.value) })}
                                                        className="settings-range"
                                                        style={{ '--range-fill': `${translationScalePercent}%` }}
                                                    />
                                                    <span className="font-size-value">{Math.round(settings.fontSize * translationScale)}px</span>
                                                </div>
                                            </div>
                                            <div className="setting-item">
                                                <label>Okunuş Boyutu</label>
                                                <div className="font-size-control">
                                                    <input
                                                        type="range"
                                                        min="0.45"
                                                        max="1.1"
                                                        step="0.05"
                                                        value={transcriptionScale}
                                                        onChange={(e) => updateSettings({ transcriptionScale: parseFloat(e.target.value) })}
                                                        className="settings-range"
                                                        style={{ '--range-fill': `${transcriptionScalePercent}%` }}
                                                    />
                                                    <span className="font-size-value">{Math.round(settings.fontSize * transcriptionScale)}px</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="settings-section security-section">
                                    <p className="settings-kicker">GÜVENLİK</p>
                                    <h3>Şifre Güncelle</h3>
                                    <form className="password-change-form" onSubmit={handlePasswordChange}>
                                        <div className="security-inline-row">
                                            <div className="security-field">
                                                <label>Mevcut Şifre</label>
                                                <input
                                                    type="password"
                                                    className="modern-input"
                                                    disabled={!isLoggedIn}
                                                    value={passwordData.old}
                                                    onChange={(e) => setPasswordData({ ...passwordData, old: e.target.value })}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="security-field">
                                                <label>Yeni Şifre</label>
                                                <input
                                                    type="password"
                                                    className="modern-input"
                                                    disabled={!isLoggedIn}
                                                    value={passwordData.new}
                                                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                                    placeholder="En az 6 karakter"
                                                />
                                            </div>
                                            <button type="submit" className="password-submit-btn inline-password-btn" disabled={isPasswordLoading || !isLoggedIn}>
                                                {isPasswordLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                                            </button>
                                        </div>
                                        {passwordStatus.message && <div className={`status-message ${passwordStatus.type}`}>{passwordStatus.message}</div>}
                                    </form>
                                </section>

                                <section className="settings-section mealler-section">
                                    <div className="meals-header">
                                        <div className="meals-header-text">
                                            <h3>Mealler (Çeviriler)</h3>
                                            <p className="meals-collapsed-note">
                                                Bu alanda sistemde gösterilen mealler düzenlenebilir, eklenebilir ve çıkarılabilir.
                                            </p>
                                        </div>
                                        <button
                                            className="meals-toggle-btn"
                                            type="button"
                                            onClick={() => setIsMealsExpanded(prev => !prev)}
                                            aria-expanded={isMealsExpanded}
                                        >
                                            <span>{isMealsExpanded ? 'Kapat' : 'Mealleri Düzenle'}</span>
                                            <svg className={`meals-toggle-icon ${isMealsExpanded ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="tafsir-meal-setting">
                                        <div className="tafsir-meal-setting-copy">
                                            <h4>Tefsir İçi Ayet Meali</h4>
                                            <p>
                                                Tefsir ekranındaki Arapça, okunuş ve meal ile birlikte görünen ayetlerde kullanılacak çeviriyi seçin.
                                            </p>
                                        </div>
                                        <select
                                            className="modern-input"
                                            value={tafsirMealAuthorId}
                                            onChange={(e) => updateSettings({ tafsirVerseAuthorId: parseInt(e.target.value, 10) })}
                                            disabled={!availableTranslations.length}
                                        >
                                            {availableTranslations.map((translation) => (
                                                <option key={translation.id} value={translation.id}>
                                                    {translation.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="tafsir-meal-setting">
                                        <div className="tafsir-meal-setting-copy">
                                            <h4>Tefsir Seslendirmesi</h4>
                                            <p>
                                                Tefsir sayfasındaki dinleme özelliğinde kullanılacak Türkçe sesi ve okuma hızını seçin.
                                            </p>
                                        </div>
                                        <div className="tafsir-voice-settings">
                                            <select
                                                className="modern-input"
                                                value={settings.tafsirVoiceName || ''}
                                                onChange={(e) => updateSettings({ tafsirVoiceName: e.target.value })}
                                                disabled={!availableTafsirVoices.length}
                                            >
                                                <option value="">Varsayılan Türkçe ses</option>
                                                {availableTafsirVoices.map((voice) => (
                                                    <option key={voice.id} value={voice.name}>
                                                        {voice.name} ({voice.lang})
                                                    </option>
                                                ))}
                                            </select>

                                            <div className="setting-item compact">
                                                <label>Tefsir Ses Hızı</label>
                                                <div className="font-size-control">
                                                    <input
                                                        type="range"
                                                        min="0.7"
                                                        max="1.5"
                                                        step="0.05"
                                                        value={tafsirVoiceRate}
                                                        onChange={(e) => updateSettings({ tafsirVoiceRate: parseFloat(e.target.value) })}
                                                        className="settings-range"
                                                        style={{ '--range-fill': `${getRangePercent(tafsirVoiceRate, 0.7, 1.5)}%` }}
                                                    />
                                                    <span className="font-size-value">{tafsirVoiceRate.toFixed(2)}x</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {exampleVerse && (
                                        <div className={`verse-preview-card ${!isMealsExpanded ? 'collapsed' : ''}`}>
                                            <div className="verse-preview-ref">Bakara Suresi, 106. Ayet</div>
                                            <div className="verse-preview-arabic" dir="rtl">{exampleVerse.verse}</div>
                                            <p className="verse-preview-translation">
                                                {exampleVerse?.translation?.text || 'Meal yukleniyor...'}
                                            </p>
                                        </div>
                                    )}

                                    {isMealsExpanded && (
                                        <div className="meals-content">
                                            <p className="settings-hint">Mealleri sürükleyerek aktif veya deaktif edebilirsiniz.</p>

                                            <div className="meal-zone-label core-label">Ana Mealler</div>
                                            <div className="meal-drop-zone core-zone" onDrop={handleDropToCore} onDragOver={e => e.preventDefault()}>
                                                {coreTranslations.map((t) => (
                                                    <div
                                                        key={t.id}
                                                        className={`meal-chip active-chip core-chip ${dragOverState.list === 'core' && dragOverState.targetId === t.id ? 'drag-target' : ''}`}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, t.id, 'core')}
                                                        onDragEnd={handleDragEnd}
                                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverState({ list: 'core', targetId: t.id }) }}
                                                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropToCore(e, t.id) }}
                                                    >
                                                        <div className="chip-main">
                                                            <span className="chip-drag-indicator" title="Sürükleyin">
                                                                <span className="chip-grip" aria-hidden="true">⋮⋮</span>
                                                            </span>
                                                            <div className="chip-info">
                                                                <div className="chip-name-row">
                                                                    <span className="chip-name" title={t.name}>{t.name}</span>
                                                                    <span className={`chip-lang-badge ${getTranslationLangBadge(t).toLowerCase()}`}>{getTranslationLangBadge(t)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button className="chip-remove" onClick={() => updateSettings({ coreAuthorIds: settings.coreAuthorIds.filter(id => id !== t.id) })}>×</button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="meal-zone-label active-label">Aktif Mealler</div>
                                            <div className="meal-drop-zone active-zone" onDrop={handleDropToActive} onDragOver={e => e.preventDefault()}>
                                                {activeTranslations.map((t) => (
                                                    <div
                                                        key={t.id}
                                                        className={`meal-chip active-chip ${dragOverState.list === 'active' && dragOverState.targetId === t.id ? 'drag-target' : ''}`}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, t.id, 'active')}
                                                        onDragEnd={handleDragEnd}
                                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverState({ list: 'active', targetId: t.id }) }}
                                                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropToActive(e, t.id) }}
                                                    >
                                                        <div className="chip-main">
                                                            <span className="chip-drag-indicator" title="Sürükleyin">
                                                                <span className="chip-grip" aria-hidden="true">⋮⋮</span>
                                                            </span>
                                                            <div className="chip-info">
                                                                <div className="chip-name-row">
                                                                    <span className="chip-name" title={t.name}>{t.name}</span>
                                                                    <span className={`chip-lang-badge ${getTranslationLangBadge(t).toLowerCase()}`}>{getTranslationLangBadge(t)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button className="chip-remove" onClick={() => toggleAuthor(t.id)}>×</button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="meal-zone-label inactive-label">Deaktif Mealler</div>
                                            <div className="meal-drop-zone inactive-zone" onDrop={handleDropToInactive} onDragOver={e => e.preventDefault()}>
                                                {inactiveTranslations.map((t) => (
                                                    <div
                                                        key={t.id}
                                                        className={`meal-chip inactive-chip ${dragOverState.list === 'inactive' && dragOverState.targetId === t.id ? 'drag-target' : ''}`}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, t.id, 'inactive')}
                                                        onDragEnd={handleDragEnd}
                                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverState({ list: 'inactive', targetId: t.id }) }}
                                                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropToInactive(e, t.id) }}
                                                    >
                                                        <div className="chip-main">
                                                            <span className="chip-drag-indicator" title="Sürükleyin">
                                                                <span className="chip-grip" aria-hidden="true">⋮⋮</span>
                                                            </span>
                                                            <div className="chip-info">
                                                                <div className="chip-name-row">
                                                                    <span className="chip-name" title={t.name}>{t.name}</span>
                                                                    <span className={`chip-lang-badge ${getTranslationLangBadge(t).toLowerCase()}`}>{getTranslationLangBadge(t)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button className="chip-add" onClick={() => toggleAuthor(t.id)}>+</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                    </>
                )}

                {showIconModal && createPortal(
                    <div className="icon-modal-overlay" onClick={() => setShowIconModal(false)}>
                        <div className="icon-modal" onClick={e => e.stopPropagation()}>
                            <div className="icon-modal-header">
                                <h3>Profil Simgesi Seç</h3>
                                <button className="icon-modal-close" onClick={() => setShowIconModal(false)}>×</button>
                            </div>
                            <div className="profile-icons-grid modal-grid">
                                {profileIcons.filter(icon => icon.id !== 'muessis').map(icon => (
                                    <button key={icon.id} className={`profile-icon-option ${settings.profileIcon === icon.id ? 'active' : ''}`} onClick={() => { updateSettings({ profileIcon: icon.id }); setShowIconModal(false); }}>
                                        {icon.component ? <icon.component size={40} /> : <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">{icon.path}</svg>}
                                        <span className="icon-name">{icon.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
}

