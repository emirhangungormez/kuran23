import { TAFSIR_SOURCES } from './tafsirSources'
import { TEFSIRKUTUPHANESI_FATIHA_DATA } from './tefsirkutuphanesiFatihaData'
import { surahs as allSurahs } from './quranData'

const TEFSIR_BOOK_META = {
  celaleyn: { titleAr: 'تفسير الجلالين', authorAr: 'جلال الدين المحلي - جلال الدين السيوطي' },
  beydavi: { titleAr: 'أنوار التنزيل', authorAr: 'البيضاوي' },
  nesefi: { titleAr: 'مدارك التنزيل', authorAr: 'النسفي' },
  kurtubi: { titleAr: 'الجامع لاحكام القرآن', authorAr: 'القرطبي' },
  ibn_cevzi: { titleAr: 'زاد المسير', authorAr: 'ابن الجوزي' },
  suyuti_durrul_mensur: { titleAr: 'الدر المنثور', authorAr: 'جلال الدين السيوطي' },
  ebussuud: { titleAr: 'إرشاد العقل السليم', authorAr: 'أبو السعود' },
  razi: { titleAr: 'مفاتيح الغيب', authorAr: 'فخر الدين الرازي' },
  taberi: { titleAr: 'جامع البيان', authorAr: 'الطبري' },
  ruhulbeyan: { titleAr: 'روح البيان', authorAr: 'إسماعيل حقي' },
  elmalili_orijinal: { titleAr: 'حق ديني قرآن ديلي', authorAr: 'محمد حمدي يازر' },
  elmalili_sadelestirilmis: { titleAr: 'حق ديني قرآن ديلي', authorAr: 'محمد حمدي يازر' },
  besairul_kuran: { titleAr: 'بصائر القرآن', authorAr: 'مؤلف معاصر' },
  ibn_kesir: { titleAr: 'تفسير ابن كثير', authorAr: 'ابن كثير' },
  fizilalil_kuran: { titleAr: 'في ظلال القرآن', authorAr: 'سيد قطب' },
  tefhimul_kuran: { titleAr: 'تفهيم القرآن', authorAr: 'أبو الأعلى المودودي' }
}

const LIBRARY_SOURCES = TAFSIR_SOURCES.filter((source) => source.id !== 'kuran23' && source.id !== 'diyanet')

export const LIBRARY_CONTENT = TEFSIRKUTUPHANESI_FATIHA_DATA?.content || {}

export const MEAL_BOOKS = [
  {
    id: 'meal-diyanet',
    category: 'meal',
    titleTr: 'Kurani Kerim ve Turkce Meali',
    titleAr: 'القرآن الكريم',
    authorTr: 'Diyanet Isleri Baskanligi',
    authorAr: 'رئاسة الشؤون الدينية',
    hasTrTranslation: true,
    description: 'Modern Turkce meal yaklasimi'
  },
  {
    id: 'meal-elmalili',
    category: 'meal',
    titleTr: 'Hak Dini Kuran Dili (Meal)',
    titleAr: 'حق ديني قرآن ديلي',
    authorTr: 'Elmalili Hamdi Yazir',
    authorAr: 'ألماليلي حمدي يازر',
    hasTrTranslation: true,
    description: 'Klasik Osmanli-Turkce dilin modern aktarimi'
  },
  {
    id: 'meal-uzlasimli',
    category: 'meal',
    titleTr: 'Karsilastirmali Turkce Mealler',
    titleAr: 'ترجمات تركية مقارنة',
    authorTr: 'Coklu meal seckisi',
    authorAr: 'اختيار متعدد',
    hasTrTranslation: true,
    description: 'Ayni ayet icin birden fazla meal okuma'
  }
]

export const TEFSIR_BOOKS = LIBRARY_SOURCES.map((source) => {
  const meta = TEFSIR_BOOK_META[source.id] || {}
  return {
    id: source.id,
    sourceId: source.id,
    category: 'tefsir',
    titleTr: source.tabLabel,
    titleAr: meta.titleAr || 'كتاب التفسير',
    authorTr: source.shortLabel,
    authorAr: meta.authorAr || 'مفسر',
    hasTrTranslation: true,
    description: 'TR ceviri ile okunabilir tefsir metni'
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
  if (typeof window === 'undefined') return [{ title: '1. Bolum', bodyHtml: formattedHtml }]

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="root">${formattedHtml}</div>`, 'text/html')
    const root = doc.querySelector('#root')
    if (!root) return [{ title: '1. Bolum', bodyHtml: formattedHtml }]

    const sections = []
    let current = null

    const pushCurrent = () => {
      if (!current) return
      const normalized = (current.bodyHtml || '').trim()
      if (!normalized) return
      sections.push({
        title: current.title || `${sections.length + 1}. Bolum`,
        bodyHtml: normalized
      })
    }

    Array.from(root.childNodes).forEach((node) => {
      const tagName = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : ''
      const isHeading = tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4'

      if (isHeading) {
        pushCurrent()
        current = {
          title: (node.textContent || '').trim() || `${sections.length + 1}. Bolum`,
          bodyHtml: ''
        }
        return
      }

      if (!current) {
        current = { title: '1. Bolum', bodyHtml: '' }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        current.bodyHtml += node.outerHTML
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        current.bodyHtml += `<p>${node.textContent.trim()}</p>`
      }
    })

    pushCurrent()
    return sections.length ? sections : [{ title: '1. Bolum', bodyHtml: formattedHtml }]
  } catch {
    return [{ title: '1. Bolum', bodyHtml: formattedHtml }]
  }
}

export function getSurahTitle(surahId) {
  const match = allSurahs.find((surah) => Number(surah.no) === Number(surahId))
  if (!match) return `Sure ${surahId}`
  return `${match.nameTr} (${match.no})`
}

