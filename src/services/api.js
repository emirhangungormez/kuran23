// API Service â€” Connects React frontend to PHP backend
// Falls back to acikkuran-api directly when our backend is unavailable (local dev)

import { surahs as mockSurahs, searchQuran as mockSearch } from '../data/quranData'
import { getSurahAudioUrl, getVerseAudioUrl } from './audio'
import { sanitizeSearchInput } from '../utils/security'
import { buildTextModesFromVerse, getVerseTextByMode } from '../utils/textMode'

let diyanetTafsirCache = null
let diyanetSurahInfoCache = null

async function loadDiyanetTafsirCache() {
    if (diyanetTafsirCache) return diyanetTafsirCache
    const response = await fetch('/diyanet_verse_tafsir.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error('Diyanet tefsir verisi yÃ¼klenemedi.')
    diyanetTafsirCache = await response.json()
    return diyanetTafsirCache
}

async function loadDiyanetSurahInfoCache() {
    if (diyanetSurahInfoCache) return diyanetSurahInfoCache
    const response = await fetch('/diyanet_surah_info.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error('Diyanet sure bilgisi yÃ¼klenemedi.')
    diyanetSurahInfoCache = await response.json()
    return diyanetSurahInfoCache
}

/**
 * Fetch Diyanet Tafsir for a specific verse
 */
export async function getDiyanetTafsir(surahId, ayahNo) {
    try {
        const all = await loadDiyanetTafsirCache()
        const text = all?.[parseInt(surahId)]?.[parseInt(ayahNo)] || null
        if (!text) {
            return {
                error: 'Tafsir not found',
                surah: parseInt(surahId),
                ayah: parseInt(ayahNo)
            }
        }
        return {
            data: {
                text,
                surah: parseInt(surahId),
                ayah: parseInt(ayahNo),
                source: "Diyanet Ä°ÅŸleri BaÅŸkanlÄ±ÄŸÄ± â€” Kur'an Yolu Tefsiri",
                from: 'local_json'
            }
        }
    } catch (e) {
        console.error("Diyanet Tafsir error:", e);
        return null;
    }
}

/**
 * Fetch Diyanet Surah Info (Tafsir/Introduction)
 */
export async function getDiyanetSurahInfo(surahId) {
    try {
        const all = await loadDiyanetSurahInfoCache()
        const info = all?.[parseInt(surahId)] || null
        if (!info?.text) {
            return { error: 'Surah not found', surahId: parseInt(surahId) }
        }
        return {
            chapter_info: {
                text: info.text,
                short_text: (String(info.text).replace(/<[^>]+>/g, '').slice(0, 300) + '...'),
                source: info.source || 'Diyanet Ä°ÅŸleri BaÅŸkanlÄ±ÄŸÄ±'
            }
        }
    } catch (e) {
        console.error("Diyanet Surah Info error:", e);
        return null;
    }
}
const ACIKKURAN_API = 'https://api.acikkuran.com';
const DEFAULT_AUTHOR = 77; // Diyanet Ä°ÅŸleri (quran.com ID, internally mapped to 11 for acikkuran)

function mapIdForApi(id) {
    if (id === 77) return 11;
    return id;
}

function mapIdFromApi(id) {
    if (id === 11) return 77;
    return id;
}

function stripHtmlTags(text) {
    if (!text) return '';
    return String(text).replace(/<[^>]+>/g, '');
}

function normalizeTranslationName(name) {
    const raw = String(name || '').trim();
    const lower = raw.toLocaleLowerCase('tr-TR');
    const isIbnKesir =
        lower.includes('ibn kesir') ||
        lower.includes('ibni kesir') ||
        lower.includes('ibn-i kesir') ||
        lower.includes('ibn kathir') ||
        lower.includes('ibn-kathir');

    if (!isIbnKesir) return raw;
    if (lower.includes('tefsir Ã§evirisi')) return raw;
    return `${raw} (Tefsir Ã‡evirisi)`;
}

function normalizeTranslationAuthor(author) {
    if (!author) return author;
    if (typeof author === 'string') return normalizeTranslationName(author);
    if (typeof author === 'object') {
        const name = author.name || author.author || '';
        if (!name) return author;
        return { ...author, name: normalizeTranslationName(name) };
    }
    return author;
}

function normalizeTranslationItem(item) {
    if (!item) return item;
    const out = { ...item };
    if (typeof out.author === 'string' || typeof out.author === 'object') {
        out.author = normalizeTranslationAuthor(out.author);
    }
    if (typeof out.translationAuthor === 'string') {
        out.translationAuthor = normalizeTranslationName(out.translationAuthor);
    }
    return out;
}

function normalizeVerseItem(verse) {
    if (!verse) return verse;
    return hydrateVerseSourceMeta({
        ...verse,
        translation: verse.translation ? normalizeTranslationItem(verse.translation) : verse.translation
    });
}

function normalizeWordItem(word) {
    if (!word) return word;
    const source = String(word.source || 'acikkuran')
    const isFallback = typeof word.isFallback === 'boolean'
        ? word.isFallback
        : source.startsWith('fallback:')
    return {
        ...word,
        source,
        isFallback,
        morphology: {
            pos: word.morphology?.pos || '',
            pos_ar: word.morphology?.pos_ar || '',
            lemma: word.morphology?.lemma || '',
            lemma_ar: word.morphology?.lemma_ar || '',
            stem: word.morphology?.stem || '',
            root: word.morphology?.root || '',
            pattern: word.morphology?.pattern || '',
            person: word.morphology?.person || '',
            gender: word.morphology?.gender || '',
            number: word.morphology?.number || '',
            case: word.morphology?.case || '',
            mood: word.morphology?.mood || '',
            voice: word.morphology?.voice || '',
            aspect: word.morphology?.aspect || '',
            state: word.morphology?.state || '',
            form: word.morphology?.form || '',
            i3rab: word.morphology?.i3rab || '',
            details: word.morphology?.details || null
        }
    };
}

function hydrateVerseSourceMeta(verse) {
    const normalizedSource = String(verse?.source || '').trim() || 'acikkuran';
    const normalizedFallback = typeof verse?.isFallback === 'boolean'
        ? verse.isFallback
        : normalizedSource.startsWith('fallback:');
    const text_modes = buildTextModesFromVerse(verse || {});

    return {
        ...verse,
        source: normalizedSource,
        isFallback: normalizedFallback,
        text_modes
    };
}

export function resolveVerseTextForMode(verse, textMode) {
    return getVerseTextByMode(verse, textMode);
}

async function fetchJson(url, timeout = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timeoutId);
        throw e;
    }
}

/**
 * Get all available reciters from Quran.com API
 */
