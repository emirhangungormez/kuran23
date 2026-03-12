/**
 * Audio Service — Handles reciter mappings and URL generation for Quran audio.
 * Supports whole surah audio (via MP3Quran.net) and verse-by-verse audio (via EveryAyah.com).
 */

export const RECITER_MAP = {
    7: { // Mishari Rashid al-`Afasy
        mp3Quran: 'afs',
        everyAyah: 'Alafasy_128kbps',
        server: '8'
    },
    2: { // AbdulBaset AbdulSamad (Murattal)
        mp3Quran: 'basit',
        everyAyah: 'Abdul_Basit_Murattal_192kbps',
        server: '7'
    },
    1: { // AbdulBaset AbdulSamad (Mujawwad)
        mp3Quran: 'basit/Almusshaf-Al-Mojawwad',
        everyAyah: 'Abdul_Basit_Mujawwad_128kbps',
        server: '7'
    },
    3: { // Abdur-Rahman as-Sudais
        mp3Quran: 'sds',
        everyAyah: 'Abdurrahmaan_As-Sudais_192kbps',
        server: '11'
    },
    10: { // Sa'ud ash-Shuraym
        mp3Quran: 'shur',
        everyAyah: 'Saood_ash-Shuraym_128kbps',
        server: '7'
    },
    4: { // Abu Bakr al-Shatri
        mp3Quran: 'shatri',
        everyAyah: 'Abu_Bakr_Ash-Shaatree_128kbps',
        server: '11'
    },
    5: { // Hani ar-Rifai
        mp3Quran: 'hani',
        everyAyah: 'Hani_Rifai_192kbps',
        server: '8'
    },
    6: { // Mahmoud Khalil Al-Husary
        mp3Quran: 'husr',
        everyAyah: 'Husary_128kbps',
        server: '13'
    },
    12: { // Mahmoud Khalil Al-Husary (Muallim)
        mp3Quran: 'husr/Almusshaf-Al-Mo-lim',
        everyAyah: 'Husary_Muallim_128kbps',
        server: '13'
    },
    9: { // Mohamed Siddiq al-Minshawi (Murattal)
        mp3Quran: 'minsh',
        everyAyah: 'Minshawy_Murattal_128kbps',
        server: '10'
    },
    8: { // Mohamed Siddiq al-Minshawi (Mujawwad)
        mp3Quran: 'minsh/Almusshaf-Al-Mojawwad',
        everyAyah: 'Minshawy_Mujawwad_192kbps',
        server: '10'
    },
    11: { // Mohamed al-Tablawi
        mp3Quran: 'tblawi',
        everyAyah: 'Mohammad_al_Tablaway_128kbps',
        server: '12'
    },
    13: { // Maher Al-Muaiqly
        mp3Quran: 'maher',
        everyAyah: 'MaherAlMuaiqly128kbps',
        server: '12'
    },
    14: { // Mahmoud Ali Al-Banna
        mp3Quran: 'bna',
        everyAyah: 'mahmoud_ali_al_banna_32kbps',
        server: '8'
    },
    15: { // Nasser Al-Qatami
        mp3Quran: 'qtm',
        everyAyah: 'Nasser_Alqatami_128kbps',
        server: '6'
    },
    16: { // Salah Al-Budair
        mp3Quran: 's_bud',
        everyAyah: 'Salah_Al_Budair_128kbps',
        server: '6'
    },
    17: { // Yasser Ad-Dossari
        mp3Quran: 'yasser',
        everyAyah: 'Yasser_Ad-Dussary_128kbps',
        server: '11'
    },
    // Diyanet Sources (IDs prefixed with 1000 to avoid conflicts)
    1001: {
        name: 'Osman Şahin',
        source: 'diyanet',
        code: 'ar_osmanSahin'
    },
    1003: {
        name: 'İshak Danış',
        source: 'diyanet',
        code: 'ar_ishakdemir'
    },
    1006: {
        name: 'Davut Kaya',
        source: 'diyanet',
        code: 'ar_davutkaya'
    },
    1014: {
        name: 'Mehmet Emin Ay (Meali)',
        source: 'diyanet',
        code: 'tr_mehmeteminay',
        isTurkish: true
    },
    1015: {
        name: 'Seyfullah Kartal (Meali)',
        source: 'diyanet',
        code: 'tr_seyfullahkartal',
        isTurkish: true
    },
    1016: {
        name: 'AçıkKuran (Tüm Sure Sesi)',
        source: 'acikkuran',
        code: 'tr_acikkuran',
        isTurkish: true
    }
};

const DEFAULT_RECITER = RECITER_MAP[7];

