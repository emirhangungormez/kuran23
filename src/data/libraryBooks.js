import { TAFSIR_SOURCES } from './tafsirSources'
import { TEFSIRKUTUPHANESI_FATIHA_DATA } from './tefsirkutuphanesiFatihaData'
import { surahs as allSurahs } from './quranData'

const TEFSIR_BOOK_META = {
  celaleyn: {
    titleTr: 'Celâleyn Tefsiri',
    authorTr: 'Mahallî - Süyûtî',
    titleAr: 'تفسير الجلالين',
    authorAr: 'جلال الدين المحلي - جلال الدين السيوطي'
  },
  beydavi: {
    titleTr: 'Envârü’t-Tenzîl',
    authorTr: 'Beydâvî',
    titleAr: 'أنوار التنزيل',
    authorAr: 'البيضاوي'
  },
  nesefi: {
    titleTr: 'Medârikü’t-Tenzîl',
    authorTr: 'Nesefî',
    titleAr: 'مدارك التنزيل',
    authorAr: 'النسفي'
  },
  kurtubi: {
    titleTr: 'Kurtubî Tefsiri',
    authorTr: 'Kurtubî',
    titleAr: 'الجامع لأحكام القرآن',
    authorAr: 'القرطبي'
  },
  ibn_cevzi: {
    titleTr: 'Zâdü’l-Mesîr',
    authorTr: 'İbnü’l-Cevzî',
    titleAr: 'زاد المسير',
    authorAr: 'ابن الجوزي'
  },
  suyuti_durrul_mensur: {
    titleTr: 'ed-Dürrü’l-Mensûr',
    authorTr: 'Süyûtî',
    titleAr: 'الدر المنثور',
    authorAr: 'جلال الدين السيوطي'
  },
  ebussuud: {
    titleTr: 'İrşâdü’l-Aklis-Selîm',
    authorTr: 'Ebussuûd Efendi',
    titleAr: 'إرشاد العقل السليم',
    authorAr: 'أبو السعود'
  },
  razi: {
    titleTr: 'Mefâtîhu’l-Gayb',
    authorTr: 'Fahreddîn er-Râzî',
    titleAr: 'مفاتيح الغيب',
    authorAr: 'فخر الدين الرازي'
  },
  taberi: {
    titleTr: 'Câmiu’l-Beyân',
    authorTr: 'Taberî',
    titleAr: 'جامع البيان',
    authorAr: 'الطبري'
  },
  ruhulbeyan: {
    titleTr: 'Rûhu’l-Beyân',
    authorTr: 'İsmail Hakkı Bursevî',
    titleAr: 'روح البيان',
    authorAr: 'إسماعيل حقي'
  },
  elmalili_orijinal: {
    titleTr: 'Hak Dini Kur’an Dili',
    authorTr: 'Elmalılı Hamdi Yazır',
    titleAr: 'حق ديني قرآن ديلي',
    authorAr: 'محمد حمدي يازر'
  },
  elmalili_sadelestirilmis: {
    titleTr: 'Hak Dini Kur’an Dili (Sade)',
    authorTr: 'Elmalılı Hamdi Yazır',
    titleAr: 'حق ديني قرآن ديلي',
    authorAr: 'محمد حمدي يازر'
  },
  besairul_kuran: {
    titleTr: 'Beşâirü’l-Kur’ân',
    authorTr: 'Çağdaş Derleme',
    titleAr: 'بصائر القرآن',
    authorAr: 'مؤلف معاصر'
  },
  ibn_kesir: {
    titleTr: 'İbn Kesîr Tefsiri',
    authorTr: 'İbn Kesîr',
    titleAr: 'تفسير ابن كثير',
    authorAr: 'ابن كثير'
  },
  fizilalil_kuran: {
    titleTr: 'Fî Zılâli’l-Kur’ân',
    authorTr: 'Seyyid Kutub',
    titleAr: 'في ظلال القرآن',
    authorAr: 'سيد قطب'
  },
  tefhimul_kuran: {
    titleTr: 'Tefhîmu’l-Kur’ân',
    authorTr: 'Mevdûdî',
    titleAr: 'تفهيم القرآن',
    authorAr: 'أبو الأعلى المودودي'
  }
}

const LIBRARY_SOURCES = TAFSIR_SOURCES.filter((source) => source.id !== 'kuran23' && source.id !== 'diyanet')

export const LIBRARY_CONTENT = TEFSIRKUTUPHANESI_FATIHA_DATA?.content || {}