export async function getReciters() {
    try {
        const data = await fetchJson('https://api.quran.com/api/v4/resources/recitations?language=tr');
        const reciters = data.recitations.map(r => ({
            id: r.id,
            name: r.reciter_name,
            style: r.style,
            translatedName: r.translated_name?.name
        }));

        // Provide a curated list of reciters in the requested order
        const stableOptions = [
            { id: 7, name: "Mishari Rashid Alafasy", style: "Modern & Net" },
            { id: 4, name: "Abu Bakr al-Shatri", style: "Akıcı & Derin" },
            { id: 2, name: "AbdulBaset AbdulSamad", style: "Hızlı / Murattal" },
            { id: 10, name: "Sa'ud ash-Shuraym", style: "Hızlı & Net" }
        ];

        // Combine stable options at the top
        const otherReciters = reciters.filter(r => !stableOptions.find(s => s.id === r.id));
        return [...stableOptions, ...otherReciters];
    } catch (e) {
        console.warn('getReciters failed:', e);
        return [];
    }
}

export async function getTranslationsList() {
    try {
        // Fetch from Acikkuran as it has a much richer set of Turkish meallers
        const data = await fetchJson(`${ACIKKURAN_API}/authors`);
        const authors = data.data || [];

        return authors.filter(t =>
            t.language === 'tr' ||
            ['en'].includes(t.language)
        ).map(t => {
            // Map Acikkuran's Diyanet (11) to the user's preferred ID 77
            const id = t.id === 11 ? 77 : t.id;
            const normalizedName = normalizeTranslationName(t.name);
            return {
                id: id,
                name: normalizedName,
                author: normalizedName,
                language: t.language === 'tr' ? 'turkish' : 'english'
            };
        });
    } catch (e) {
        console.warn('getTranslationsList failed:', e);
        // Fallback to Quran.com if Acikkuran fails
        try {
            const data = await fetchJson('https://api.quran.com/api/v4/resources/translations?language=tr');
            return data.translations.map(t => ({
                id: t.id,
                name: normalizeTranslationName(t.name),
                author: normalizeTranslationName(t.author_name),
                language: t.language_name
            }));
        } catch (e2) {
            return [];
        }
    }
}

export async function getDailyVerse() {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const dateKey = now.toISOString().split('T')[0];

        // Try cache first
        const cache = localStorage.getItem('daily_verse_cache');
        if (cache) {
            const parsed = JSON.parse(cache);
            if (parsed.date === dateKey) return parsed.data;
        }

        const inspiringVerses = [
            { surahId: 2, verseId: 255 }, { surahId: 3, verseId: 191 },
            { surahId: 2, verseId: 286 }, { surahId: 39, verseId: 53 },
            { surahId: 2, verseId: 152 }, { surahId: 94, verseId: 5 },
            { surahId: 55, verseId: 13 }, { surahId: 2, verseId: 186 },
            { surahId: 4, verseId: 48 }, { surahId: 3, verseId: 31 }
        ];

        const selection = inspiringVerses[dayOfYear % inspiringVerses.length];
        const verse = await getVerse(selection.surahId, selection.verseId);

        if (verse) {
            localStorage.setItem('daily_verse_cache', JSON.stringify({
                date: dateKey,
                data: verse
            }));
        }

        return verse;
    } catch (e) {
        console.warn('getDailyVerse failed:', e);
        return null;
    }
}

// ========================
// Surahs
// ========================
export async function getSurahs() {
    // Primary: acikkuran
    try {
        const data = await fetchJson(`${ACIKKURAN_API}/surahs`);
        return data.data.map(s => ({
            id: s.id, name: s.name, name_en: s.name_en, name_original: s.name_original,
            slug: s.slug, verse_count: s.verse_count, page_number: s.page_number,
            audio_mp3: s.audio?.mp3, audio_duration: s.audio?.duration,
            source: 'acikkuran',
            isFallback: false
        }));
    } catch {
        // Final fallback: mock
        return mockSurahs.map(s => ({
            id: s.no, name: s.nameTr, name_en: s.nameEn, name_original: s.nameAr,
            slug: s.nameTr.toLowerCase(), verse_count: s.ayahCount,
            source: 'fallback:mock',
            isFallback: true
        }));
    }
}

// ========================
// Surah detail with verses
// ========================
export async function getSurah(id, authorId, textMode = 'uthmani') {
    // Primary: acikkuran
    try {
        const mappedAuthor = mapIdForApi(authorId || DEFAULT_AUTHOR);
        const surahId = parseInt(id);
        const data = await fetchJson(`${ACIKKURAN_API}/surah/${surahId}?author=${mappedAuthor}`);
        const d = data.data;
        if (!d) return null;
        return {
            id: d.id, name: d.name, name_en: d.name_en, name_original: d.name_original,
            slug: d.slug, verse_count: d.verse_count, page_number: d.page_number,
            audio_mp3: d.audio?.mp3,
            source: 'acikkuran',
            isFallback: false,
            verses: (d.verses || []).map(v => ({
                source: 'acikkuran',
                isFallback: false,
                id: v.id,
                verse_number: v.verse_number,
                verse: v.verse,
                verse_simplified: v.verse_simplified,
                verse_without_vowel: v.verse_without_vowel,
                text_modes: {
                    uthmani: v.verse || '',
                    plain: v.verse_without_vowel || v.verse_simplified || v.verse || '',
                    tajweed: v.verse || ''
                },
                transcription: v.transcription,
                transcription_en: v.transcription_en,
                page: v.page,
                juz_number: v.juz_number,
                translation: v.translation ? {
                    id: v.translation.id,
                    text: v.translation.text,
                    author_id: v.translation.author?.id,
                } : null,
            })).map(normalizeVerseItem),
        };
    } catch (e) {
        console.warn('getSurah failed:', e);
        return null;
    }
}

