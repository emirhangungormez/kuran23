const QUL_SOURCE = 'qul-fatiha-pilot'
const SURAH_ID = 1

const SURAH_META = {
    transliteration_tr: 'Fatiha',
    transliteration_en: 'Al-Fatiha'
}

const VERSES = {
    1: {
        uthmani: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        plain: 'بسم الله الرحمن الرحيم',
        tajweed: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'
    },
    2: {
        uthmani: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        plain: 'الحمد لله رب العالمين',
        tajweed: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'
    },
    3: {
        uthmani: 'الرَّحْمَٰنِ الرَّحِيمِ',
        plain: 'الرحمن الرحيم',
        tajweed: 'الرَّحْمَٰنِ الرَّحِيمِ'
    },
    4: {
        uthmani: 'مَالِكِ يَوْمِ الدِّينِ',
        plain: 'مالك يوم الدين',
        tajweed: 'مَالِكِ يَوْمِ الدِّينِ'
    },
    5: {
        uthmani: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        plain: 'اياك نعبد واياك نستعين',
        tajweed: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ'
    },
    6: {
        uthmani: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        plain: 'اهدنا الصراط المستقيم',
        tajweed: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ'
    },
    7: {
        uthmani: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
        plain: 'صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين',
        tajweed: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ'
    }
}

