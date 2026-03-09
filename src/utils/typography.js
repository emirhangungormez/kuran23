export const ARABIC_FONT_OPTIONS = [
    { value: 'QuranFoundationHafs', label: 'AçıkKuran Uthmani' },
    { value: 'DiyanetKuran', label: 'Diyanet Mushaf' },
    { value: 'QPCHafsUthmanic', label: 'QPC Hafs Uthmani' },
    { value: 'MEQuranMadani', label: 'ME Quran Madani' },
    { value: 'DigitalKhattV2', label: 'Digital Khatt V2' },
    { value: 'DigitalKhattV1', label: 'Digital Khatt V1' },
    { value: 'DigitalKhattIndopak', label: 'Digital Khatt IndoPak' },
    { value: 'KFGQPCNastaleeq', label: 'KFGQPC Nastaleeq' },
    { value: 'IndopakNastaleeq', label: 'IndoPak Nastaleeq' },
    { value: 'NotoNaskhArabic', label: 'Noto Naskh Arabic' },
    { value: 'ScheherazadeNew', label: 'Scheherazade New' },
    { value: 'Lateef', label: 'Lateef' }
]

const QURAN_SAFE_FALLBACK = '"Noto Naskh Arabic", serif'

const ARABIC_FONT_FAMILY_MAP = {
    QuranFoundationHafs: `"QuranFoundationHafs", ${QURAN_SAFE_FALLBACK}`,
    DiyanetKuran: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    QPCHafsUthmanic: `"QPCHafsUthmanic", ${QURAN_SAFE_FALLBACK}`,
    MEQuranMadani: `"MEQuranMadani", ${QURAN_SAFE_FALLBACK}`,
    DigitalKhattV2: `"DigitalKhattV2", ${QURAN_SAFE_FALLBACK}`,
    DigitalKhattV1: `"DigitalKhattV1", ${QURAN_SAFE_FALLBACK}`,
    DigitalKhattIndopak: `"DigitalKhattIndopak", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCNastaleeq: `"KFGQPCNastaleeq", ${QURAN_SAFE_FALLBACK}`,
    IndopakNastaleeq: `"IndopakNastaleeq", ${QURAN_SAFE_FALLBACK}`,
    SurahHeaderFont: `"SurahHeaderFont", ${QURAN_SAFE_FALLBACK}`,
    SurahNameV1: `"SurahNameV1", ${QURAN_SAFE_FALLBACK}`,
    SurahNameV2: `"SurahNameV2", ${QURAN_SAFE_FALLBACK}`,
    SurahNameV4: `"SurahNameV4", ${QURAN_SAFE_FALLBACK}`,
    V4SurahNameColor: `"V4SurahNameColor", ${QURAN_SAFE_FALLBACK}`,
    JuzNameCommon: `"JuzNameCommon", ${QURAN_SAFE_FALLBACK}`,
    NotoNaskhArabic: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    ScheherazadeNew: `"Scheherazade New", ${QURAN_SAFE_FALLBACK}`,
    Lateef: `"Lateef", ${QURAN_SAFE_FALLBACK}`,

    // Legacy keys kept for backward compatibility with old settings payloads.
    KFGQPCUthmanTN: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCUthmanTNBold: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCDotNaskh: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKufi: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKufiExtended: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCAnRegular: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCAnBold: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKSARegular: `"DiyanetKuran", ${QURAN_SAFE_FALLBACK}`,
    KFGQPCKingdom2: `"QuranFoundationHafs", ${QURAN_SAFE_FALLBACK}`,
    ArefRuqaa: `"Scheherazade New", ${QURAN_SAFE_FALLBACK}`,
    Cairo: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    Tajawal: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    Alexandria: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    Almarai: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    IBMplexSansArabic: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`,
    Vazirmatn: `"Noto Naskh Arabic", ${QURAN_SAFE_FALLBACK}`
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
