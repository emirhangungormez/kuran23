import { TEFSIRKUTUPHANESI_FATIHA_DATA } from './tefsirkutuphanesiFatihaData.js'

const CORE_TAFSIR_SOURCES = [
  {
    id: 'kuran23',
    shortLabel: 'Kuran23',
    tabLabel: 'Kuran23 Tefsiri',
    sourceLabel: 'Kuran23 Tefsiri'
  },
  {
    id: 'diyanet',
    shortLabel: 'Diyanet',
    tabLabel: 'Diyanet Tefsiri',
    sourceLabel: "Diyanet İşleri Başkanlığı - Kur'an Yolu"
  }
]

const KUTUPHANE_LABEL_OVERRIDES = {
  celaleyn: {
    shortLabel: 'Celâleyn',
    tabLabel: 'Celâleyn Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Celâleyn Tefsiri (Kitap 01)'
  },
  beydavi: {
    shortLabel: 'Beydâvî',
    tabLabel: 'Beydâvî Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Beydâvî Tefsiri (Kitap 02)'
  },
  nesefi: {
    shortLabel: 'Nesefî',
    tabLabel: 'Nesefî Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Nesefî Tefsiri (Kitap 03)'
  },
  kurtubi: {
    shortLabel: 'Kurtubî',
    tabLabel: 'Kurtubî Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Kurtubî Tefsiri (Kitap 04)'
  },
  ibn_cevzi: {
    shortLabel: 'İbnü’l-Cevzî',
    tabLabel: 'Zâdü’l-Mesîr (İbnü’l-Cevzî)',
    sourceLabel: 'Tefsir Kütüphanesi - Zâdü’l-Mesîr (İbnü’l-Cevzî, Kitap 05)'
  },
  suyuti_durrul_mensur: {
    shortLabel: 'Süyûtî',
    tabLabel: 'ed-Dürrü’l-Mensûr (Süyûtî)',
    sourceLabel: 'Tefsir Kütüphanesi - ed-Dürrü’l-Mensûr (Süyûtî, Kitap 06)'
  },
  ebussuud: {
    shortLabel: 'Ebussuûd',
    tabLabel: 'Ebussuûd Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Ebussuûd Tefsiri (Kitap 07)'
  },
  razi: {
    shortLabel: 'Râzî',
    tabLabel: 'Tefsîr-i Kebîr (Râzî)',
    sourceLabel: 'Tefsir Kütüphanesi - Tefsîr-i Kebîr (Râzî, Kitap 08)'
  },
  taberi: {
    shortLabel: 'Taberî',
    tabLabel: 'Taberî Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Taberî Tefsiri (Kitap 10)'
  },
  ruhulbeyan: {
    shortLabel: 'Rûhu’l-Beyân',
    tabLabel: 'Rûhu’l-Beyân Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Rûhu’l-Beyân Tefsiri (Kitap 11)'
  },
  elmalili_orijinal: {
    shortLabel: 'Elmalılı (Orijinal)',
    tabLabel: 'Elmalılı Tefsiri (Orijinal)',
    sourceLabel: 'Tefsir Kütüphanesi - Elmalılı Tefsiri (Kitap 12)'
  },
  elmalili_sadelestirilmis: {
    shortLabel: 'Elmalılı (Sade)',
    tabLabel: 'Elmalılı Tefsiri (Sadeleştirilmiş)',
    sourceLabel: 'Tefsir Kütüphanesi - Elmalılı Tefsiri (Sadeleştirilmiş, Kitap 13)'
  },
  besairul_kuran: {
    shortLabel: 'Beşâirü’l-Kur’ân',
    tabLabel: 'Beşâirü’l-Kur’ân',
    sourceLabel: 'Tefsir Kütüphanesi - Beşâirü’l-Kur’ân (Kitap 14)'
  },
  ibn_kesir: {
    shortLabel: 'İbn Kesîr',
    tabLabel: 'İbn Kesîr Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - İbn Kesîr Tefsiri (Kitap 15)'
  },
  fizilalil_kuran: {
    shortLabel: 'Fî Zılâl',
    tabLabel: 'Seyyid Kutub - Fî Zılâli’l-Kur’ân',
    sourceLabel: 'Tefsir Kütüphanesi - Seyyid Kutub, Fî Zılâli’l-Kur’ân (Kitap 16)'
  },
  tefhimul_kuran: {
    shortLabel: 'Tefhîm',
    tabLabel: 'Tefhîmu’l-Kur’ân - Mevdûdî',
    sourceLabel: 'Tefsir Kütüphanesi - Tefhîmu’l-Kur’ân (Mevdûdî, Kitap 17)'
  }
}

const KUTUPHANE_SOURCES = (TEFSIRKUTUPHANESI_FATIHA_DATA?.sources || []).map((source) => ({
  id: source.id,
  shortLabel: KUTUPHANE_LABEL_OVERRIDES[source.id]?.shortLabel || source.shortLabel,
  tabLabel: KUTUPHANE_LABEL_OVERRIDES[source.id]?.tabLabel || source.tabLabel,
  sourceLabel: KUTUPHANE_LABEL_OVERRIDES[source.id]?.sourceLabel || source.sourceLabel,
  bookId: source.bookId || ''
}))

export const TAFSIR_SOURCES = [...CORE_TAFSIR_SOURCES, ...KUTUPHANE_SOURCES]

export const TAFSIR_SOURCE_MAP = Object.fromEntries(
  TAFSIR_SOURCES.map((source) => [source.id, source])
)

const MANUAL_SOURCE_TAFSIR = TEFSIRKUTUPHANESI_FATIHA_DATA?.content || {}

export function getManualSurahSourceTafsir(sourceId, surahId) {
  const sid = Number(surahId)
  return MANUAL_SOURCE_TAFSIR[sourceId]?.surah?.[sid] || ''
}

export function getManualVerseSourceTafsir(sourceId, surahId, ayahNo) {
  const sid = Number(surahId)
  const ayah = Number(ayahNo)
  return MANUAL_SOURCE_TAFSIR[sourceId]?.verse?.[`${sid}:${ayah}`] || ''
}

export function extractSourceSpecificTafsir() {
  return ''
}
