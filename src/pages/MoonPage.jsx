import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SunCalc from 'suncalc';
import { getVerseAudioUrl } from '../services/audio';
import { getVerse } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import usePlayerStore from '../stores/usePlayerStore';
import GlobalNav from '../components/GlobalNav';
import { getArabicFontFamily, getArabicFontSize, getTranslationFontSize } from '../utils/typography';
import { normalizeArabicDisplayText } from '../utils/textEncoding';
import { getVerseTextByMode } from '../utils/textMode';
import './MoonPage.css';

const MOON_VERSE_IDS = [
    { surah: 10, ayah: 5, surahName: 'Yunus Suresi' },
    { surah: 36, ayah: 39, surahName: 'Yasin Suresi' },
    { surah: 54, ayah: 1, surahName: 'Kamer Suresi' },
    { surah: 25, ayah: 61, surahName: 'Furkan Suresi' },
    { surah: 71, ayah: 16, surahName: 'Nuh Suresi' }
];

const FALLBACK_COORDS = { lat: 40.1885, lng: 29.0610, source: 'city', label: 'Bursa' };
const SYNODIC_MONTH_DAYS = 29.530588853;

const pad = (n) => String(n).padStart(2, '0');
const formatHour = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const readLocalStorage = (key, fallback = null) => {
    if (typeof window === 'undefined') return fallback;
    try {
        const value = window.localStorage.getItem(key);
        return value ?? fallback;
    } catch {
        return fallback;
    }
};

const writeLocalStorage = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ignore storage access failures in private mode / restricted webviews.
    }
};

const createAudioElement = () => {
    if (typeof Audio === 'undefined') return null;
    try {
        return new Audio();
    } catch {
        return null;
    }
};