// ========================
// Surah info / introduction
// ========================
export async function getSurahInfo(id) {
    // Static override for Fatiha (Surah 1) to provide high-quality Turkish content
    if (parseInt(id) === 1) {
        return {
            text: `
                <div class="tafsir-content-wrapper">
                    <section>
                        <h2>1. GiriÅŸ: Surenin KimliÄŸi ve Ä°simleri</h2>
                        <p>Sureye verilen isimler, onun muhtevasÄ±nÄ±n zenginliÄŸini gÃ¶sterir.</p>
                        <ul>
                            <li><strong>FÃ¢tihatÃ¼'l-KitÃ¢b:</strong> KitabÄ±n, kÄ±raatin ve namazÄ±n kendisiyle baÅŸlamasÄ± nedeniyle bu isim verilmiÅŸtir [Razi, Cilt 1, s. 245; ElmalÄ±lÄ±, Cilt 1, s. 28].</li>
                            <li><strong>ÃœmmÃ¼'l-Kur'an:</strong> Razi'ye gÃ¶re Kur'an'Ä±n temel maksatlarÄ± olan "Ä°lahiyat" (Allah'Ä±n zatÄ± ve sÄ±fatlarÄ±), "Mead" (Ahiret), "NÃ¼bÃ¼vvet" ve "Kader" konularÄ±nÄ± Ã¶zÃ¼nde barÄ±ndÄ±rdÄ±ÄŸÄ± iÃ§in bu ismi almÄ±ÅŸtÄ±r [Razi, Cilt 1, s. 246].</li>
                            <li><strong>es-Seb'u'l-MesÃ¢nÃ®:</strong> Hicr Suresi 87. ayette geÃ§en "Tekrarlanan Yedi" ifadesidir. ZemahÅŸeri ve Razi'ye gÃ¶re, namazlarda tekrarlandÄ±ÄŸÄ± veya Ã¶vgÃ¼ ve dua olarak ikiye bÃ¼kÃ¼ldÃ¼ÄŸÃ¼ (ayrÄ±ldÄ±ÄŸÄ±) iÃ§in bu isim verilmiÅŸtir [Razi, Cilt 1, s. 248; ZemahÅŸeri, Cilt 2, s. 531].</li>
                        </ul>
                        <p><strong>NÃ¼zul Yeri:</strong> Mukatil bin SÃ¼leyman ve bazÄ± rivayetlere gÃ¶re Medine'de inmiÅŸtir [Mukatil, Cilt 1, Fatiha Tefsiri]. Ancak Razi ve ElmalÄ±lÄ± gibi mÃ¼fessirler, namazÄ±n Mekke'de farz kÄ±lÄ±ndÄ±ÄŸÄ±nÄ± ve FatihasÄ±z namaz olmayacaÄŸÄ±nÄ± belirterek Mekke'de indiÄŸini savunurlar. Razi, surenin Ã¶nemine binaen hem Mekke hem Medine'de olmak Ã¼zere iki kez inmiÅŸ olabileceÄŸini belirterek gÃ¶rÃ¼ÅŸleri telif eder [Razi, Cilt 1, s. 253; ElmalÄ±lÄ±, Cilt 1, s. 30].</p>
                    </section>

                    <section>
                        <h2>2. Besmele: "BismillÃ¢hirrahmÃ¢nirrahÃ®m"</h2>
                        <p><strong>FÄ±khi ve Kelami Boyut:</strong> Åafii mezhebine gÃ¶re Besmele Fatiha'dan bir ayettir. Hanefilere gÃ¶re ise sureleri ayÄ±ran mÃ¼stakil bir ayettir [Razi, Cilt 1, s. 268; ElmalÄ±lÄ±, Cilt 1, s. 36].</p>
                        <p><strong>Tasavvufi ve BatÄ±ni Boyut (Ä°bnÃ¼'l-Arabi):</strong> Ä°bnÃ¼'l-Arabi'ye gÃ¶re Besmele, "Ä°sm-i A'zam"dÄ±r. VarlÄ±klar, Besmele'deki "Ba" harfiyle zuhur etmiÅŸtir. "Ba", Allah'Ä±n zatÄ±na iÅŸaret eden "Elif"ten sonra gelen ilk harftir ve Ä°lk AkÄ±l'a delalet eder. Besmele'yi okumak, Ä°lahi zatÄ±n ve sÄ±fatlarÄ±n mazharÄ± olan kamil insan suretiyle iÅŸe baÅŸlamak demektir [Ä°bnÃ¼'l-Arabi, Cilt 1, s. 27-28].</p>
                        <p><strong>Dilbilimsel Boyut:</strong> ZemahÅŸeri'ye gÃ¶re buradaki "Ba" harfi, "Ä°stiane" (yardÄ±m dileme) veya "Ä°lbas" (bereket umarak baÅŸlama) manasÄ±ndadÄ±r. Kulun lisanÄ±yla sÃ¶ylenmiÅŸ bir sÃ¶zdÃ¼r; yani "Bize, Allah'Ä±n ismiyle teberrÃ¼k etmemiz Ã¶ÄŸretildi" demektir [ZemahÅŸeri, Cilt 1, s. 69-70].</p>
                    </section>

                    <section>
                        <h2>3. Ayet Ayet Derinlemesine Analiz</h2>
                        
                        <div class="verse-analysis">
                            <h3>1. Ayet: "Hamd, Ã¢lemlerin Rabbi olan Allah'a mahsustur."</h3>
                            <p><strong>Hamd vs. ÅÃ¼kÃ¼r:</strong> Taberi ve Razi'ye gÃ¶re Hamd, ÅŸÃ¼kÃ¼rden daha kapsamlÄ±dÄ±r. ÅÃ¼kÃ¼r sadece verilen bir nimete karÅŸÄ±lÄ±k yapÄ±lÄ±rken, Hamd hem nimete karÅŸÄ±lÄ±k hem de Allah'Ä±n zatÄ±ndaki ezelÃ® mÃ¼kemmellik iÃ§in yapÄ±lÄ±r [Taberi, Cilt 1, s. 28; Razi, Cilt 9, s. 308]. ZemahÅŸeri'ye gÃ¶re "El" takÄ±sÄ± Ã¶vgÃ¼ tÃ¼rÃ¼nÃ¼n tamamÄ±nÄ±n sadece O'na ait olduÄŸunu ifade eder [ZemahÅŸeri, Cilt 1, s. 82].</p>
                            <p><strong>Alemlerin Rabbi:</strong> Mukatil'e gÃ¶re alemlerden maksat "Cinler ve Ä°nsanlar"dÄ±r. Razi'ye gÃ¶re alem, Allah'Ä±n dÄ±ÅŸÄ±ndaki her varlÄ±ktÄ±r. "Rab" ise terbiye eden, yoktan var edip kemale erdirendir. Bu ifade, Allah'Ä±n varlÄ±ÄŸÄ±nÄ±n ve birliÄŸinin kozmolojik delilidir [Razi, Cilt 1, s. 245]. ElmalÄ±lÄ±, Allah'Ä±n Ã¶zellikle akÄ±l sahibi varlÄ±klar Ã¼zerindeki tecellisine ve hakimiyetine iÅŸarettir [ElmalÄ±lÄ±, Cilt 1, s. 70].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>2. Ayet: "O RahmÃ¢n ve RahÃ®m'dir."</h3>
                            <p><strong>SÄ±fatlarÄ±n FarkÄ±:</strong> Razi ve ElmalÄ±lÄ±'ya gÃ¶re "RahmÃ¢n" zatÃ® bir sÄ±fattÄ±r ve ezeliyetle ilgilidir; yaradÄ±lÄ±ÅŸÄ±n baÅŸlangÄ±cÄ±ndaki genel rahmeti ifade eder. "RahÃ®m" ise fiilÃ® bir sÄ±fattÄ±r ve ebediyetle (sonuÃ§la) ilgilidir; irade sahibi varlÄ±klarÄ±n amellerine karÅŸÄ±lÄ±k verilen Ã¶zel rahmeti ifade eder. Bu yÃ¼zden "DÃ¼nyanÄ±n RahmÃ¢n'Ä±, Ahiretin RahÃ®m'i" denilmiÅŸtir [ElmalÄ±lÄ±, Cilt 1, s. 51-86; Razi, Cilt 21, s. 1246].</p>
                            <p><strong>ZemahÅŸeri'nin YaklaÅŸÄ±mÄ±:</strong> "RahmÃ¢n" kelimesi mÃ¼balaÄŸa ve doluluk ifade eder. "RahÃ®m" ise sÃ¼reklilik bildirir. RahmÃ¢n, RahÃ®m'de bulunmayan bir kuÅŸatÄ±cÄ±lÄ±ÄŸa sahiptir [ZemahÅŸeri, Cilt 1, s. 76].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>3. Ayet: "Din gÃ¼nÃ¼nÃ¼n mÃ¢likidir."</h3>
                            <p><strong>Din GÃ¼nÃ¼:</strong> "Din" burada ceza, hesap ve karÅŸÄ±lÄ±k anlamÄ±ndadÄ±r. O gÃ¼n, mÃ¼lkiyetin ve emrin sadece Allah'a ait olduÄŸu gÃ¼ndÃ¼r [Razi, Cilt 1, s. 374; Taberi, Cilt 1, s. 47].</p>
                            <p><strong>Melik vs. MÃ¢lik:</strong> Razi'ye gÃ¶re "MÃ¢lik" mÃ¼lkÃ¼nde dilediÄŸi gibi tasarruf eden, "Melik" ise yÃ¶netendir. Allah o gÃ¼n her ikisidir. O gÃ¼n "MÃ¼lk kimindir?" sorusuna sadece "Allah'Ä±ndÄ±r" cevabÄ± verilecektir [Razi, Cilt 19, s. 209].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>4. Ayet: "Ancak sana kulluk eder ve ancak senden yardÄ±m dileriz."</h3>
                            <p><strong>Ä°ltifat SanatÄ± (Hitap DeÄŸiÅŸikliÄŸi):</strong> ZemahÅŸeri ve Razi'ye gÃ¶re Ã¼Ã§Ã¼ncÃ¼ ÅŸahÄ±stan "Sen" (muhatap) hitabÄ±na geÃ§iÅŸ, kulun hamd ve sena ile Allah'Ä±n huzuruna manen yaklaÅŸtÄ±ÄŸÄ±nÄ± ve artÄ±k O'na doÄŸrudan hitap edecek huzur makamÄ±na erdiÄŸini gÃ¶sterir. Bu, belagatin zirvesidir [ZemahÅŸeri, Cilt 1, s. 90; Razi, Cilt 1, s. 151].</p>
                            <p><strong>Tevhid ve Sosyoloji:</strong> ElmalÄ±lÄ±, "Ä°badet ederiz" (Ã§oÄŸul) ifadesinin ferdin bencilliÄŸinden kurtulup toplumsal bir ÅŸuurla tÃ¼m kainatla birlikte Allah'a yÃ¶nelmesi olduÄŸunu belirtir [ElmalÄ±lÄ±, Cilt 1, s. 102]. Razi'ye gÃ¶re kul Ã¶nce kulluÄŸunu arz eder (vesile), sonra yardÄ±m ister (talep) [Razi, Cilt 1, s. 151].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>5. Ayet: "Bizi dosdoÄŸru yola ilet."</h3>
                            <p><strong>Hidayet Talebi:</strong> Buradaki talep; hidayette sebat etmek, hidayetin derecelerinde yÃ¼kselmek ve ahirette cennete giden yolda sabit kadem olmaktÄ±r [Razi, Cilt 1, s. 150].</p>
                            <p><strong>SÄ±rat-Ä± MÃ¼stakim:</strong> EÄŸriliÄŸi olmayan, apaÃ§Ä±k yol. Bu; Ä°slam, Kur'an, Hz. Peygamber'in yolu veya tevhid inancÄ± olarak yorumlanmÄ±ÅŸtÄ±r [Taberi, Cilt 1, s. 74; ElmalÄ±lÄ±, Cilt 1, s. 124].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>6. ve 7. Ayet: "Kendilerine nimet verdiklerinin yoluna; gazaba uÄŸrayanlarÄ±n ve sapÄ±tanlarÄ±n yoluna deÄŸil."</h3>
                            <p><strong>Nimet Verilenler:</strong> Peygamberler, sÄ±ddÄ±klar, ÅŸehitler ve salihlerdir [ElmalÄ±lÄ±, Cilt 1, s. 124].</p>
                            <p><strong>Gazaba UÄŸrayanlar ve SapÄ±tanlar:</strong> Rivayet tefsirine gÃ¶re Yahudiler (gazaba uÄŸrayanlar) ve HÄ±ristiyanlar (sapÄ±tanlar) Ã¶rneklendirilir [Taberi, Cilt 1, s. 84; Mukatil, Cilt 1]. Dirayet tefsirine gÃ¶re ise; hakkÄ± bildiÄŸi halde terk edenler (amelde kusur) ve haktan bilgisizce sapanlar (itikatta kusur) kastedilir [Razi, Cilt 1, s. 364; ElmalÄ±lÄ±, Cilt 1, s. 140].</p>
                        </div>
                    </section>

                    <section>
                        <h2>4. Felsefi Yorum ve Sentez</h2>
                        <p>Fatiha Suresi, "VarlÄ±k", "BilinÃ§" ve "Yolculuk" Ã¼Ã§geninde insanÄ±n kozmik serÃ¼veninin Ã¶zetidir.</p>
                        <p><strong>Ontolojik BaÅŸlangÄ±Ã§ (VarlÄ±k):</strong> VarlÄ±ÄŸÄ±n kaynaÄŸÄ±nÄ±n ve devamÄ±nÄ±n mutlak surette Allah'a ait olduÄŸunun ilanÄ±dÄ±r. Alem "Rahman" isminin bir nefesi (Nefes-i Rahmani) olarak varlÄ±k sahasÄ±na Ã§Ä±kmÄ±ÅŸtÄ±r. Rububiyet, Allah'Ä±n her an yaratma ve terbiye halinde olan dinamik mÃ¼dahileti olduÄŸunu gÃ¶sterir.</p>
                        <p><strong>Epistemolojik DÃ¶nÃ¼ÅŸÃ¼m (BilinÃ§):</strong> Surenin en kritik felsefi kÄ±rÄ±lmasÄ± "Ancak Sana" (Ä°yyake) hitabÄ±dÄ±r. Ä°nsan, Allah hakkÄ±nda konuÅŸan bir gÃ¶zlemci olmaktan Ã§Ä±kÄ±p, Allah ile konuÅŸan bir muhatap konumuna yÃ¼kselir. Bu, imanÄ±n taklitten tahkike geÃ§iÅŸidir.</p>
                        <p><strong>Etik ve Teleolojik SonuÃ§ (Yolculuk):</strong> "Din GÃ¼nÃ¼" vurgusu, hayatÄ±n bir amacÄ± ve ahlaki bir sorumluluÄŸu olduÄŸunu hatÄ±rlatÄ±r. Ä°nsan, "Nimet verilenler"in izini sÃ¼rerek dikey bir yÃ¼kseliÅŸ gerÃ§ekleÅŸtirmek zorundadÄ±r.</p>
                        <p><strong>SonuÃ§:</strong> Fatiha; Ä°nsanÄ±n Allah'tan geldiÄŸinin (Mebde), O'nun huzurunda olduÄŸunun (Hal) ve O'na dÃ¶neceÄŸinin (Mead) bilinciyle varoluÅŸunu anlamlandÄ±rma manifestosudur.</p>
                    </section>
                </div>
            `,
            source: `
                1. Fahreddin er-RÃ¢zÃ®, TefsÃ®r-i KebÃ®r (MefÃ¢tÃ®hu'l-Gayb), Cilt 1, 9, 19, 21.
                2. ElmalÄ±lÄ± M. Hamdi YazÄ±r, Hak Dini Kur'an Dili, Cilt 1.
                3. ZemahÅŸerÃ®, el-KeÅŸÅŸÃ¢f, Cilt 1, 2.
                4. TaberÃ®, TaberÃ® Tefsiri, Cilt 1.
                5. Mukatil bin SÃ¼leyman, Tefsir-i Kebir, Cilt 1.
                6. Muhyiddin Ä°bnÃ¼'l-Arabi, Tefsir-i Kebir Teâ€™vilÃ¢t, Cilt 1.
            `
        };
    }

    // For other surahs, we return null for now as the user will provide custom tafsir content
    return null;
}