export const MEAL_BOOKS = [
  {
    id: 'meal-diyanet',
    category: 'meal',
    titleTr: 'Kur’an-ı Kerim ve Türkçe Meâli',
    titleAr: 'القرآن الكريم',
    authorTr: 'Diyanet İşleri Başkanlığı',
    authorAr: 'رئاسة الشؤون الدينية',
    hasTrTranslation: true,
    description: 'Güncel Türkçe meal yaklaşımı'
  },
  {
    id: 'meal-elmalili',
    category: 'meal',
    titleTr: 'Hak Dini Kur’an Dili (Meal)',
    titleAr: 'حق ديني قرآن ديلي',
    authorTr: 'Elmalılı Hamdi Yazır',
    authorAr: 'ألماليللي حمدي يازر',
    hasTrTranslation: true,
    description: 'Klasik Osmanlıca üslubun modern aktarımı'
  },
  {
    id: 'meal-uzlasimli',
    category: 'meal',
    titleTr: 'Karşılaştırmalı Türkçe Mealler',
    titleAr: 'ترجمات تركية مقارنة',
    authorTr: 'Çoklu meal seçkisi',
    authorAr: 'اختيار متعدد',
    hasTrTranslation: true,
    description: 'Aynı ayet için birden fazla meal okuma'
  }
]

export const TEFSIR_BOOKS = LIBRARY_SOURCES.map((source) => {
  const meta = TEFSIR_BOOK_META[source.id] || {}
  return {
    id: source.id,
    sourceId: source.id,
    category: 'tefsir',
    titleTr: meta.titleTr || source.tabLabel,
    titleAr: meta.titleAr || 'كتاب التفسير',
    authorTr: meta.authorTr || source.shortLabel,
    authorAr: meta.authorAr || 'مفسر',
    hasTrTranslation: true,
    description: 'TR çeviri ile okunabilir tefsir metni'
  }
})

export const ALL_BOOKS = [...TEFSIR_BOOKS, ...MEAL_BOOKS]

export function getBookById(bookId) {
  return ALL_BOOKS.find((book) => book.id === bookId) || null
}

export function getBookSourceData(book) {
  if (!book || book.category !== 'tefsir') return { surah: {}, verse: {} }
  return LIBRARY_CONTENT[book.sourceId] || { surah: {}, verse: {} }
}

export function getSurahIds(sourceData) {
  const ids = new Set()

  Object.keys(sourceData?.surah || {}).forEach((key) => {
    const parsed = Number(key)
    if (Number.isInteger(parsed) && parsed > 0) ids.add(parsed)
  })

  Object.keys(sourceData?.verse || {}).forEach((key) => {
    const [sid] = String(key).split(':')
    const parsed = Number(sid)
    if (Number.isInteger(parsed) && parsed > 0) ids.add(parsed)
  })

  return Array.from(ids).sort((a, b) => a - b)
}

export function getAyahNumbers(sourceData, surahId) {
  return Object.keys(sourceData?.verse || {})
    .map((key) => {
      const [sid, ayah] = String(key).split(':')
      return Number(sid) === Number(surahId) ? Number(ayah) : null
    })
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b)
}

export function splitIntoSections(formattedHtml) {
  if (!formattedHtml) return []
  if (typeof window === 'undefined') return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="root">${formattedHtml}</div>`, 'text/html')
    const root = doc.querySelector('#root')
    if (!root) return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]

    const sections = []
    let current = null

    const pushCurrent = () => {
      if (!current) return
      const normalized = (current.bodyHtml || '').trim()
      if (!normalized) return
      sections.push({
        title: current.title || `${sections.length + 1}. Bölüm`,
        bodyHtml: normalized
      })
    }

    Array.from(root.childNodes).forEach((node) => {
      const tagName = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : ''
      const isHeading = tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4'

      if (isHeading) {
        pushCurrent()
        current = {
          title: (node.textContent || '').trim() || `${sections.length + 1}. Bölüm`,
          bodyHtml: ''
        }
        return
      }

      if (!current) {
        current = { title: '1. Bölüm', bodyHtml: '' }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        current.bodyHtml += node.outerHTML
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        current.bodyHtml += `<p>${node.textContent.trim()}</p>`
      }
    })

    pushCurrent()
    return sections.length ? sections : [{ title: '1. Bölüm', bodyHtml: formattedHtml }]
  } catch {
    return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]
  }
}

export function getSurahTitle(surahId) {
  const match = allSurahs.find((surah) => Number(surah.no) === Number(surahId))
  if (!match) return `Sûre ${surahId}`
  return `${match.nameTr} (${match.no})`
}