const ARABIC_RECITER_CATALOG = [
    { id: 7, name: 'Mishari Rashid Alafasy' },
    { id: 13, name: 'Maher Al-Muaiqly' },
    { id: 17, name: 'Yasser Ad-Dossari' },
    { id: 15, name: 'Nasser Al-Qatami' },
    { id: 16, name: 'Salah Al-Budair' },
    { id: 14, name: 'Mahmoud Ali Al-Banna' },
    { id: 4, name: 'Abu Bakr al-Shatri' },
    { id: 2, name: 'AbdulBaset AbdulSamad - Murattal' },
    { id: 1, name: 'AbdulBaset AbdulSamad - Mujawwad' },
    { id: 3, name: 'Abdur-Rahman as-Sudais' },
    { id: 10, name: "Sa'ud ash-Shuraym" },
    { id: 5, name: 'Hani ar-Rifai' },
    { id: 6, name: 'Mahmoud Khalil Al-Husary' },
    { id: 12, name: 'Mahmoud Khalil Al-Husary - Muallim' },
    { id: 9, name: 'Mohamed Siddiq al-Minshawi - Murattal' },
    { id: 8, name: 'Mohamed Siddiq al-Minshawi - Mujawwad' },
    { id: 11, name: 'Mohamed al-Tablawi' }
];

/**
 * Check if a reciter ID is supported by our audio service
 * @param {number|string} reciterId 
 */
export function isReciterSupported(reciterId) {
    return !!RECITER_MAP[Number(reciterId)];
}

export function getArabicReciters() {
    return ARABIC_RECITER_CATALOG
        .filter((reciter) => isReciterSupported(reciter.id))
        .map((reciter) => ({ ...reciter }));
}

/**
 * Get the full surah audio URL
 * @param {number|string} reciterId 
 * @param {number|string} surahId 
 */
export function getSurahAudioUrl(reciterId, surahId) {
    const reciter = RECITER_MAP[Number(reciterId)] || DEFAULT_RECITER;

    if (reciter.source === 'diyanet') {
        // Diyanet codes: tr_seyfullahkartal, tr_mehmeteminay, ar_osmanSahin, ar_ishakdanis, ar_davutkaya
        const code = reciter.code || 'tr_mehmeteminay';
        return `https://webdosya.diyanet.gov.tr/kuran/kuranikerim/Sound/${code}/${surahId}_0.mp3`;
    }

    if (reciter.source === 'acikkuran') {
        return `https://audio.acikkuran.com/tr/${surahId}.mp3`;
    }

    const paddedSurah = String(surahId).padStart(3, '0');
    return `https://server${reciter.server}.mp3quran.net/${reciter.mp3Quran}/${paddedSurah}.mp3`;
}

/**
 * Get the individual verse audio URL
 * @param {number|string} reciterId 
 * @param {number|string} surahId 
 * @param {number|string} verseId 
 */
export function getVerseAudioUrl(reciterId, surahId, verseId) {
    const reciter = RECITER_MAP[Number(reciterId)] || DEFAULT_RECITER;

    if (reciter.source === 'diyanet' || reciter.isTurkish) {
        const code = reciter.code || (reciter.isTurkish ? 'tr_mehmeteminay' : 'ar_osmanSahin');
        return `https://webdosya.diyanet.gov.tr/kuran/kuranikerim/Sound/${code}/${surahId}_${verseId}.mp3`;
    }

    const paddedSurah = String(surahId).padStart(3, '0');
    const paddedVerse = String(verseId).padStart(3, '0');
    return `https://everyayah.com/data/${reciter.everyAyah}/${paddedSurah}${paddedVerse}.mp3`;
}

export function getTurkishReciters() {
    return Object.entries(RECITER_MAP)
        .filter(([, reciter]) => reciter.isTurkish)
        .map(([id, reciter]) => ({
            id: Number(id),
            name: reciter.name,
            source: reciter.source,
            code: reciter.code
        }));
}

export function getTurkishAudioUrl(reciterId, surahId, verseId) {
    const reciter = RECITER_MAP[Number(reciterId)];

    // Acikkuran has whole surah audio (surahId.mp3)
    if (reciter && reciter.source === 'acikkuran') {
        return `https://audio.acikkuran.com/tr/${surahId}.mp3`;
    }

    // Default Diyanet Verse-by-Verse logic
    const code = (reciter && reciter.isTurkish) ? reciter.code : 'tr_mehmeteminay';

    // If verseId is 0 or null, it's the surah intro/Bismillah
    const vId = verseId || 0;

    return `https://webdosya.diyanet.gov.tr/kuran/kuranikerim/Sound/${code}/${surahId}_${vId}.mp3`;
}

export function isTurkishPlaylistSupported(reciterId) {
    const reciter = RECITER_MAP[Number(reciterId)];
    return reciter && reciter.source === 'diyanet';
}