// ========================
// Verse detail
// ========================
export async function getVerse(surahId, ayahNo, authorId, textMode = 'uthmani') {
    // Primary: acikkuran
    try {
        const mappedAuthor = mapIdForApi(authorId || DEFAULT_AUTHOR);
        const sId = parseInt(surahId);
        const aNo = parseInt(ayahNo);
        const data = await fetchJson(`${ACIKKURAN_API}/surah/${sId}/verse/${aNo}?author=${mappedAuthor}`);
        const d = data.data;
        if (!d) return null;
        const normalized = hydrateVerseSourceMeta({
            id: d.id,
            surah: d.surah ? {
                id: d.surah.id, name: d.surah.name, name_en: d.surah.name_en,
                name_original: d.surah.name_original, slug: d.surah.slug,
            } : { id: parseInt(surahId), name: `Sure ${surahId}` },
            verse_number: d.verse_number,
            source: 'acikkuran',
            isFallback: false,
            verse: d.verse,
            verse_simplified: d.verse_simplified,
            verse_without_vowel: d.verse_without_vowel,
            text_modes: {
                uthmani: d.verse || '',
                plain: d.verse_without_vowel || d.verse_simplified || d.verse || '',
                tajweed: d.verse || ''
            },
            transcription: d.transcription,
            transcription_en: d.transcription_en,
            page: d.page,
            juz_number: d.juz_number,
            translation: d.translation ? {
                id: d.translation.id,
                text: d.translation.text,
                author: normalizeTranslationAuthor(d.translation.author || { id: DEFAULT_AUTHOR, name: 'Diyanet Ä°ÅŸleri' }),
                footnotes: d.translation.footnotes || [],
            } : null,
            words: [], // Will be fetched separately
        })
        return normalized
    } catch (e) {
        console.warn('getVerse failed:', e);
        return null;
    }
}