const formatRemaining = (daysFloat) => {
    const totalHours = Math.round(daysFloat * 24);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}g ${hours}s`;
};

const getMoonDirection = (deg) => {
    const dirs = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
};

const nextByAge = (currentAgeDays, targetAgeDays) => {
    let delta = targetAgeDays - currentAgeDays;
    if (delta <= 0) delta += SYNODIC_MONTH_DAYS;
    return delta;
};

async function geocodeCity(city) {
    const cacheKey = `moon_city_coords_${city}`;
    const cached = readLocalStorage(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            // ignore invalid cache
        }
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json&countryCode=TR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('geocode failed');

    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) throw new Error('city not found');

    const coords = { lat: first.latitude, lng: first.longitude, source: 'city', label: city };
    writeLocalStorage(cacheKey, JSON.stringify(coords));
    return coords;
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60 * 60 * 1000 }
        );
    });
}

export default function MoonPage() {
    const { settings } = useSettings();
    const arabicFontSize = getArabicFontSize(settings);
    const translationFontSize = getTranslationFontSize(settings);
    const arabicFontFamily = getArabicFontFamily(settings.arabicFont);
    const [date, setDate] = useState(new Date());
    const [imgLoading, setImgLoading] = useState(true);
    const [playingType, setPlayingType] = useState(null);
    const [audioNotice, setAudioNotice] = useState('');
    const [verseData, setVerseData] = useState(null);
    const [selectedCity, setSelectedCity] = useState(() => readLocalStorage('selectedCity', 'Bursa') || 'Bursa');
    const [coords, setCoords] = useState(FALLBACK_COORDS);
    const [coordLoading, setCoordLoading] = useState(true);
    const audioRef = useRef(createAudioElement());
    const triedGpsRef = useRef(false);
    const moonVerseArabic = normalizeArabicDisplayText(getVerseTextByMode(verseData, settings.textMode));

    const globalIsPlaying = usePlayerStore((state) => state.isPlaying);

    useEffect(() => {
        const syncCity = () => setSelectedCity(readLocalStorage('selectedCity', 'Bursa') || 'Bursa');
        window.addEventListener('storage', syncCity);
        window.addEventListener('selectedCityChanged', syncCity);
        return () => {
            window.removeEventListener('storage', syncCity);
            window.removeEventListener('selectedCityChanged', syncCity);
        };
    }, []);

    const verseRef = useMemo(() => {
        const index = date.getDate() % MOON_VERSE_IDS.length;
        return MOON_VERSE_IDS[index];
    }, [date]);

    useEffect(() => {
        let active = true;
        (async () => {
            const verse = await getVerse(verseRef.surah, verseRef.ayah, settings.defaultAuthorId, settings.textMode);
            if (active) setVerseData(verse);
        })();
        return () => {
            active = false;
        };
    }, [verseRef, settings.defaultAuthorId, settings.textMode]);

    useEffect(() => {
        let active = true;

        (async () => {
            setCoordLoading(true);

            if (!triedGpsRef.current) {
                triedGpsRef.current = true;
                try {
                    const pos = await getCurrentPosition();
                    if (active) {
                        setCoords({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            source: 'gps',
                            label: 'Konum'
                        });
                        setCoordLoading(false);
                        return;
                    }
                } catch {
                    // fallback to city
                }
            }

            try {
                const cityCoords = await geocodeCity(selectedCity);
                if (active) setCoords(cityCoords);
            } catch {
                if (active) setCoords({ ...FALLBACK_COORDS, label: selectedCity || FALLBACK_COORDS.label });
            } finally {
                if (active) setCoordLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [selectedCity]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return undefined;

        const audioUrl = getVerseAudioUrl(settings.defaultReciterId || 7, verseRef.surah, verseRef.ayah);

        audio.pause();
        audio.src = audioUrl;
        audio.load();
        setPlayingType(null);

        const handleEnded = () => setPlayingType(null);
        const handleError = () => setPlayingType(null);

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.pause();
        };
    }, [verseRef, settings.defaultReciterId]);

    const togglePlay = () => {
        if (globalIsPlaying) {
            setAudioNotice('Dinlediğiniz ayeti global oynatıcıdan durdurun.');
            return;
        }

        setAudioNotice('');
        const audio = audioRef.current;
        if (!audio) {
            setAudioNotice('Tarayıcı bu ses önizlemesini desteklemiyor.');
            return;
        }
        if (playingType === 'arabic') {
            audio.pause();
            setPlayingType(null);
            return;
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => setPlayingType('arabic')).catch(() => setPlayingType(null));
        }
    };

    const moonData = useMemo(() => {
        const illumination = SunCalc.getMoonIllumination(date);
        return { illumination };
    }, [date]);

    const distances = useMemo(() => ({ globe: 384400, dz: 5120 }), []);

    const nasaFrame = useMemo(() => {
        const year = 2026;
        const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const diffMs = date.getTime() - start.getTime();
        const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
        const frameNum = (diffHours % 8760) + 1;
        return String(frameNum).padStart(4, '0');
    }, [date]);

    const miladiDate = useMemo(
        () => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }),
        [date]
    );

    const hicriDate = useMemo(() => {
        try {
            return new Intl.DateTimeFormat('tr-TR-u-ca-islamic', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(date);
        } catch {
            return new Intl.DateTimeFormat('en-US-u-ca-islamic', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(date);
        }
    }, [date]);

    const moonAstronomy = useMemo(() => {
        if (!coords?.lat || !coords?.lng) return null;

        const moonTimes = SunCalc.getMoonTimes(date, coords.lat, coords.lng);
        const moonPosition = SunCalc.getMoonPosition(new Date(), coords.lat, coords.lng);

        const ageDays = moonData.illumination.phase * SYNODIC_MONTH_DAYS;
        const nextFullInDays = nextByAge(ageDays, SYNODIC_MONTH_DAYS / 2);
        const nextNewInDays = nextByAge(ageDays, SYNODIC_MONTH_DAYS);
        const nextFullDate = new Date(date.getTime() + nextFullInDays * 24 * 60 * 60 * 1000);
        const nextNewDate = new Date(date.getTime() + nextNewInDays * 24 * 60 * 60 * 1000);

        const altitudeDeg = moonPosition.altitude * 180 / Math.PI;
        const azimuthDeg = ((moonPosition.azimuth * 180 / Math.PI) + 180 + 360) % 360;

        return {
            moonRise: moonTimes.rise ? formatHour(moonTimes.rise) : '--',
            moonSet: moonTimes.set ? formatHour(moonTimes.set) : '--',
            moonAgeDays: ageDays,
            nextFullDate,
            nextNewDate,
            nextFullInDays,
            altitudeDeg,
            azimuthDeg,
            direction: getMoonDirection(azimuthDeg)
        };
    }, [coords, date, moonData.illumination.phase]);

    const nasaImgUrl = `https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p/moon.${nasaFrame}.jpg`;

    const changeDate = (days) => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + days);
        setDate(newDate);
        setImgLoading(true);
    };

    const resetToToday = () => {
        const today = new Date();
        if (date.toDateString() !== today.toDateString()) {
            setDate(today);
            setImgLoading(true);
        }
    };

    const getMoonPhaseName = (phase) => {
        if (phase <= 0.03 || phase >= 0.97) return 'Yeni Ay';
        if (phase < 0.25) return 'Büyüyen Hilal';
        if (phase < 0.3) return 'İlk Dördün';
        if (phase < 0.47) return 'Büyüyen Şişkin Ay';
        if (phase < 0.53) return 'Dolunay';
        if (phase < 0.75) return 'Küçülen Şişkin Ay';
        if (phase < 0.8) return 'Son Dördün';
        return 'Küçülen Hilal';
    };

    const visibility = Math.round(moonData.illumination.fraction * 100);
    const statsRows = [
        { label: 'Nur', value: `%${visibility}` },
        { label: 'Ay Yaşı', value: moonAstronomy ? `${moonAstronomy.moonAgeDays.toFixed(1)} gün` : '--' },
        { label: 'Dolunaya Kalan', value: moonAstronomy ? formatRemaining(moonAstronomy.nextFullInDays) : '--' },
        { label: 'Sonraki Dolunay', value: moonAstronomy ? moonAstronomy.nextFullDate.toLocaleDateString('tr-TR') : '--' },
        { label: 'Sonraki Yeni Ay', value: moonAstronomy ? moonAstronomy.nextNewDate.toLocaleDateString('tr-TR') : '--' },
        { label: 'Ay Doğuşu', value: moonAstronomy ? moonAstronomy.moonRise : '--' },
        { label: 'Ay Batışı', value: moonAstronomy ? moonAstronomy.moonSet : '--' },
        { label: 'Yükseklik', value: moonAstronomy ? `${moonAstronomy.altitudeDeg.toFixed(1)}°` : '--' },
        { label: 'Yön (Azimut)', value: moonAstronomy ? `${moonAstronomy.direction} ${moonAstronomy.azimuthDeg.toFixed(0)}°` : '--' },
        { label: 'Küre Model Mesafe', value: `${distances.globe.toLocaleString('tr-TR')} km` },
        { label: 'Düz Model Mesafe', value: `~${distances.dz} km` },
        { label: 'Konum Kaynağı', value: coordLoading ? 'Yükleniyor' : `${coords.label} (${coords.source === 'gps' ? 'GPS' : 'Şehir'})` }
    ];

    return (
        <div className="page moon-page-standard is-moon-view">
            <GlobalNav />

            <div className="page-content">
                <div className="page-header-row hidden-mobile">
                    <Link to="/" className="back-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>Ana Sayfa</span>
                    </Link>
                </div>

                <div className="moon-standard-hero">
                    <div className="moon-visual-focus">
                        <div className={`moon-nasa-wrapper ${imgLoading ? 'loading' : 'loaded'}`}>
                            <div className="moon-mask-circle">
                                <img src={nasaImgUrl} onLoad={() => setImgLoading(false)} alt="Moon" />
                            </div>
                            <div className="moon-glow-aura" />
                        </div>

                        <div className="moon-date-navigator">
                            <button className="nav-btn" onClick={() => changeDate(-1)} title="Önceki Gün">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>
                            <div className="nav-current" onClick={resetToToday}>
                                <span className="nav-date-text">{miladiDate}</span>
                                <span className="nav-date-sub">Hicri: {hicriDate}</span>
                            </div>
                            <button className="nav-btn" onClick={() => changeDate(1)} title="Sonraki Gün">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="moon-title-block">
                        <span className="surah-type-badge medeni">{getMoonPhaseName(moonData.illumination.phase)}</span>
                    </div>
                </div>

                <div className="verse-page-header">
                    <div className="surah-title-row" style={{ justifyContent: 'center', marginBottom: '16px' }}>
                        <p className="verse-page-ref" style={{ marginBottom: 0 }}>{verseData?.surah?.name || verseRef.surahName} · {verseRef.ayah}. Ayet</p>
                    </div>

                    <div className="page-header-actions" style={{ justifyContent: 'center', marginBottom: '24px' }}>
                        <div className="audio-control-group moon-audio-controls">
                            <button
                                className={`surah-audio-btn arabic ${playingType === 'arabic' ? 'playing' : ''}`}
                                onClick={togglePlay}
                                title="Dinle"
                            >
                                {playingType === 'arabic' ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                )}
                                Dinle
                            </button>
                            <Link
                                to={`/sure/${verseRef.surah}/${verseRef.ayah}`}
                                className="surah-audio-btn moon-verse-link-btn"
                                title="Ayet sayfasına git"
                                aria-label="Ayet sayfasına git"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </Link>
                        </div>
                    </div>

                    {audioNotice && <p className="moon-audio-notice">{audioNotice}</p>}

                    <div
                        className="verse-page-arabic"
                        dir="rtl"
                        style={{ fontSize: `${arabicFontSize}px`, fontFamily: arabicFontFamily }}
                    >
                        {moonVerseArabic || 'Ayet yükleniyor...'}
                    </div>
                </div>

                <div className="section-divider" />

                <div className="moon-data-grid">
                    <div className="verse-meal-card" style={{ borderBottom: 'none' }}>
                        <p className="verse-meal-text" style={{ fontSize: `${translationFontSize}px`, textAlign: 'center' }}>
                            {verseData?.translation?.text || 'Meal yükleniyor...'}
                        </p>
                        <div style={{ textAlign: 'center' }}>
                            <span className="verse-meal-author">- Kur'an-ı Kerim</span>
                        </div>
                    </div>

                    <div className="moon-stats-table" role="table" aria-label="Ay verileri">
                        {statsRows.map((row) => (
                            <div className="moon-stats-row" role="row" key={row.label}>
                                <span className="moon-stats-label" role="cell">{row.label}</span>
                                <span className="moon-stats-value" role="cell">{row.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
