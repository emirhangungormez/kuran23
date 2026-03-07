import React, { useState, useEffect, useRef } from 'react';
import { CITIES, getPrayerTimes } from '../data/cities';
import './RamadanStatus.css';

export default function RamadanStatus() {
    const [city, setCity] = useState(() => localStorage.getItem('selectedCity') || 'Bursa');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [cityQuery, setCityQuery] = useState('');
    const [showHijri, setShowHijri] = useState(false);
    const [times, setTimes] = useState({});
    const [nextPrayer, setNextPrayer] = useState({ label: '', time: '' });
    const pickerRef = useRef(null);
    const infoRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchTimes = async () => {
            const prayerTimes = await getPrayerTimes(city);
            setTimes(prayerTimes);
        };

        fetchTimes();
        localStorage.setItem('selectedCity', city);
        window.dispatchEvent(new CustomEvent('selectedCityChanged', { detail: { city } }));
    }, [city]);

    useEffect(() => {
        if (!times.imsak) return;

        const now = currentTime.getHours() * 60 + currentTime.getMinutes();

        const parseTime = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const prayerList = [
            { label: 'İMSAK', time: times.imsak, weight: parseTime(times.imsak) },
            { label: 'GÜNEŞ', time: times.gunes, weight: parseTime(times.gunes) },
            { label: 'ÖĞLE', time: times.ogle, weight: parseTime(times.ogle) },
            { label: 'İKİNDİ', time: times.ikindi, weight: parseTime(times.ikindi) },
            { label: 'AKŞAM', time: times.aksam, weight: parseTime(times.aksam) },
            { label: 'YATSI', time: times.yatsi, weight: parseTime(times.yatsi) }
        ];

        let upcoming = prayerList.find((p) => p.weight > now);

        if (!upcoming) {
            upcoming = { label: 'İMSAK', time: times.imsak };
        }

        setNextPrayer(upcoming);
    }, [currentTime, times]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (infoRef.current && infoRef.current.contains(event.target)) {
                return;
            }
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
                setCityQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCitySelect = (newCity) => {
        setCity(newCity);
        setCityQuery('');
        setShowPicker(false);
    };

    const normalizedQuery = cityQuery.trim().toLocaleLowerCase('tr-TR');
    const filteredCities = CITIES.filter((c) =>
        c.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
    );

    const hijriFormatter = new Intl.DateTimeFormat('tr-TR-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div className="ramadan-status">
            <div className="rs-clock-section" onClick={() => setShowHijri(!showHijri)} title="Hicri takvimi göster/kapat">
                <div className={`rs-hijri-wrapper ${showHijri ? 'open' : ''}`}>
                    <span className="rs-hijri-date">{hijriFormatter.format(currentTime)}</span>
                    <div className="rs-clock-divider" />
                </div>
                <span className="rs-live-time">{currentTime.toLocaleTimeString('tr-TR', { hour12: false })}</span>
                <svg className={`rs-clock-chevron ${showHijri ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </div>

            <div className="rs-divider" />

            <div
                className="rs-info-section"
                onClick={() => {
                    setShowPicker((prev) => !prev);
                    if (showPicker) {
                        setCityQuery('');
                    }
                }}
                ref={infoRef}
            >
                <span className="rs-city">{city}</span>
                <div className="rs-event">
                    <span className="rs-label">{nextPrayer.label}</span>
                    <span className="rs-time">{nextPrayer.time}</span>
                </div>
                <svg className={`rs-chevron ${showPicker ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            {showPicker && (
                <div className="rs-picker-dropdown" ref={pickerRef}>
                    <div className="rs-picker-header">Şehir Seçin</div>
                    <div className="rs-picker-search-wrap">
                        <svg className="rs-picker-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M20 20l-3.5-3.5" />
                        </svg>
                        <input
                            type="text"
                            className="rs-picker-search"
                            placeholder="Şehir ara..."
                            value={cityQuery}
                            onChange={(e) => setCityQuery(e.target.value)}
                        />
                        {cityQuery && (
                            <button
                                type="button"
                                className="rs-picker-search-clear"
                                onClick={() => setCityQuery('')}
                                aria-label="Aramayı temizle"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <div className="rs-picker-list">
                        {filteredCities.length > 0 ? (
                            filteredCities.map((c) => (
                                <button
                                    key={c}
                                    className={`rs-picker-item ${c === city ? 'active' : ''}`}
                                    onClick={() => handleCitySelect(c)}
                                >
                                    {c}
                                </button>
                            ))
                        ) : (
                            <div className="rs-picker-empty">Sonuç bulunamadı</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
