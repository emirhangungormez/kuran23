export const ARABIC_FONT_OPTIONS = [
    // Diyanet / AcikKuran related sources (priority)
    { value: 'DiyanetKuran', label: 'Diyanet Mushaf' },
    { value: 'QuranFoundationHafs', label: 'AcikKuran Uthmanic' },
    // Professional, readable extras
    { value: 'ScheherazadeNew', label: 'Scheherazade New' },
    { value: 'NotoNaskhArabic', label: 'Noto Naskh Arabic' },
    { value: 'ArefRuqaa', label: 'Aref Ruqaa' },
    { value: 'Lateef', label: 'Lateef' },
    // Additional distinct styles (already loaded in CSS)
    { value: 'Cairo', label: 'Cairo' },
    { value: 'Alexandria', label: 'Alexandria' },
    { value: 'IBMplexSansArabic', label: 'IBM Plex Sans Arabic' },
    { value: 'Vazirmatn', label: 'Vazirmatn' }
]

const QURAN_SAFE_FALLBACK = '"Noto Naskh Arabic", serif'

const ARABIC_FONT_FAMILY_MAP = {
    QuranFoundationHafs: `"QuranFoundationHafs", ${QURAN_SAFE_FALLBACK}`,
    DiyanetKuran: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCUthmanTN: `"KFGQPCUthmanTN", "QuranFoundationHafs", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCUthmanTNBold: `"KFGQPCUthmanTNBold", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCDotNaskh: `"KFGQPCDotNaskh", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKufi: `"KFGQPCKufi", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKufiExtended: `"KFGQPCKufiExtended", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCAnRegular: `"KFGQPCAnRegular", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCAnBold: `"KFGQPCAnBold", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKSARegular: `"KFGQPCKSARegular", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKingdom2: `"KFGQPCKingdom2", ${QURAN_SAFE_FALLBACK}`,
    ScheherazadeNew: `"Scheherazade New", ${QURAN_SAFE_FALLBACK}`,
    NotoNaskhArabic: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    Lateef: `"Lateef", ${QURAN_SAFE_FALLBACK}`,
    ArefRuqaa: `"Aref Ruqaa", ${QURAN_SAFE_FALLBACK}`,
    Cairo: `"Cairo", ${QURAN_SAFE_FALLBACK}`,
    Tajawal: `"Tajawal", ${QURAN_SAFE_FALLBACK}`,
    Alexandria: `"Alexandria", ${QURAN_SAFE_FALLBACK}`,
    Almarai: `"Almarai", ${QURAN_SAFE_FALLBACK}`,
    IBMplexSansArabic: `"IBM Plex Sans Arabic", ${QURAN_SAFE_FALLBACK}`,
    Vazirmatn: `"Vazirmatn", ${QURAN_SAFE_FALLBACK}`
}

export function getArabicFontFamily(fontKey) {
    return ARABIC_FONT_FAMILY_MAP[fontKey] || ARABIC_FONT_FAMILY_MAP.QuranFoundationHafs
}

export function getArabicPrimaryFont(fontKey) {
    const family = getArabicFontFamily(fontKey)
    const first = family.split(',')[0]?.trim() || '"QuranFoundationHafs"'
    return first.replace(/^["']|["']$/g, '')
}

export function getSettingNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback
}

export function getArabicScale(settings) {
    return getSettingNumber(settings?.arabicScale, 1.5)
}

export function getTranslationScale(settings) {
    return getSettingNumber(settings?.translationScale, 1)
}

export function getTranscriptionScale(settings) {
    return getSettingNumber(settings?.transcriptionScale, 0.72)
}

export function getArabicFontSize(settings) {
    return getSettingNumber(settings?.fontSize, 18) * getArabicScale(settings)
}

export function getTranslationFontSize(settings) {
    return getSettingNumber(settings?.fontSize, 18) * getTranslationScale(settings)
}

export function getTranscriptionFontSize(settings) {
    return getSettingNumber(settings?.fontSize, 18) * getTranscriptionScale(settings)
}