// ========================
// Tafsir detail
// ========================
// ========================
// Tafsir detail
// ========================
export async function getTafsir(surahId, ayahNo) {
    const FATIHA_SOURCES = `1. Fahreddin er-RÃ¢zÃ®, TefsÃ®r-i KebÃ®r (MefÃ¢tÃ®hu'l-Gayb), Cilt 1, 9, 19, 21.
2. ElmalÄ±lÄ± M. Hamdi YazÄ±r, Hak Dini Kur'an Dili, Cilt 1.
3. ZemahÅŸerÃ®, el-KeÅŸÅŸÃ¢f, Cilt 1, 2.
4. TaberÃ®, TaberÃ® Tefsiri, Cilt 1.
5. Mukatil bin SÃ¼leyman, Tefsir-i Kebir, Cilt 1.
6. Muhyiddin Ä°bnÃ¼'l-Arabi, Tefsir-i Kebir Teâ€™vilÃ¢t, Cilt 1.`;

    // Static override for Fatiha (Surah 1)
    if (parseInt(surahId) === 1) {
        const fatihaTafsir = {
            1: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> Besmelenin Fatiha'dan bir ayet olup olmadÄ±ÄŸÄ± konusundaki mezhep gÃ¶rÃ¼ÅŸlerini tartÄ±ÅŸÄ±r. Åafii mezhebine gÃ¶re Besmele, Fatiha'nÄ±n baÅŸÄ±ndan tam bir ayettir ve namazda sesli okunur. Hanefi mezhebine gÃ¶re ise surelerin arasÄ±nÄ± ayÄ±ran mÃ¼stakil bir ayettir, Fatiha'dan sayÄ±lmaz. Razi, Besmelenin ayet sayÄ±lmasÄ± gerektiÄŸini "Fatiha yedi ayettir" hadisine ve "Allah Fatiha'yÄ± kulumla aramda ikiye bÃ¶ldÃ¼m" hadisindeki dengeye dayandÄ±rarak savunur.</p>
                    <p><strong>ZemahÅŸerÃ® (KeÅŸÅŸÃ¢f):</strong> Medine, Basra ve Åam kurrÃ¢sÄ±na (okuyucularÄ±na) gÃ¶re Besmele Fatiha'dan bir ayet deÄŸildir. Ancak Mekke ve KÃ»fe kurrÃ¢sÄ± ile Åafii fÄ±khÄ±na gÃ¶re Fatiha'nÄ±n ve her surenin baÅŸÄ±ndan tam bir ayettir. ZemahÅŸeri, mushafa yazÄ±lmÄ±ÅŸ olmasÄ±nÄ± onun ayet olduÄŸuna en bÃ¼yÃ¼k delil olarak sunar.</p>
                    <p><strong>Ä°bnÃ¼'l-ArabÃ® (Te'vilat):</strong> Besmeledeki "Be" harfi, varlÄ±ÄŸÄ±n zuhurunu simgeler. Besmele, "Ä°sm-i A'zam"dÄ±r ve kulun Allah'Ä±n zatÄ± ve sÄ±fatlarÄ±yla iÅŸe baÅŸlamasÄ±nÄ± ifade eder.</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> Fatiha'nÄ±n yedi ayet olduÄŸunda ittifak vardÄ±r, ancak bu sayÄ±ya Besmele'nin dahil olup olmadÄ±ÄŸÄ± ihtilaflÄ±dÄ±r. Hanefilere gÃ¶re Besmele mÃ¼stakil bir ayettir, sureye dahil deÄŸildir. Åafiilere gÃ¶re ise Fatiha'nÄ±n ilk ayetidir.</p>
                </div>
            `,
            2: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> "Hamd" ve "ÅÃ¼kÃ¼r" farkÄ± Ã¼zerinde durur. ÅÃ¼kÃ¼r, verilen bir nimete karÅŸÄ±lÄ±k yapÄ±lÄ±rken; Hamd, hem nimete karÅŸÄ±lÄ±k hem de Allah'Ä±n zatÄ±ndaki mÃ¼kemmellik iÃ§in yapÄ±lÄ±r. Hamd, ÅŸÃ¼kÃ¼rden daha kapsamlÄ±dÄ±r. "Alemlerin Rabbi" ifadesindeki "Alem", Allah'Ä±n dÄ±ÅŸÄ±ndaki her varlÄ±ktÄ±r. Ã‡oÄŸul gelmesi (Alemin), her varlÄ±k tÃ¼rÃ¼nÃ¼n ayrÄ± bir alem olduÄŸunu gÃ¶sterir.</p>
                    <p><strong>ZemahÅŸerÃ®:</strong> "El-Hamd" kelimesindeki belirlilik takÄ±sÄ± (LÃ¢m-Ä± tarif), cins veya istiÄŸrak ifade eder; yani Ã¶vgÃ¼ tÃ¼rÃ¼nÃ¼n tamamÄ± veya her Ã§eÅŸidi sadece Allah'a aittir.</p>
                    <p><strong>TaberÃ®:</strong> Hamd, Allah'Ä±n kullarÄ±na verdiÄŸi sayÄ±sÄ±z nimetlere ve O'nun yÃ¼ce sÄ±fatlarÄ±na karÅŸÄ± yapÄ±lan Ã¶vgÃ¼dÃ¼r. Sadece O'na mahsustur.</p>
                    <p><strong>Mukatil bin SÃ¼leyman:</strong> "Alemler" (Alemin) ifadesini, Ã¶zellikle "Cinler ve Ä°nsanlar" olarak tefsir eder.</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> Alemlerin Rabbi, bÃ¼tÃ¼n varlÄ±klarÄ± terbiye eden, geliÅŸtiren ve kemale erdiren demektir. Hamd, irade ile yapÄ±lan bir iyiliÄŸe karÅŸÄ± dil ile yapÄ±lan Ã¶vgÃ¼dÃ¼r.</p>
                </div>
            `,
            3: `
                <div class="verse-tafsir-detail">
                    <p><strong>ZemahÅŸerÃ®:</strong> "RahmÃ¢n", mÃ¼balaÄŸa ifade eder ve rahmetin doluluÄŸunu/kuÅŸatÄ±cÄ±lÄ±ÄŸÄ±nÄ± gÃ¶sterir. "RahÃ®m" ise sÃ¼reklilik bildirir. Harf sayÄ±sÄ± arttÄ±kÃ§a mana da artar kuralÄ± gereÄŸi RahmÃ¢n daha kapsamlÄ±dÄ±r.</p>
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> "RahmÃ¢n", dÃ¼nyada mÃ¼min-kafir ayrÄ±mÄ± yapmadan herkese nimet verendir. "RahÃ®m" ise ahirette sadece mÃ¼minlere merhamet edendir.</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> RahmÃ¢n, ezeliyetle (baÅŸlangÄ±Ã§la) ilgilidir ve Allah'Ä±n zatÄ±na has bir isimdir (kimseye Rahman denmez). RahÃ®m ise ebediyetle (sonuÃ§la) ilgilidir ve fiilÃ® bir sÄ±fattÄ±r.</p>
                </div>
            `,
            4: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> "Din" kelimesi burada "ceza, hesap, karÅŸÄ±lÄ±k" anlamÄ±ndadÄ±r. KÄ±raatlerde hem "MÃªlik" (Sahip) hem "Melik" (HÃ¼kÃ¼mdar) olarak okunmuÅŸtur. Her iki okuyuÅŸ da o gÃ¼n, Allah'tan baÅŸka hiÃ§bir otoritenin kalmayacaÄŸÄ±nÄ± gÃ¶sterir.</p>
                    <p><strong>Mukatil bin SÃ¼leyman:</strong> Din gÃ¼nÃ¼nÃ¼, "Hesap GÃ¼nÃ¼" olarak aÃ§Ä±klar. O gÃ¼n, Allah'tan baÅŸka kimse hÃ¼kÃ¼m veremez.</p>
                    <p><strong>ZemahÅŸerÃ®:</strong> Neden "Din gÃ¼nÃ¼"ne tahsis edildi? Ã‡Ã¼nkÃ¼ o gÃ¼n, dÃ¼nyadaki mÃ¼lk iddialarÄ±nÄ±n tamamen son bulduÄŸu ve emrin sadece Allah'a ait olduÄŸunun herkesÃ§e bilineceÄŸi gÃ¼ndÃ¼r.</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> Melik okunuÅŸu "hÃ¼kÃ¼mdarlÄ±ÄŸÄ±", MÃ¢lik okunuÅŸu "mÃ¼lkiyeti" ifade eder. Fatiha'da iki kÄ±raat ÅŸeklinin bulunmasÄ±, her iki manayÄ± hem siyasi otoriteyi hem Ã¶zel mÃ¼lkiyeti Allah'a hasretmek iÃ§indir.</p>
                </div>
            `,
            5: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> "Ä°ltifat sanatÄ±" vardÄ±r. Surenin baÅŸÄ±nda "O" (gaip) diye bahsedilen Allah'a, burada "Sen" (muhatap) diye hitap edilir. Bu, kulun Ã¶vgÃ¼lerle Allah'a manen yaklaÅŸtÄ±ÄŸÄ±nÄ± ve huzurunda konuÅŸacak makama erdiÄŸini gÃ¶sterir. Ä°badet (kulluk), yardÄ±m istemekten Ã¶nce zikredilmiÅŸtir; Ã§Ã¼nkÃ¼ kulluk vesile, yardÄ±m ise taleptir.</p>
                    <p><strong>ZemahÅŸerÃ®:</strong> "Ä°yyÃ¢ke" (Ancak sana) kelimesinin fiilden Ã¶nce gelmesi "tahsis" (Ã¶zgÃ¼leme) ifade eder. Yani "BaÅŸkasÄ±na deÄŸil, sadece sana ibadet ederiz" demektir.</p>
                    <p><strong>Ä°bnÃ¼'l-ArabÃ®:</strong> Fatiha, Allah ile kul arasÄ±nda ikiye ayrÄ±lmÄ±ÅŸtÄ±r. Bu ayet, Allah ile kul arasÄ±ndaki ortak noktadÄ±r (YarÄ±sÄ± Allah'Ä±n hakkÄ± olan ibadet, yarÄ±sÄ± kulun hakkÄ± olan yardÄ±m talebi).</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> "Ederiz" diyerek Ã§oÄŸul getirilmesi, ferdiyetÃ§ilikten Ã§Ä±kÄ±p toplumsal bir ÅŸuurla, bÃ¼tÃ¼n mÃ¼minlerle (veya vÃ¼cudun bÃ¼tÃ¼n zerreleriyle) birlikte Allah'a yÃ¶nelmeyi ifade eder.</p>
                </div>
            `,
            6: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> MÃ¼min zaten hidayettedir. Buradaki talep; hidayette sebat etmek, hidayetin artÄ±rÄ±lmasÄ± ve ahirette cennete giden yolda baÅŸarÄ± ihsan edilmesi iÃ§indir.</p>
                    <p><strong>TaberÃ®:</strong> DosdoÄŸru yol (SÄ±rat-Ä± MÃ¼stakim); Ä°slam, Kur'an veya Hz. Peygamber'in yolu olarak tefsir edilmiÅŸtir. EÄŸriliÄŸi olmayan apaÃ§Ä±k yol demektir.</p>
                    <p><strong>ZemahÅŸerÃ®:</strong> SÄ±rÃ¢t kelimesi "yutmak" anlamÄ±ndaki "sarat" kÃ¶kÃ¼nden gelebilir (yolcusunu iÃ§ine alÄ±p yuttuÄŸu iÃ§in). "Ä°let" (ihdina) kelimesi burada "lÃ¼tfet, baÅŸarÄ± ver, sabit kÄ±l" manalarÄ±ndadÄ±r.</p>
                </div>
            `,
            7: `
                <div class="verse-tafsir-detail">
                    <p><strong>Mukatil bin SÃ¼leyman:</strong> "Kendilerine nimet verilenler" peygamberlerdir. "Gazaba uÄŸrayanlar" Yahudilerdir. "SapÄ±tanlar" (Dallin) ise HÄ±ristiyanlardÄ±r. Mukatil bu tefsiri rivayetlere dayandÄ±rÄ±r.</p>
                    <p><strong>Fahreddin er-RÃ¢zÃ®:</strong> Rivayetlerde Yahudi ve HÄ±ristiyanlar olarak geÃ§se de, ayet geneldir. "Gazaba uÄŸrayanlar", hakkÄ± bildiÄŸi halde inatla reddedenler; "SapÄ±tanlar" ise cehalet yÃ¼zÃ¼nden haktan sapanlar (itikatta kusurlu olanlar) olabilir.</p>
                    <p><strong>ZemahÅŸerÃ®:</strong> "Gayr" (DeÄŸil/BaÅŸka) kelimesi burada sÄ±fat konumundadÄ±r. Gazaba uÄŸrayanlar ve sapÄ±tanlar, nimet verilenlerin zÄ±ddÄ±dÄ±r. Nimet verilenler; peygamberler, sÄ±ddÄ±klar, ÅŸehitler ve salihlerdir.</p>
                    <p><strong>ElmalÄ±lÄ± Hamdi YazÄ±r:</strong> "Gayri'l-maÄŸdubi..." ifadesi, nimet verilenlerin yolunun, gazaba uÄŸrayanlarÄ±n ve sapÄ±tanlarÄ±n yolundan kesin Ã§izgilerle ayrÄ±ldÄ±ÄŸÄ±nÄ± gÃ¶sterir.</p>
                    <p><strong>TaberÃ®:</strong> "Amin" demek, "Allah'Ä±m kabul et" demektir ve surenin sonuna eklenmesi sÃ¼nnettir.</p>
                </div>
            `
        };
        const res = fatihaTafsir[parseInt(ayahNo)];
        return res ? { text: res, source: FATIHA_SOURCES } : null;
    }

    // For other surahs, we return null for now as the user will provide custom tafsir content
    return null;
}

// ========================
// All translations
// ========================
export async function getTranslations(surahId, ayahNo) {
    // Primary: acikkuran
    try {
        const data = await fetchJson(`${ACIKKURAN_API}/surah/${surahId}/verse/${ayahNo}/translations`);
        const allTranslations = data.data || [];

        // Fetch all TR and EN translations without restrictive filtering
        const filtered = allTranslations
            .filter(t => t.author?.language === 'tr' || t.author?.language === 'en')
            .map(t => ({
                id: t.id,
                authorId: mapIdFromApi(t.author?.id),
                text: t.text,
                author: normalizeTranslationAuthor(t.author || {}),
                footnotes: t.footnotes || [],
            }));

        return filtered;
    } catch (e) {
        console.warn('getTranslations failed:', e);
        return [];
    }
}

// ========================
// Word-by-word analysis
// ========================
export async function getVerseWords(surahId, ayahNo) {
    // Primary: acikkuran verseparts
    try {
        const data = await fetchJson(`${ACIKKURAN_API}/surah/${surahId}/verse/${ayahNo}/verseparts`);
        return (data.data || []).map(w => ({
            id: w.id,
            sort_number: w.sort_number,
            arabic: w.arabic,
            transcription_tr: w.transcription_tr,
            transcription_en: w.transcription_en,
            translation_tr: w.translation_tr,
            translation_en: w.translation_en,
            source: 'acikkuran',
            isFallback: false,
            morphology: {
                pos: '',
                pos_ar: '',
                lemma: '',
                lemma_ar: '',
                stem: '',
                root: '',
                pattern: '',
                person: '',
                gender: '',
                number: '',
                case: '',
                mood: '',
                voice: '',
                aspect: '',
                state: '',
                form: '',
                i3rab: '',
                details: null
            },
            root: w.root ? {
                id: w.root.id,
                latin: w.root.latin,
                arabic: w.root.arabic,
            } : null,
        })).map(normalizeWordItem);
    } catch (e) {
        console.warn('getVerseWords failed:', e);
        return [];
    }
}

// ========================
// Search
// ========================
export async function searchQuran(query, limit = 30, page = 1) {
    const safeQuery = sanitizeSearchInput(query)
    if (!safeQuery || safeQuery.trim().length < 1) return null;

    // Normalize query: replace commas with spaces for better multi-word search
    const normalizedQuery = safeQuery.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalizedQuery.length < 1) return null;

    // Smart Address Detection: e.g., "2:255", "2 13", "2.186", "2/43"
    const addressMatch = normalizedQuery.match(/^(\d+)[ :./]+(\d+)$/);
    if (addressMatch) {
        const sId = parseInt(addressMatch[1], 10);
        const aNo = parseInt(addressMatch[2], 10);
        if (sId >= 1 && sId <= 114) {
            try {
                const verse = await getVerse(sId, aNo);
                // Ensure the verse number matches what was requested
                if (verse && (verse.verse_number === aNo || parseInt(verse.ayah) === aNo)) {
                    return {
                        surahs: [],
                        verses: [{
                            surahNo: sId,
                            ayah: aNo,
                            textAr: verse.verse,
                            textTr: verse.translation?.text || '',
                            surahTr: verse.surah?.name || `Sure ${sId}`,
                            surahSlug: verse.surah?.slug || ''
                        }],
                        total: 1
                    };
                }
            } catch (e) { console.warn('Address fetch failed:', e); }
        }
    }

    // Single Number Detection: e.g., "112" (Go to Surah)
    if (/^\d+$/.test(normalizedQuery)) {
        const sId = parseInt(normalizedQuery);
        if (sId >= 1 && sId <= 114) {
            const all = await getSurahs();
            const s = all.find(x => x.id === sId);
            if (s) {
                return {
                    surahs: [{
                        no: s.id,
                        nameAr: s.name_original,
                        nameTr: s.name,
                        nameEn: s.name_en,
                        ayahCount: s.verse_count,
                        slug: s.slug,
                    }],
                    verses: [],
                    total: 1
                };
            }
        }
    }

    const terms = normalizedQuery.toLowerCase().split(/\s+/);
    // Primary: acikkuran-api live search
    try {
        const fetchLimit = terms.length > 1 ? 200 : limit;
        const [data, enData] = await Promise.all([
            fetchJson(`${ACIKKURAN_API}/search?q=${encodeURIComponent(normalizedQuery)}&pageSize=${fetchLimit}&page=${page}`),
            fetchJson(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(normalizedQuery)}&size=${limit}&page=${page}&language=en`).catch(() => null)
        ]);
        const d = data.data;

        let verses = (d.hits || []).map(h => ({
            surahNo: h.surah?.id,
            ayah: h.verse?.verse_number,
            textAr: h.verse?.verse,
            textTr: h.text,
            translationLang: h.language || h.author?.language || 'tr',
            translationAuthor: normalizeTranslationName(h.author?.name || ''),
            surahTr: h.surah?.name,
            surahSlug: h.surah?.name_en?.toLowerCase() || '',
        }));

        // Add English-focused results from Quran.com
        const enVerses = (enData?.search?.results || []).map(r => {
            const [sNo, aNo] = String(r.verse_key || '').split(':').map(Number)
            const tr = r.translations?.[0]
            return {
                surahNo: sNo || null,
                ayah: aNo || null,
                textAr: r.text || '',
                textTr: stripHtmlTags(tr?.text || ''),
                translationLang: 'en',
                translationAuthor: normalizeTranslationName(tr?.name || 'Quran.com'),
                surahTr: sNo ? `Sure ${sNo}` : '',
                surahSlug: ''
            }
        }).filter(v => v.surahNo && v.ayah && v.textTr)

        verses = [...verses, ...enVerses]

        // If multi-word search, enforce "AND" behavior client-side
        if (terms.length > 1) {
            verses = verses.filter(v => {
                const tr = (v.textTr || '').toLowerCase();
                const ar = (v.textAr || '').toLowerCase();
                return terms.every(term => tr.includes(term) || ar.includes(term));
            });
        }

        return {
            surahs: (d.surahs || []).map(s => ({
                no: s.id,
                nameAr: s.names?.[2] || '',
                nameTr: s.names?.[0] || '',
                nameEn: s.names?.[1] || '',
                ayahCount: s.verse_count,
                slug: s.names?.[0]?.toLowerCase() || 'surah',
            })),
            verses: verses.slice(0, fetchLimit),
            total: terms.length > 1 ? verses.length : Math.max((d.totalHits || 0), verses.length)
        };
    } catch {
        // Final fallback: mock
        const results = mockSearch(normalizedQuery);
        return {
            query: normalizedQuery,
            surahs: results.surahs,
            verses: results.verses,
            total: results.surahs.length + results.verses.length,
        };
    }
}

