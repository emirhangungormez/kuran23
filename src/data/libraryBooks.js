import { surahs as allSurahs } from './quranData'
import { TEFSIR_LIBRARY_BOOKS } from './tefsirLibraryCatalog'

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

export const TEFSIR_BOOKS = TEFSIR_LIBRARY_BOOKS.map((book) => ({
  id: book.sourceId,
  sourceId: book.sourceId,
  bookId: book.bookId,
  category: 'tefsir',
  titleTr: book.titleTr,
  titleAr: book.titleAr,
  authorTr: book.authorTr,
  authorAr: book.authorAr,
  hasTrTranslation: true,
  description: 'TR çeviri ile okunabilir tefsir metni'
}))

export const ALL_BOOKS = [...TEFSIR_BOOKS, ...MEAL_BOOKS]

export function getBookById(bookId) {
  return ALL_BOOKS.find((book) => book.id === bookId) || null
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
