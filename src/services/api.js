// API Service — Connects React frontend to PHP backend
// Falls back to acikkuran-api directly when our backend is unavailable (local dev)

import { surahs as mockSurahs, searchQuran as mockSearch } from '../data/quranData'
import { getVerseAudioUrl } from './audio'
import { sanitizeSearchInput } from '../utils/security'
import { buildTextModesFromVerse, getVerseTextByMode } from '../utils/textMode'

let diyanetTafsirCache = null
let diyanetSurahInfoCache = null

async function loadDiyanetTafsirCache() {
    if (diyanetTafsirCache) return diyanetTafsirCache
    const response = await fetch('/diyanet_verse_tafsir.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error('Diyanet tefsir verisi yüklenemedi.')
    diyanetTafsirCache = await response.json()
    return diyanetTafsirCache
}

async function loadDiyanetSurahInfoCache() {
    if (diyanetSurahInfoCache) return diyanetSurahInfoCache
    const response = await fetch('/diyanet_surah_info.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error('Diyanet sure bilgisi yüklenemedi.')
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
                source: "Diyanet İşleri Başkanlığı — Kur'an Yolu Tefsiri",
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
                source: info.source || 'Diyanet İşleri Başkanlığı'
            }
        }
    } catch (e) {
        console.error("Diyanet Surah Info error:", e);
        return null;
    }
}
const ACIKKURAN_API = 'https://api.acikkuran.com';
const DEFAULT_AUTHOR = 77; // Diyanet İşleri (quran.com ID, internally mapped to 11 for acikkuran)

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
    if (lower.includes('tefsir çevirisi')) return raw;
    return `${raw} (Tefsir Çevirisi)`;
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
        } catch {
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
export async function getSurah(id, authorId) {
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
                        <h2>1. Giriş: Surenin Kimliği ve İsimleri</h2>
                        <p>Sureye verilen isimler, onun muhtevasının zenginliğini gösterir.</p>
                        <ul>
                            <li><strong>Fâtihatü'l-Kitâb:</strong> Kitabın, kıraatin ve namazın kendisiyle başlaması nedeniyle bu isim verilmiştir [Razi, Cilt 1, s. 245; Elmalılı, Cilt 1, s. 28].</li>
                            <li><strong>Ümmü'l-Kur'an:</strong> Razi'ye göre Kur'an'ın temel maksatları olan "İlahiyat" (Allah'ın zatı ve sıfatları), "Mead" (Ahiret), "Nübüvvet" ve "Kader" konularını özünde barındırdığı için bu ismi almıştır [Razi, Cilt 1, s. 246].</li>
                            <li><strong>es-Seb'u'l-Mesânî:</strong> Hicr Suresi 87. ayette geçen "Tekrarlanan Yedi" ifadesidir. Zemahşeri ve Razi'ye göre, namazlarda tekrarlandığı veya övgü ve dua olarak ikiye büküldüğü (ayrıldığı) için bu isim verilmiştir [Razi, Cilt 1, s. 248; Zemahşeri, Cilt 2, s. 531].</li>
                        </ul>
                        <p><strong>Nüzul Yeri:</strong> Mukatil bin Süleyman ve bazı rivayetlere göre Medine'de inmiştir [Mukatil, Cilt 1, Fatiha Tefsiri]. Ancak Razi ve Elmalılı gibi müfessirler, namazın Mekke'de farz kılındığını ve Fatihasız namaz olmayacağını belirterek Mekke'de indiğini savunurlar. Razi, surenin önemine binaen hem Mekke hem Medine'de olmak üzere iki kez inmiş olabileceğini belirterek görüşleri telif eder [Razi, Cilt 1, s. 253; Elmalılı, Cilt 1, s. 30].</p>
                    </section>

                    <section>
                        <h2>2. Besmele: "Bismillâhirrahmânirrahîm"</h2>
                        <p><strong>Fıkhi ve Kelami Boyut:</strong> Şafii mezhebine göre Besmele Fatiha'dan bir ayettir. Hanefilere göre ise sureleri ayıran müstakil bir ayettir [Razi, Cilt 1, s. 268; Elmalılı, Cilt 1, s. 36].</p>
                        <p><strong>Tasavvufi ve Batıni Boyut (İbnü'l-Arabi):</strong> İbnü'l-Arabi'ye göre Besmele, "İsm-i A'zam"dır. Varlıklar, Besmele'deki "Ba" harfiyle zuhur etmiştir. "Ba", Allah'ın zatına işaret eden "Elif"ten sonra gelen ilk harftir ve İlk Akıl'a delalet eder. Besmele'yi okumak, İlahi zatın ve sıfatların mazharı olan kamil insan suretiyle işe başlamak demektir [İbnü'l-Arabi, Cilt 1, s. 27-28].</p>
                        <p><strong>Dilbilimsel Boyut:</strong> Zemahşeri'ye göre buradaki "Ba" harfi, "İstiane" (yardım dileme) veya "İlbas" (bereket umarak başlama) manasındadır. Kulun lisanıyla söylenmiş bir sözdür; yani "Bize, Allah'ın ismiyle teberrük etmemiz öğretildi" demektir [Zemahşeri, Cilt 1, s. 69-70].</p>
                    </section>

                    <section>
                        <h2>3. Ayet Ayet Derinlemesine Analiz</h2>
                        
                        <div class="verse-analysis">
                            <h3>1. Ayet: "Hamd, âlemlerin Rabbi olan Allah'a mahsustur."</h3>
                            <p><strong>Hamd vs. Şükür:</strong> Taberi ve Razi'ye göre Hamd, şükürden daha kapsamlıdır. Şükür sadece verilen bir nimete karşılık yapılırken, Hamd hem nimete karşılık hem de Allah'ın zatındaki ezelî mükemmellik için yapılır [Taberi, Cilt 1, s. 28; Razi, Cilt 9, s. 308]. Zemahşeri'ye göre "El" takısı övgü türünün tamamının sadece O'na ait olduğunu ifade eder [Zemahşeri, Cilt 1, s. 82].</p>
                            <p><strong>Alemlerin Rabbi:</strong> Mukatil'e göre alemlerden maksat "Cinler ve İnsanlar"dır. Razi'ye göre alem, Allah'ın dışındaki her varlıktır. "Rab" ise terbiye eden, yoktan var edip kemale erdirendir. Bu ifade, Allah'ın varlığının ve birliğinin kozmolojik delilidir [Razi, Cilt 1, s. 245]. Elmalılı, Allah'ın özellikle akıl sahibi varlıklar üzerindeki tecellisine ve hakimiyetine işarettir [Elmalılı, Cilt 1, s. 70].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>2. Ayet: "O Rahmân ve Rahîm'dir."</h3>
                            <p><strong>Sıfatların Farkı:</strong> Razi ve Elmalılı'ya göre "Rahmân" zatî bir sıfattır ve ezeliyetle ilgilidir; yaradılışın başlangıcındaki genel rahmeti ifade eder. "Rahîm" ise fiilî bir sıfattır ve ebediyetle (sonuçla) ilgilidir; irade sahibi varlıkların amellerine karşılık verilen özel rahmeti ifade eder. Bu yüzden "Dünyanın Rahmân'ı, Ahiretin Rahîm'i" denilmiştir [Elmalılı, Cilt 1, s. 51-86; Razi, Cilt 21, s. 1246].</p>
                            <p><strong>Zemahşeri'nin Yaklaşımı:</strong> "Rahmân" kelimesi mübalağa ve doluluk ifade eder. "Rahîm" ise süreklilik bildirir. Rahmân, Rahîm'de bulunmayan bir kuşatıcılığa sahiptir [Zemahşeri, Cilt 1, s. 76].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>3. Ayet: "Din gününün mâlikidir."</h3>
                            <p><strong>Din Günü:</strong> "Din" burada ceza, hesap ve karşılık anlamındadır. O gün, mülkiyetin ve emrin sadece Allah'a ait olduğu gündür [Razi, Cilt 1, s. 374; Taberi, Cilt 1, s. 47].</p>
                            <p><strong>Melik vs. Mâlik:</strong> Razi'ye göre "Mâlik" mülkünde dilediği gibi tasarruf eden, "Melik" ise yönetendir. Allah o gün her ikisidir. O gün "Mülk kimindir?" sorusuna sadece "Allah'ındır" cevabı verilecektir [Razi, Cilt 19, s. 209].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>4. Ayet: "Ancak sana kulluk eder ve ancak senden yardım dileriz."</h3>
                            <p><strong>İltifat Sanatı (Hitap Değişikliği):</strong> Zemahşeri ve Razi'ye göre üçüncü şahıstan "Sen" (muhatap) hitabına geçiş, kulun hamd ve sena ile Allah'ın huzuruna manen yaklaştığını ve artık O'na doğrudan hitap edecek huzur makamına erdiğini gösterir. Bu, belagatin zirvesidir [Zemahşeri, Cilt 1, s. 90; Razi, Cilt 1, s. 151].</p>
                            <p><strong>Tevhid ve Sosyoloji:</strong> Elmalılı, "İbadet ederiz" (çoğul) ifadesinin ferdin bencilliğinden kurtulup toplumsal bir şuurla tüm kainatla birlikte Allah'a yönelmesi olduğunu belirtir [Elmalılı, Cilt 1, s. 102]. Razi'ye göre kul önce kulluğunu arz eder (vesile), sonra yardım ister (talep) [Razi, Cilt 1, s. 151].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>5. Ayet: "Bizi dosdoğru yola ilet."</h3>
                            <p><strong>Hidayet Talebi:</strong> Buradaki talep; hidayette sebat etmek, hidayetin derecelerinde yükselmek ve ahirette cennete giden yolda sabit kadem olmaktır [Razi, Cilt 1, s. 150].</p>
                            <p><strong>Sırat-ı Müstakim:</strong> Eğriliği olmayan, apaçık yol. Bu; İslam, Kur'an, Hz. Peygamber'in yolu veya tevhid inancı olarak yorumlanmıştır [Taberi, Cilt 1, s. 74; Elmalılı, Cilt 1, s. 124].</p>
                        </div>

                        <div class="verse-analysis">
                            <h3>6. ve 7. Ayet: "Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapıtanların yoluna değil."</h3>
                            <p><strong>Nimet Verilenler:</strong> Peygamberler, sıddıklar, şehitler ve salihlerdir [Elmalılı, Cilt 1, s. 124].</p>
                            <p><strong>Gazaba Uğrayanlar ve Sapıtanlar:</strong> Rivayet tefsirine göre Yahudiler (gazaba uğrayanlar) ve Hıristiyanlar (sapıtanlar) örneklendirilir [Taberi, Cilt 1, s. 84; Mukatil, Cilt 1]. Dirayet tefsirine göre ise; hakkı bildiği halde terk edenler (amelde kusur) ve haktan bilgisizce sapanlar (itikatta kusur) kastedilir [Razi, Cilt 1, s. 364; Elmalılı, Cilt 1, s. 140].</p>
                        </div>
                    </section>

                    <section>
                        <h2>4. Felsefi Yorum ve Sentez</h2>
                        <p>Fatiha Suresi, "Varlık", "Bilinç" ve "Yolculuk" üçgeninde insanın kozmik serüveninin özetidir.</p>
                        <p><strong>Ontolojik Başlangıç (Varlık):</strong> Varlığın kaynağının ve devamının mutlak surette Allah'a ait olduğunun ilanıdır. Alem "Rahman" isminin bir nefesi (Nefes-i Rahmani) olarak varlık sahasına çıkmıştır. Rububiyet, Allah'ın her an yaratma ve terbiye halinde olan dinamik müdahileti olduğunu gösterir.</p>
                        <p><strong>Epistemolojik Dönüşüm (Bilinç):</strong> Surenin en kritik felsefi kırılması "Ancak Sana" (İyyake) hitabıdır. İnsan, Allah hakkında konuşan bir gözlemci olmaktan çıkıp, Allah ile konuşan bir muhatap konumuna yükselir. Bu, imanın taklitten tahkike geçişidir.</p>
                        <p><strong>Etik ve Teleolojik Sonuç (Yolculuk):</strong> "Din Günü" vurgusu, hayatın bir amacı ve ahlaki bir sorumluluğu olduğunu hatırlatır. İnsan, "Nimet verilenler"in izini sürerek dikey bir yükseliş gerçekleştirmek zorundadır.</p>
                        <p><strong>Sonuç:</strong> Fatiha; İnsanın Allah'tan geldiğinin (Mebde), O'nun huzurunda olduğunun (Hal) ve O'na döneceğinin (Mead) bilinciyle varoluşunu anlamlandırma manifestosudur.</p>
                    </section>
                </div>
            `,
            source: `
                1. Fahreddin er-Râzî, Tefsîr-i Kebîr (Mefâtîhu'l-Gayb), Cilt 1, 9, 19, 21.
                2. Elmalılı M. Hamdi Yazır, Hak Dini Kur'an Dili, Cilt 1.
                3. Zemahşerî, el-Keşşâf, Cilt 1, 2.
                4. Taberî, Taberî Tefsiri, Cilt 1.
                5. Mukatil bin Süleyman, Tefsir-i Kebir, Cilt 1.
                6. Muhyiddin İbnü'l-Arabi, Tefsir-i Kebir Te’vilât, Cilt 1.
            `
        };
    }

    // For other surahs, we return null for now as the user will provide custom tafsir content
    return null;
}

// ========================
// Verse detail
// ========================
export async function getVerse(surahId, ayahNo, authorId) {
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
                author: normalizeTranslationAuthor(d.translation.author || { id: DEFAULT_AUTHOR, name: 'Diyanet İşleri' }),
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
    const FATIHA_SOURCES = `1. Fahreddin er-Râzî, Tefsîr-i Kebîr (Mefâtîhu'l-Gayb), Cilt 1, 9, 19, 21.
2. Elmalılı M. Hamdi Yazır, Hak Dini Kur'an Dili, Cilt 1.
3. Zemahşerî, el-Keşşâf, Cilt 1, 2.
4. Taberî, Taberî Tefsiri, Cilt 1.
5. Mukatil bin Süleyman, Tefsir-i Kebir, Cilt 1.
6. Muhyiddin İbnü'l-Arabi, Tefsir-i Kebir Te’vilât, Cilt 1.`;

    // Static override for Fatiha (Surah 1)
    if (parseInt(surahId) === 1) {
        const fatihaTafsir = {
            1: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-Râzî:</strong> Besmelenin Fatiha'dan bir ayet olup olmadığı konusundaki mezhep görüşlerini tartışır. Şafii mezhebine göre Besmele, Fatiha'nın başından tam bir ayettir ve namazda sesli okunur. Hanefi mezhebine göre ise surelerin arasını ayıran müstakil bir ayettir, Fatiha'dan sayılmaz. Razi, Besmelenin ayet sayılması gerektiğini "Fatiha yedi ayettir" hadisine ve "Allah Fatiha'yı kulumla aramda ikiye böldüm" hadisindeki dengeye dayandırarak savunur.</p>
                    <p><strong>Zemahşerî (Keşşâf):</strong> Medine, Basra ve Şam kurrâsına (okuyucularına) göre Besmele Fatiha'dan bir ayet değildir. Ancak Mekke ve Kûfe kurrâsı ile Şafii fıkhına göre Fatiha'nın ve her surenin başından tam bir ayettir. Zemahşeri, mushafa yazılmış olmasını onun ayet olduğuna en büyük delil olarak sunar.</p>
                    <p><strong>İbnü'l-Arabî (Te'vilat):</strong> Besmeledeki "Be" harfi, varlığın zuhurunu simgeler. Besmele, "İsm-i A'zam"dır ve kulun Allah'ın zatı ve sıfatlarıyla işe başlamasını ifade eder.</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> Fatiha'nın yedi ayet olduğunda ittifak vardır, ancak bu sayıya Besmele'nin dahil olup olmadığı ihtilaflıdır. Hanefilere göre Besmele müstakil bir ayettir, sureye dahil değildir. Şafiilere göre ise Fatiha'nın ilk ayetidir.</p>
                </div>
            `,
            2: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-Râzî:</strong> "Hamd" ve "Şükür" farkı üzerinde durur. Şükür, verilen bir nimete karşılık yapılırken; Hamd, hem nimete karşılık hem de Allah'ın zatındaki mükemmellik için yapılır. Hamd, şükürden daha kapsamlıdır. "Alemlerin Rabbi" ifadesindeki "Alem", Allah'ın dışındaki her varlıktır. Çoğul gelmesi (Alemin), her varlık türünün ayrı bir alem olduğunu gösterir.</p>
                    <p><strong>Zemahşerî:</strong> "El-Hamd" kelimesindeki belirlilik takısı (Lâm-ı tarif), cins veya istiğrak ifade eder; yani övgü türünün tamamı veya her çeşidi sadece Allah'a aittir.</p>
                    <p><strong>Taberî:</strong> Hamd, Allah'ın kullarına verdiği sayısız nimetlere ve O'nun yüce sıfatlarına karşı yapılan övgüdür. Sadece O'na mahsustur.</p>
                    <p><strong>Mukatil bin Süleyman:</strong> "Alemler" (Alemin) ifadesini, özellikle "Cinler ve İnsanlar" olarak tefsir eder.</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> Alemlerin Rabbi, bütün varlıkları terbiye eden, geliştiren ve kemale erdiren demektir. Hamd, irade ile yapılan bir iyiliğe karşı dil ile yapılan övgüdür.</p>
                </div>
            `,
            3: `
                <div class="verse-tafsir-detail">
                    <p><strong>Zemahşerî:</strong> "Rahmân", mübalağa ifade eder ve rahmetin doluluğunu/kuşatıcılığını gösterir. "Rahîm" ise süreklilik bildirir. Harf sayısı arttıkça mana da artar kuralı gereği Rahmân daha kapsamlıdır.</p>
                    <p><strong>Fahreddin er-Râzî:</strong> "Rahmân", dünyada mümin-kafir ayrımı yapmadan herkese nimet verendir. "Rahîm" ise ahirette sadece müminlere merhamet edendir.</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> Rahmân, ezeliyetle (başlangıçla) ilgilidir ve Allah'ın zatına has bir isimdir (kimseye Rahman denmez). Rahîm ise ebediyetle (sonuçla) ilgilidir ve fiilî bir sıfattır.</p>
                </div>
            `,
            4: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-Râzî:</strong> "Din" kelimesi burada "ceza, hesap, karşılık" anlamındadır. Kıraatlerde hem "Mêlik" (Sahip) hem "Melik" (Hükümdar) olarak okunmuştur. Her iki okuyuş da o gün, Allah'tan başka hiçbir otoritenin kalmayacağını gösterir.</p>
                    <p><strong>Mukatil bin Süleyman:</strong> Din gününü, "Hesap Günü" olarak açıklar. O gün, Allah'tan başka kimse hüküm veremez.</p>
                    <p><strong>Zemahşerî:</strong> Neden "Din günü"ne tahsis edildi? Çünkü o gün, dünyadaki mülk iddialarının tamamen son bulduğu ve emrin sadece Allah'a ait olduğunun herkesçe bilineceği gündür.</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> Melik okunuşu "hükümdarlığı", Mâlik okunuşu "mülkiyeti" ifade eder. Fatiha'da iki kıraat şeklinin bulunması, her iki manayı hem siyasi otoriteyi hem özel mülkiyeti Allah'a hasretmek içindir.</p>
                </div>
            `,
            5: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-Râzî:</strong> "İltifat sanatı" vardır. Surenin başında "O" (gaip) diye bahsedilen Allah'a, burada "Sen" (muhatap) diye hitap edilir. Bu, kulun övgülerle Allah'a manen yaklaştığını ve huzurunda konuşacak makama erdiğini gösterir. İbadet (kulluk), yardım istemekten önce zikredilmiştir; çünkü kulluk vesile, yardım ise taleptir.</p>
                    <p><strong>Zemahşerî:</strong> "İyyâke" (Ancak sana) kelimesinin fiilden önce gelmesi "tahsis" (özgüleme) ifade eder. Yani "Başkasına değil, sadece sana ibadet ederiz" demektir.</p>
                    <p><strong>İbnü'l-Arabî:</strong> Fatiha, Allah ile kul arasında ikiye ayrılmıştır. Bu ayet, Allah ile kul arasındaki ortak noktadır (Yarısı Allah'ın hakkı olan ibadet, yarısı kulun hakkı olan yardım talebi).</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> "Ederiz" diyerek çoğul getirilmesi, ferdiyetçilikten çıkıp toplumsal bir şuurla, bütün müminlerle (veya vücudun bütün zerreleriyle) birlikte Allah'a yönelmeyi ifade eder.</p>
                </div>
            `,
            6: `
                <div class="verse-tafsir-detail">
                    <p><strong>Fahreddin er-Râzî:</strong> Mümin zaten hidayettedir. Buradaki talep; hidayette sebat etmek, hidayetin artırılması ve ahirette cennete giden yolda başarı ihsan edilmesi içindir.</p>
                    <p><strong>Taberî:</strong> Dosdoğru yol (Sırat-ı Müstakim); İslam, Kur'an veya Hz. Peygamber'in yolu olarak tefsir edilmiştir. Eğriliği olmayan apaçık yol demektir.</p>
                    <p><strong>Zemahşerî:</strong> Sırât kelimesi "yutmak" anlamındaki "sarat" kökünden gelebilir (yolcusunu içine alıp yuttuğu için). "İlet" (ihdina) kelimesi burada "lütfet, başarı ver, sabit kıl" manalarındadır.</p>
                </div>
            `,
            7: `
                <div class="verse-tafsir-detail">
                    <p><strong>Mukatil bin Süleyman:</strong> "Kendilerine nimet verilenler" peygamberlerdir. "Gazaba uğrayanlar" Yahudilerdir. "Sapıtanlar" (Dallin) ise Hıristiyanlardır. Mukatil bu tefsiri rivayetlere dayandırır.</p>
                    <p><strong>Fahreddin er-Râzî:</strong> Rivayetlerde Yahudi ve Hıristiyanlar olarak geçse de, ayet geneldir. "Gazaba uğrayanlar", hakkı bildiği halde inatla reddedenler; "Sapıtanlar" ise cehalet yüzünden haktan sapanlar (itikatta kusurlu olanlar) olabilir.</p>
                    <p><strong>Zemahşerî:</strong> "Gayr" (Değil/Başka) kelimesi burada sıfat konumundadır. Gazaba uğrayanlar ve sapıtanlar, nimet verilenlerin zıddıdır. Nimet verilenler; peygamberler, sıddıklar, şehitler ve salihlerdir.</p>
                    <p><strong>Elmalılı Hamdi Yazır:</strong> "Gayri'l-mağdubi..." ifadesi, nimet verilenlerin yolunun, gazaba uğrayanların ve sapıtanların yolundan kesin çizgilerle ayrıldığını gösterir.</p>
                    <p><strong>Taberî:</strong> "Amin" demek, "Allah'ım kabul et" demektir ve surenin sonuna eklenmesi sünnettir.</p>
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
export async function getPage(pageNumber, authorId, reciterId) {
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