// ========================
// Root word
// ========================
// ========================
// Page view
// ========================
export async function getPage(pageNumber, authorId, reciterId, textMode = 'uthmani') {
    // Primary: acikkuran
    try {
        const mappedAuthor = mapIdForApi(authorId || DEFAULT_AUTHOR);
        const data = await fetchJson(`${ACIKKURAN_API}/page/${pageNumber}?author=${mappedAuthor}`);

        const verses = data.data || [];
        // API returns multiple pages in one response (e.g. page/1 returns verses for page 1 and 2)
        const pNum = parseInt(pageNumber);
        const filteredVerses = verses.filter(v => v.page === pNum);
        const finalVerses = filteredVerses.length > 0 ? filteredVerses : verses;

        const normalized = finalVerses.map(v => normalizeVerseItem({
            id: v.id,
            surah: v.surah ? {
                id: v.surah.id, name: v.surah.name, name_en: v.surah.name_en,
                name_original: v.surah.name_original, slug: v.surah.slug,
            } : null,
            source: 'acikkuran',
            isFallback: false,
            verse_number: v.verse_number,
            verse: v.verse,
            verse_simplified: v.verse_simplified,
            verse_without_vowel: v.verse_without_vowel,
            text_modes: {
                uthmani: v.verse || '',
                plain: v.verse_without_vowel || v.verse_simplified || v.verse || '',
                tajweed: v.verse || ''
            },
            transcription: v.transcription,
            transcription_en: v.transcription_en,
            page: v.page,
            juz_number: v.juz_number,
            translation: v.translation ? {
                id: v.translation.id,
                text: v.translation.text,
                author: normalizeTranslationAuthor(v.translation.author),
            } : null,
            audio: getVerseAudioUrl(reciterId || 7, v.surah?.id || 1, v.verse_number)
        }))
        return normalized
    } catch (e) {
        console.warn('getPage failed:', e);
        return [];
    }
}

export async function getRoot(latinOrId) {
    if (typeof latinOrId === 'number') {
        try {
            const data = await fetchJson(`${ACIKKURAN_API}/root/${latinOrId}`);
            return data.data;
        } catch { return null; }
    }

    try {
        const data = await fetchJson(`${ACIKKURAN_API}/root/latin/${encodeURIComponent(latinOrId)}`);
        return data.data;
    } catch { return null; }
}



