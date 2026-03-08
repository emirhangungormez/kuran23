import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { getArabicFontFamily, getArabicFontSize, getTranslationFontSize } from '../utils/typography'
import { normalizeArabicDisplayText } from '../utils/textEncoding'
import { getVerseTextByMode } from '../utils/textMode'
import './DailyVerse.css'

export default function DailyVerse({ verse }) {
    const { settings } = useSettings()
    if (!verse) return null

    const arabicFontSize = getArabicFontSize(settings) * 0.95
    const translationFontSize = getTranslationFontSize(settings) * 0.9
    const dailyArabicHtml = normalizeArabicDisplayText(getVerseTextByMode(verse, settings.textMode))

    return (
        <Link to={`/sure/${verse.surah.id}/${verse.verse_number}`} className="daily-verse-card">
            <div className="daily-verse-overlay">
                <span className="daily-badge">Günün Ayeti</span>
                <div className="daily-content">
                    <p
                        className="daily-ar"
                        dir="rtl"
                        style={{ fontSize: `${arabicFontSize}px`, fontFamily: getArabicFontFamily(settings.arabicFont) }}
                        dangerouslySetInnerHTML={{ __html: dailyArabicHtml }}
                    />
                    <p
                        className="daily-tr"
                        style={{ fontSize: `${translationFontSize}px` }}
                    >
                        {verse.translation?.text}
                    </p>
                    <span className="daily-ref">{verse.surah.name}, {verse.verse_number}. Ayet</span>
                </div>
            </div>
        </Link>
    )
}