const WORDS = {
    1: [
        { sort_number: 1, arabic: 'بِسْمِ', transcription_tr: 'bismi', translation_tr: 'adıyla', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'اسم', lemma_ar: 'اسم', root: 'asm', case: 'gen', i3rab: 'mecrur' } },
        { sort_number: 2, arabic: 'اللَّهِ', transcription_tr: 'allah', translation_tr: 'Allah\'ın', morphology: { pos: 'Özel isim', pos_ar: 'اسم علم', lemma: 'الله', lemma_ar: 'الله', root: 'allh', case: 'gen', i3rab: 'mudaf-ileyh' } },
        { sort_number: 3, arabic: 'الرَّحْمَٰنِ', transcription_tr: 'er-rahman', translation_tr: 'Rahman', morphology: { pos: 'Sıfat', pos_ar: 'صفة', lemma: 'رحمن', lemma_ar: 'رحمن', root: 'rhm', case: 'gen', i3rab: 'sıfat' } },
        { sort_number: 4, arabic: 'الرَّحِيمِ', transcription_tr: 'er-rahim', translation_tr: 'Rahim', morphology: { pos: 'Sıfat', pos_ar: 'صفة', lemma: 'رحيم', lemma_ar: 'رحيم', root: 'rhm', case: 'gen', i3rab: 'sıfat' } }
    ],
    2: [
        { sort_number: 1, arabic: 'الْحَمْدُ', transcription_tr: 'el-hamdu', translation_tr: 'hamd', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'حمد', lemma_ar: 'حمد', root: 'hmd', case: 'nom', i3rab: 'mübteda' } },
        { sort_number: 2, arabic: 'لِلَّهِ', transcription_tr: 'lillahi', translation_tr: 'Allah\'a', morphology: { pos: 'Harf+İsim', pos_ar: 'جار ومجرور', lemma: 'الله', lemma_ar: 'الله', root: 'allh', case: 'gen', i3rab: 'mecrur' } },
        { sort_number: 3, arabic: 'رَبِّ', transcription_tr: 'rabbi', translation_tr: 'Rabbi', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'رب', lemma_ar: 'رب', root: 'rbb', case: 'gen', i3rab: 'bedel' } },
        { sort_number: 4, arabic: 'الْعَالَمِينَ', transcription_tr: 'alemin', translation_tr: 'âlemlerin', morphology: { pos: 'İsim (çoğul)', pos_ar: 'جمع', lemma: 'عالم', lemma_ar: 'عالم', root: 'alm', number: 'plural', case: 'gen', i3rab: 'mudaf-ileyh' } }
    ],
    3: [
        { sort_number: 1, arabic: 'الرَّحْمَٰنِ', transcription_tr: 'er-rahman', translation_tr: 'Rahman', morphology: { pos: 'Sıfat', pos_ar: 'صفة', lemma: 'رحمن', lemma_ar: 'رحمن', root: 'rhm', case: 'gen' } },
        { sort_number: 2, arabic: 'الرَّحِيمِ', transcription_tr: 'er-rahim', translation_tr: 'Rahim', morphology: { pos: 'Sıfat', pos_ar: 'صفة', lemma: 'رحيم', lemma_ar: 'رحيم', root: 'rhm', case: 'gen' } }
    ],
    4: [
        { sort_number: 1, arabic: 'مَالِكِ', transcription_tr: 'maliki', translation_tr: 'sahibi', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'مالك', lemma_ar: 'مالك', root: 'mlk', case: 'gen' } },
        { sort_number: 2, arabic: 'يَوْمِ', transcription_tr: 'yevmi', translation_tr: 'günün', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'يوم', lemma_ar: 'يوم', root: 'ywm', case: 'gen' } },
        { sort_number: 3, arabic: 'الدِّينِ', transcription_tr: 'ed-din', translation_tr: 'dinin/hesabın', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'دين', lemma_ar: 'دين', root: 'dyn', case: 'gen' } }
    ],
    5: [
        { sort_number: 1, arabic: 'إِيَّاكَ', transcription_tr: 'iyyake', translation_tr: 'yalnız sana', morphology: { pos: 'Zamir', pos_ar: 'ضمير', lemma: 'إياك', lemma_ar: 'إياك', person: '2', number: 'singular', gender: 'masculine' } },
        { sort_number: 2, arabic: 'نَعْبُدُ', transcription_tr: 'na\'budu', translation_tr: 'ibadet ederiz', morphology: { pos: 'Fiil', pos_ar: 'فعل', lemma: 'عبد', lemma_ar: 'عبد', root: 'abd', person: '1', number: 'plural', mood: 'indicative' } },
        { sort_number: 3, arabic: 'وَإِيَّاكَ', transcription_tr: 've iyyake', translation_tr: 've yalnız senden', morphology: { pos: 'Bağlaç+Zamir', pos_ar: 'حرف عطف + ضمير', lemma: 'إياك', lemma_ar: 'إياك', person: '2', number: 'singular', gender: 'masculine' } },
        { sort_number: 4, arabic: 'نَسْتَعِينُ', transcription_tr: 'nesta\'in', translation_tr: 'yardım isteriz', morphology: { pos: 'Fiil', pos_ar: 'فعل', lemma: 'استعان', lemma_ar: 'استعان', root: 'awn', form: 'X', person: '1', number: 'plural', mood: 'indicative' } }
    ],
    6: [
        { sort_number: 1, arabic: 'اهْدِنَا', transcription_tr: 'ihdina', translation_tr: 'bize hidayet et', morphology: { pos: 'Fiil', pos_ar: 'فعل', lemma: 'هدى', lemma_ar: 'هدى', root: 'hdy', person: '2', number: 'singular', mood: 'imperative' } },
        { sort_number: 2, arabic: 'الصِّرَاطَ', transcription_tr: 'es-sırata', translation_tr: 'yola', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'صراط', lemma_ar: 'صراط', root: 'srt', case: 'acc', i3rab: 'mef\'ul bih' } },
        { sort_number: 3, arabic: 'الْمُسْتَقِيمَ', transcription_tr: 'el-mustakim', translation_tr: 'dosdoğru', morphology: { pos: 'Sıfat', pos_ar: 'صفة', lemma: 'مستقيم', lemma_ar: 'مستقيم', root: 'qwm', case: 'acc' } }
    ],
    7: [
        { sort_number: 1, arabic: 'صِرَاطَ', transcription_tr: 'sırata', translation_tr: 'yoluna', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'صراط', lemma_ar: 'صراط', root: 'srt', case: 'acc' } },
        { sort_number: 2, arabic: 'الَّذِينَ', transcription_tr: 'ellezine', translation_tr: 'onların ki', morphology: { pos: 'İsmi mevsul', pos_ar: 'اسم موصول', lemma: 'الذي', lemma_ar: 'الذي', number: 'plural' } },
        { sort_number: 3, arabic: 'أَنْعَمْتَ', transcription_tr: 'en\'amte', translation_tr: 'nimet verdiğin', morphology: { pos: 'Fiil', pos_ar: 'فعل', lemma: 'أنعم', lemma_ar: 'أنعم', root: 'nʿm', person: '2', number: 'singular', gender: 'masculine', aspect: 'perfect' } },
        { sort_number: 4, arabic: 'عَلَيْهِمْ', transcription_tr: 'aleyhim', translation_tr: 'onlara', morphology: { pos: 'Harf+Zamir', pos_ar: 'جار ومجرور', lemma: 'على', lemma_ar: 'على', number: 'plural' } },
        { sort_number: 5, arabic: 'غَيْرِ', transcription_tr: 'gayri', translation_tr: 'değil', morphology: { pos: 'İsim', pos_ar: 'اسم', lemma: 'غير', lemma_ar: 'غير', case: 'gen' } },
        { sort_number: 6, arabic: 'الْمَغْضُوبِ', transcription_tr: 'el-mağdubi', translation_tr: 'gazaba uğrayan', morphology: { pos: 'İsm-i mef\'ul', pos_ar: 'اسم مفعول', lemma: 'مغضوب', lemma_ar: 'مغضوب', root: 'gdb', case: 'gen' } },
        { sort_number: 7, arabic: 'عَلَيْهِمْ', transcription_tr: 'aleyhim', translation_tr: 'onların', morphology: { pos: 'Harf+Zamir', pos_ar: 'جار ومجرور', lemma: 'على', lemma_ar: 'على', number: 'plural' } },
        { sort_number: 8, arabic: 'وَلَا', transcription_tr: 've la', translation_tr: 've ne de', morphology: { pos: 'Bağlaç', pos_ar: 'حرف', lemma: 'لا', lemma_ar: 'لا' } },
        { sort_number: 9, arabic: 'الضَّالِّينَ', transcription_tr: 'ed-dallin', translation_tr: 'sapmışlar', morphology: { pos: 'İsim (çoğul)', pos_ar: 'جمع', lemma: 'ضال', lemma_ar: 'ضال', root: 'dll', number: 'plural', case: 'gen' } }
    ]
}

