import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlaylists } from '../context/PlaylistsContext';
import usePlayerStore from '../stores/usePlayerStore';
import { useSettings } from '../contexts/SettingsContext';
import { useSupporter } from '../contexts/SupporterContext';
import { surahs } from '../data/quranData';
import CustomSelect from './CustomSelect';
import {
    getVerseAudioUrl,
    getTurkishAudioUrl,
    getTurkishReciters,
    isTurkishPlaylistSupported,
} from '../services/audio';
import './PlaylistsManager.css';

const PencilIcon = ({ size = 13 }) => (
    <span className="pl-edit-pencil">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
    </span>
);

const ARABIC_RECITERS = [
    { id: 7, name: 'Alafasy' },
    { id: 2, name: 'AbdulBaset (Murattal)' },
    { id: 3, name: 'As-Sudais' },
    { id: 5, name: 'Hani ar-Rifai' },
    { id: 6, name: 'Al-Husary' },
    { id: 9, name: 'Al-Minshawi' },
    { id: 4, name: 'Abu Bakr al-Shatri' },
];

export default function PlaylistsManager({
    userId,
    onPlaylistOpen,
    basePath = '/profil',
    showSectionTitle = true,
    openInRoute = ''
}) {
    const { playlists, savePlaylist, deletePlaylist } = usePlaylists();
    const { playPlaylist, playTrackAtIndex, togglePlay, isPlaying, currentTrackIndex,
        playlist: activeAudioPlaylist, setPlaylist, meta, setMeta } = usePlayerStore();
    const { settings } = useSettings();
    const { isSupporter, playlistLimit } = useSupporter();

    const [activePlaylistId, setActivePlaylistId] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Auto-open playlist from URL query param
    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const plId = query.get('playlist');
        if (plId) {
            setActivePlaylistId(plId);
        }
    }, [location.search]);
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [saveFeedback, setSaveFeedback] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Edit title ref
    const plNameRef = useRef(null);

    // Drag state
    const dragIndexRef = useRef(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);

    const searchRef = useRef(null);
    const searchBtnRef = useRef(null);

    const turkishReciters = getTurkishReciters();
    const arOptions = ARABIC_RECITERS.map(r => ({ value: r.id, label: r.name }));
    const trOptions = turkishReciters.map(r => ({ value: r.id, label: r.name }));
    const canCreatePlaylist = isSupporter || playlists.length < playlistLimit;

    useEffect(() => { if (onPlaylistOpen) onPlaylistOpen(!!activePlaylistId); }, [activePlaylistId, onPlaylistOpen]);

    useEffect(() => {
        if (saveFeedback) { const t = setTimeout(() => setSaveFeedback(''), 2500); return () => clearTimeout(t); }
    }, [saveFeedback]);

    useEffect(() => {
        if (!showSearch) return;
        const h = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target) &&
                searchBtnRef.current && !searchBtnRef.current.contains(e.target)) {
                setShowSearch(false); setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [showSearch]);

    const activePlaylist = useMemo(
        () => playlists.find(p => String(p.id) === String(activePlaylistId)),
        [playlists, activePlaylistId]
    );

    const filteredSurahs = useMemo(() => {
        if (!searchQuery) return [];
        // Smart normalize: handles Turkish I/i correctly before lowercase
        const normalizeStr = (s) => (s || '')
            .replace(/İ/g, 'i')
            .replace(/I/g, 'ı')
            .toLowerCase()
            .replace(/â|ā/g, 'a')
            .replace(/î|ī/g, 'i')
            .replace(/û|ū/g, 'u')
            .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
            .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
            .replace(/[\u064b-\u065f]/g, '');  // strip Arabic harakat

        const normQ = normalizeStr(searchQuery);
        return surahs.filter(s =>
            normalizeStr(s.nameTr).includes(normQ) ||
            (s.nameAr && s.nameAr.includes(searchQuery)) ||
            (s.nameEn && normalizeStr(s.nameEn).includes(normQ)) ||
            String(s.no) === searchQuery.trim()
        ).slice(0, 114); // Allow potentially seeing all 114 if they search a very generic term, but slice is mostly for performance
    }, [searchQuery]);

    const guardedSavePlaylist = async (payload, successMessage = '') => {
        try {
            await savePlaylist(payload);
            if (successMessage) setSaveFeedback(successMessage);
            return true;
        } catch (error) {
            setSaveFeedback(error?.message || 'İşlem tamamlanamadı.');
            return false;
        }
    };

    // Removed local trackSettings
    // Track getters now read directly from the item in the playlist
    const getTrackLang = (item) => item?.lang || 'ar';
    const getTrackAr = (item) => item?.arReciterId || settings.defaultReciterId || 7;
    const getTrackTr = (item) => item?.trReciterId || settings.defaultTurkishReciterId || 1015;


    const buildSegments = (items) => {
        const tracks = []; const segments = []; let offset = 0;
        items.forEach((item) => {
            const s = surahs.find(s => s.no === item.id); if (!s) return;
            const lang = getTrackLang(item);
            let addedCount = 0;

            if (lang === 'tr') {
                const trId = getTrackTr(item);
                if (isTurkishPlaylistSupported(trId)) {
                    tracks.push({
                        audio: getTurkishAudioUrl(trId, s.no, 0),
                        surahId: s.no, ayah: 0, surahName: item.name,
                    });
                    addedCount++;
                    for (let i = 1; i <= s.ayahCount; i++) {
                        tracks.push({
                            audio: getTurkishAudioUrl(trId, s.no, i),
                            surahId: s.no, ayah: i, surahName: item.name,
                        });
                        addedCount++;
                    }
                } else {
                    tracks.push({
                        audio: getTurkishAudioUrl(trId, s.no, 0),
                        surahId: s.no, ayah: 0, surahName: item.name,
                    });
                    addedCount++;
                }
            } else {
                for (let i = 1; i <= s.ayahCount; i++) {
                    tracks.push({
                        audio: getVerseAudioUrl(getTrackAr(item), s.no, i),
                        surahId: s.no, ayah: i, surahName: item.name,
                    });
                    addedCount++;
                }
            }
            segments.push({ name: item.name, nameAr: s.nameAr, startTrackIdx: offset, count: addedCount });
            offset += addedCount;
        });
        return { tracks, segments };
    };

    const handlePlaySurah = (item) => {
        const s = surahs.find(s => s.no === item.id); if (!s) return;
        const lang = getTrackLang(item);
        const tracks = [];
        if (lang === 'tr') {
            const trId = getTrackTr(item);
            if (isTurkishPlaylistSupported(trId)) {
                tracks.push({ audio: getTurkishAudioUrl(trId, s.no, 0), surahId: s.no, ayah: 0 });
                for (let i = 1; i <= s.ayahCount; i++) {
                    tracks.push({ audio: getTurkishAudioUrl(trId, s.no, i), surahId: s.no, ayah: i });
                }
            } else {
                tracks.push({ audio: getTurkishAudioUrl(trId, s.no, 0), surahId: s.no, ayah: 0 });
            }
        } else {
            for (let i = 1; i <= s.ayahCount; i++) {
                tracks.push({ audio: getVerseAudioUrl(getTrackAr(item), s.no, i), surahId: s.no, ayah: i });
            }
        }
        playPlaylist(tracks, 0, { surahNameTr: item.name, surahNameAr: s.nameAr, ayahCount: s.ayahCount, playingType: lang === 'tr' ? 'turkish' : 'arabic', context: 'surah', surahId: s.no, link: `/sure/${s.no}` });
    };

    const handlePlayPlaylist = (shuffle = false) => {
        if (!activePlaylist?.items?.length) return;
        let itemsToPlay = [...activePlaylist.items];
        if (shuffle) {
            for (let i = itemsToPlay.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [itemsToPlay[i], itemsToPlay[j]] = [itemsToPlay[j], itemsToPlay[i]];
            }
        }
        const { tracks, segments } = buildSegments(itemsToPlay);
        if (!tracks.length) return;
        playPlaylist(tracks, 0, { surahNameTr: shuffle ? 'Karışık Seçim' : 'Oynatma Listesi', surahNameAr: activePlaylist.name, ayahCount: tracks.length, playingType: 'arabic', context: 'playlist', surahId: activePlaylistId, link: `${basePath}?playlist=${activePlaylistId}`, playlistSegments: segments });
    };
    const handleQuickPlayPlaylist = (e, pl) => {
        e.stopPropagation();
        if (!pl?.items?.length) return;

        const isCurrentPlaylist = meta?.context === 'playlist' && String(meta?.surahId) === String(pl.id);
        if (isCurrentPlaylist) {
            togglePlay();
            return;
        }

        const { tracks, segments } = buildSegments(pl.items || []);
        if (!tracks.length) return;
        playPlaylist(tracks, 0, {
            surahNameTr: 'Oynatma Listesi',
            surahNameAr: pl.name,
            ayahCount: tracks.length,
            playingType: 'arabic',
            context: 'playlist',
            surahId: pl.id,
            link: `${basePath}?playlist=${pl.id}`,
            playlistSegments: segments
        });
    };
    const isThisPlaylistActive = meta?.context === 'playlist' && meta?.surahId === activePlaylistId;

    const activeSurahIndex = useMemo(() => {
        if (!isThisPlaylistActive || !activeAudioPlaylist?.length) return -1;
        const track = activeAudioPlaylist[currentTrackIndex];
        return track ? (activePlaylist?.items || []).findIndex(item => item.id === track.surahId) : -1;
    }, [isThisPlaylistActive, currentTrackIndex, activeAudioPlaylist, activePlaylist]);

    const updateItemSettings = (index, updates) => {
        if (!activePlaylist) return;
        const newItems = [...(activePlaylist.items || [])];
        newItems[index] = { ...newItems[index], ...updates };
        guardedSavePlaylist({ ...activePlaylist, items: newItems });

        if (isThisPlaylistActive) {
            const { tracks, segments } = buildSegments(newItems);
            if (activeSurahIndex === index) {
                // Restart track with new settings if currently playing
                playPlaylist(tracks, currentTrackIndex, { ...meta, playlistSegments: segments });
            } else {
                // Background track changed, just update player list directly to avoid disrupting playback
                setPlaylist(tracks);
                setMeta({ ...meta, playlistSegments: segments });
            }
        } else if (meta?.context === 'surah' && meta?.surahId === newItems[index].id) {
            handlePlaySurah(newItems[index]);
        }
    };

    const handleJumpToSurah = (item, idx) => {
        if (!isThisPlaylistActive || !activePlaylist) return;
        let tIdx = 0;
        for (let i = 0; i < idx; i++) { const s = surahs.find(s => s.no === activePlaylist.items[i].id); if (s) tIdx += s.ayahCount; }
        playTrackAtIndex(tIdx);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        if (!canCreatePlaylist) {
            setSaveFeedback('Normal üyeler en fazla 1 oynatma listesi oluşturabilir. Destekçi üyelik ile limit kalkar.');
            return;
        }
        const ok = await guardedSavePlaylist({ name: newTitle.trim(), items: [] }, 'Liste oluşturuldu');
        if (ok) {
            setNewTitle('');
            setShowCreate(false);
        }
    };

    const handleAddSurah = async (surah) => {
        if (!activePlaylist) return;
        const cur = activePlaylist.items || [];
        if (cur.some(i => i.id === surah.no)) { setSaveFeedback('Bu sure zaten listede.'); return; }
        await guardedSavePlaylist({ ...activePlaylist, items: [...cur, { type: 'surah', id: surah.no, name: surah.nameTr }] }, `"${surah.nameTr}" eklendi`);
        setSearchQuery(''); setShowSearch(false);
    };

    const handleRemoveItem = async (itemId) => {
        if (!activePlaylist) return;
        await guardedSavePlaylist({ ...activePlaylist, items: (activePlaylist.items || []).filter(i => i.id !== itemId) });
    };

    const handleDeletePlaylist = async () => {
        if (window.confirm('Bu listeyi kalıcı olarak silmek istediğinize emin misiniz?')) {
            try {
                await deletePlaylist(activePlaylistId);
                setActivePlaylistId(null);
            } catch (error) {
                setSaveFeedback(error?.message || 'Liste silinemedi.');
            }
        }
    };

    const handleBlurName = async () => {
        if (!activePlaylist) return;
        const text = plNameRef.current?.innerText?.trim();
        if (text && text !== activePlaylist.name) {
            await guardedSavePlaylist({ ...activePlaylist, name: text });
        } else if (plNameRef.current) {
            plNameRef.current.innerText = activePlaylist.name;
        }
    };

    const handleKeyDownName = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            plNameRef.current?.blur();
        }
    };

    // Drag handlers
    const handleDragStart = (e, idx) => {
        dragIndexRef.current = idx;
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIdx(idx);
    };
    const handleDrop = async (e, idx) => {
        e.preventDefault();
        const from = dragIndexRef.current;
        if (from === null || from === idx) { setDragOverIdx(null); return; }
        const items = [...(activePlaylist.items || [])];
        const [moved] = items.splice(from, 1);
        items.splice(idx, 0, moved);
        await guardedSavePlaylist({ ...activePlaylist, items });
        dragIndexRef.current = null; setDragOverIdx(null);
    };
    const handleDragEnd = () => { dragIndexRef.current = null; setDragOverIdx(null); };

    // Grid View
    if (!activePlaylistId) {
        return (
            <section className="native-playlist-section grid-view">
                {showSectionTitle && (
                    <h2 className="profile-section-title" style={{ marginTop: '20px', marginBottom: '15px' }}>Oynatma Listelerim</h2>
                )}
                <div className="native-playlist-grid">
                    {showCreate ? (
                        <form className="native-pl-card add-new-card inline-create-card" onSubmit={handleCreateSubmit}>
                            <div className="pl-card-info inline-create-info">
                                <input
                                    autoFocus
                                    type="text"
                                    className="create-pl-input inline"
                                    placeholder="Örn. Sabah Sure Listem"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                />
                                <div className="create-pl-actions inline">
                                    <button type="button" className="btn-cancel" onClick={() => { setShowCreate(false); setNewTitle(''); }}>İptal</button>
                                    <button type="submit" className="btn-create" disabled={!newTitle.trim()}>Oluştur</button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div
                            className={`native-pl-card add-new-card ${!canCreatePlaylist ? 'disabled-card' : ''}`}
                            onClick={() => {
                                if (!canCreatePlaylist) {
                                    setSaveFeedback('Normal üyeler en fazla 1 oynatma listesi oluşturabilir. Destekçi üyelik ile limit kalkar.');
                                    return;
                                }
                                setShowCreate(true);
                            }}
                        >
                            <div className="pl-card-info">
                                <span className="pl-card-title">Yeni Liste Oluştur</span>
                                <span className="pl-card-sub">
                                    {canCreatePlaylist ? 'Kendi Sure Listenizi Oluşturun' : 'Bu limite ulaşmak için Destekçi olmalısınız'}
                                </span>
                            </div>
                        </div>
                    )}

                    {playlists.map(pl => {
                        const isThisPlaying = meta?.context === 'playlist' && meta?.surahId === pl.id && isPlaying;
                        const isPlaylistContext = meta?.context === 'playlist' && String(meta?.surahId) === String(pl.id);
                        return (
                            <div
                                key={pl.id}
                                className="native-pl-card"
                                onClick={() => {
                                    if (openInRoute) {
                                        navigate(`${openInRoute}?playlist=${pl.id}`);
                                        return;
                                    }
                                    setActivePlaylistId(pl.id);
                                }}
                            >
                                <div className={`pl-card-icon-plain ${isThisPlaying ? 'pl-icon-playing' : ''}`}>
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                    </svg>
                                </div>
                                <div className="pl-card-info">
                                    <span className={`pl-card-title ${isThisPlaying ? 'pl-card-title-playing' : ''}`}>{pl.name}</span>
                                    <span className="pl-card-sub">{(pl.items || []).length} Sure</span>
                                </div>
                                <button className="pl-card-quick-play" onClick={(e) => handleQuickPlayPlaylist(e, pl)} title="Listeden oynat">
                                    {isPlaylistContext && isPlaying ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="4" width="4" height="16" rx="1" />
                                            <rect x="14" y="4" width="4" height="16" rx="1" />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    }

    // Detail View
    const handleBackClick = () => {
        setActivePlaylistId(null);
        navigate(basePath, { replace: true });
    };

    if (activePlaylist) {
        const tracks = activePlaylist.items || [];

        return (
            <section className="native-playlist-section detail-view">
                <button className="pl-back-btn back-link" onClick={handleBackClick}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span>Profil</span>
                </button>

                {/* Header */}
                <div className="pl-detail-header">
                    <div className="pl-detail-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                        </svg>
                    </div>
                    <div className="pl-detail-meta">
                        <span className="pl-detail-label">Çalma Listesi</span>
                        <div className="pl-editable-row">
                            <h1
                                ref={plNameRef}
                                className="pl-detail-name pl-editable"
                                contentEditable={true}
                                suppressContentEditableWarning
                                spellCheck={false}
                                onBlur={handleBlurName}
                                onKeyDown={handleKeyDownName}
                            >
                                {activePlaylist.name}
                            </h1>
                            <PencilIcon size={14} />
                        </div>
                        <span className="pl-detail-count">{(activePlaylist.items || []).length} sure</span>
                    </div>
                </div>

                {/* Action bar */}
                <div className="pl-action-bar">
                    <div className="pl-actions-left" style={{ display: 'flex', gap: '20px' }}>
                        <div className="pl-play-all-wrap">
                            <button className="pl-play-all-circle" onClick={() => handlePlayPlaylist(false)} title="Tümünü Çal">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </button>
                            <span className="pl-play-all-label">Tümünü Çal</span>
                        </div>
                        <div className="pl-play-all-wrap">
                            <button className="pl-play-all-circle shuffle-btn" onClick={() => handlePlayPlaylist(true)} title="Karışık Çal">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="16 3 21 3 21 8"></polyline>
                                    <line x1="4" y1="20" x2="21" y2="3"></line>
                                    <polyline points="21 16 21 21 16 21"></polyline>
                                    <line x1="15" y1="15" x2="21" y2="21"></line>
                                    <line x1="4" y1="4" x2="9" y2="9"></line>
                                </svg>
                            </button>
                            <span className="pl-play-all-label">Karışık Çal</span>
                        </div>
                    </div>

                    <div className="pl-action-right">
                        {saveFeedback && (
                            <div className="pl-feedback-toast">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                {saveFeedback}
                            </div>
                        )}

                        <div className="pl-add-wrapper">
                            <button ref={searchBtnRef} className={`pl-add-btn ${showSearch ? 'active' : ''}`} onClick={() => { setShowSearch(v => !v); setSearchQuery(''); }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Sure Ekle
                            </button>

                            {showSearch && (
                                <div className="pl-search-popover" ref={searchRef}>
                                    <div className="pl-search-header">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                        <input autoFocus type="search" placeholder="Sure adı veya numarası..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-search-input" />
                                        {searchQuery && <button className="pl-search-clear" onClick={() => setSearchQuery('')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
                                    </div>
                                    {filteredSurahs.length > 0 ? (
                                        <div className="pl-search-results">
                                            {filteredSurahs.map(s => {
                                                const isAdded = (activePlaylist.items || []).some(i => i.id === s.no);
                                                return (
                                                    <div key={s.no} className="pl-search-row">
                                                        <div className="pl-search-num">{s.no}</div>
                                                        <div className="pl-search-row-info">
                                                            <span className="pl-search-row-name">{s.nameTr}</span>
                                                            <span className="pl-search-row-sub">{s.nameAr} · {s.ayahCount} ayet · {s.type}</span>
                                                        </div>
                                                        {isAdded ? (
                                                            <span className="pl-search-added" title="Eklendi">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                            </span>
                                                        ) : (
                                                            <button className="pl-search-add" onClick={() => handleAddSurah(s)}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                                Ekle
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : searchQuery ? (
                                        <div className="pl-search-empty">Sonuç bulunamadı</div>
                                    ) : (
                                        <div className="pl-search-hint">Sure adı veya numarası yazın…</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button className="pl-delete-btn" onClick={handleDeletePlaylist}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                            Listeyi Sil
                        </button>
                    </div>
                </div>
                <div className="pl-track-list">
                    {(activePlaylist.items || []).length === 0 ? (
                        <div className="pl-empty-state">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            <p>Liste boş — <strong>Sure Ekle</strong> ile başlayın</p>
                        </div>
                    ) : (
                        (activePlaylist.items || []).map((item, index) => {
                            const s = surahs.find(s => s.no === item.id);
                            const lang = getTrackLang(item);
                            const arId = getTrackAr(item);
                            const trId = getTrackTr(item);
                            const isActive = isThisPlaylistActive
                                ? activeSurahIndex === index
                                : (meta?.context === 'surah' && meta?.surahId === item.id && meta?.playingType === (lang === 'tr' ? 'turkish' : 'arabic'));
                            const isDragTarget = dragOverIdx === index;

                            return (
                                <div
                                    key={item.id + '-' + index}
                                    className={`pl-track-card ${isActive ? 'is-playing' : ''} ${isDragTarget ? 'drag-over' : ''}`}
                                    draggable
                                    onDragStart={e => handleDragStart(e, index)}
                                    onDragOver={e => handleDragOver(e, index)}
                                    onDrop={e => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {/* Drag handle */}
                                    <div className="pl-drag-handle" title="Sürükle">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                            <line x1="8" y1="6" x2="21" y2="6" />
                                            <line x1="8" y1="12" x2="21" y2="12" />
                                            <line x1="8" y1="18" x2="21" y2="18" />
                                            <line x1="3" y1="6" x2="3.01" y2="6" />
                                            <line x1="3" y1="12" x2="3.01" y2="12" />
                                            <line x1="3" y1="18" x2="3.01" y2="18" />
                                        </svg>
                                    </div>

                                    {/* LEFT section */}
                                    <div className="pl-tc-left">
                                        <div className="pl-tc-num" onClick={() => {
                                            if (isActive && isPlaying) {
                                                // Çalıyor -> durdur
                                                togglePlay();
                                            } else if (isActive && !isPlaying) {
                                                // Durdu -> devam et
                                                togglePlay();
                                            } else if (isThisPlaylistActive) {
                                                // Farklı sure -> o sureye atla
                                                handleJumpToSurah(item, index);
                                            } else {
                                                // Playlist değil -> sureyi çal
                                                handlePlaySurah(item);
                                            }
                                        }}>
                                            {isActive && isPlaying ? (
                                                /* Pause icon while playing */
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--accent)' }}>
                                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                                </svg>
                                            ) : (
                                                <>
                                                    <span className="pl-num-text">{index + 1}</span>
                                                    <svg className="pl-play-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                </>
                                            )}
                                        </div>
                                        <div className="pl-tc-info">
                                            <div className="pl-tc-flat-row">
                                                <span className={`pl-tc-name ${isActive ? 'accent' : ''}`}>{item.name}</span>
                                                {s && <span className={`pl-tc-type ${s.type === 'Mekki' ? 'mekki' : 'medeni'}`}>{s.type}</span>}
                                                <span className="pl-tc-dot">·</span>
                                                <span className="pl-tc-ar">{s?.nameAr}</span>
                                                <span className="pl-tc-dot">·</span>
                                                <span className="pl-tc-meta">{s?.ayahCount} ayet</span>
                                                <span className="pl-tc-dot">·</span>
                                                <span className="pl-tc-meta">{s?.no}. Sure</span>
                                                <button className="pl-tc-go-source-inline" onClick={(e) => { e.stopPropagation(); navigate(`/sure/${item.id}`) }} title="Sureye Git">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                        <polyline points="15 3 21 3 21 9" />
                                                        <line x1="10" y1="14" x2="21" y2="3" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT: minimal AR/TR radio tabs + fixed-width reciter */}
                                    <div className="pl-tc-controls">
                                        {/* ThemeToggle-style AR/TR pill slider */}
                                        <div
                                            className={`pl-lang-tabs ${lang === 'tr' ? 'tr-active' : 'ar-active'}`}
                                            onClick={() => updateItemSettings(index, { lang: lang === 'ar' ? 'tr' : 'ar' })}
                                        >
                                            <div className="pl-lang-thumb" />
                                            <button className={`pl-lang-tab ${lang === 'ar' ? 'active' : ''}`} onClick={e => { e.stopPropagation(); updateItemSettings(index, { lang: 'ar' }); }}>AR</button>
                                            <button className={`pl-lang-tab ${lang === 'tr' ? 'active' : ''}`} onClick={e => { e.stopPropagation(); updateItemSettings(index, { lang: 'tr' }); }}>TR</button>
                                        </div>

                                        {/* Fixed-width reciter; no extra label, AR/TR is already shown in tabs */}
                                        <div className="pl-tc-reciter-fixed">
                                            {lang === 'ar' ? (
                                                <CustomSelect key={`ar-${item.id}-${index}`} value={arId} onChange={v => updateItemSettings(index, { arReciterId: v })} options={arOptions} className="pl-track-select" />
                                            ) : (
                                                <CustomSelect key={`tr-${item.id}-${index}`} value={trId} onChange={v => updateItemSettings(index, { trReciterId: v })} options={trOptions} className="pl-track-select" />
                                            )}
                                        </div>

                                        <button className="pl-tc-remove" onClick={() => handleRemoveItem(item.id)} title="Listeden çıkar">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section >
        );
    }
    return null;
}