function cloneData(data) {
    return JSON.parse(JSON.stringify(data))
}

function applyWordDefaults(word, verseId, index) {
    const morphology = word.morphology || {}
    return {
        id: `qul-fatiha-${verseId}-${index + 1}`,
        sort_number: word.sort_number || (index + 1),
        arabic: word.arabic || '',
        transcription_tr: word.transcription_tr || '',
        transcription_en: word.transcription_en || '',
        translation_tr: word.translation_tr || '',
        translation_en: word.translation_en || '',
        source: QUL_SOURCE,
        isFallback: false,
        root: null,
        morphology: {
            pos: morphology.pos || '',
            pos_ar: morphology.pos_ar || '',
            lemma: morphology.lemma || '',
            lemma_ar: morphology.lemma_ar || '',
            stem: morphology.stem || '',
            root: morphology.root || '',
            pattern: morphology.pattern || '',
            person: morphology.person || '',
            gender: morphology.gender || '',
            number: morphology.number || '',
            case: morphology.case || '',
            mood: morphology.mood || '',
            voice: morphology.voice || '',
            aspect: morphology.aspect || '',
            state: morphology.state || '',
            form: morphology.form || '',
            i3rab: morphology.i3rab || '',
            details: null
        }
    }
}

export function getQulFatihaWords(ayahNo) {
    const list = WORDS[Number(ayahNo)]
    if (!Array.isArray(list)) return []
    return cloneData(list).map((item, idx) => applyWordDefaults(item, ayahNo, idx))
}

export function getQulFatihaVerse(ayahNo) {
    const key = Number(ayahNo)
    const text = VERSES[key]
    if (!text) return null

    return {
        source: QUL_SOURCE,
        isFallback: false,
        verse: text.uthmani,
        verse_simplified: text.plain,
        verse_without_vowel: text.plain,
        text_modes: {
            uthmani: text.uthmani,
            plain: text.plain,
            tajweed: text.tajweed
        }
    }
}

export function applyQulFatihaToVerse(verse) {
    if (!verse || Number(verse?.surah?.id || verse?.surah_id) !== SURAH_ID) return verse
    const ayahNo = Number(verse.verse_number || verse.ayah || 0)
    const text = getQulFatihaVerse(ayahNo)
    if (!text) return verse
    const words = getQulFatihaWords(ayahNo)
    return {
        ...verse,
        ...text,
        words: words.length > 0 ? words : (verse.words || [])
    }
}

export function applyQulFatihaToSurah(surah) {
    if (!surah || Number(surah.id) !== SURAH_ID) return surah
    return {
        ...surah,
        ...SURAH_META,
        source: QUL_SOURCE,
        isFallback: false,
        verses: Array.isArray(surah.verses) ? surah.verses.map(applyQulFatihaToVerse) : surah.verses
    }
}

export function applyQulFatihaToVerseList(verses = []) {
    return Array.isArray(verses) ? verses.map(applyQulFatihaToVerse) : verses
}

export function applyQulFatihaToSurahListItem(item) {
    if (!item || Number(item.id) !== SURAH_ID) return item
    return {
        ...item,
        ...SURAH_META,
        source: QUL_SOURCE,
        isFallback: false
    }
}
