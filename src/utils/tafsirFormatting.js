import { normalizeTafsirText } from './textEncoding'

const ARABIC_SEGMENT_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u064B-\u065F\u0670\u06D6-\u06ED\s]{1,220}/g
const REFERENCE_REGEX = /\[[^[\]]{2,180}\]/g
const QUOTE_REGEX = /(["“”«»])([^"“”«»]{2,240})(["“”«»])/g
const LEAD_LINE_REGEX = /^([A-Za-zÇĞİÖŞÜçğıöşü0-9'’\-\s]{2,54}):\s+(.+)$/u
const NOTE_LINE_REGEX = /^(not|dipnot|dikkat|kaynak)\s*:/i

function looksLikeHeading(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (value.length > 110) return false
  if (/^\d{1,2}[\.\-:)]\s+/.test(value)) return true
  if (/(suresi|sûresi|tefsiri|tefsîri|giriş|mukaddime|bölüm|ayet)/i.test(value)) return true

  const letters = value.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '')
  if (letters.length < 6) return false
  const upper = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length
  return upper / letters.length > 0.72
}

function wrapTextPattern(doc, node, regex, className) {
  const text = node.nodeValue
  if (!text || !regex.test(text)) return
  regex.lastIndex = 0

  const fragment = doc.createDocumentFragment()
  let cursor = 0

  for (const match of text.matchAll(regex)) {
    const full = match[0]
    const idx = match.index ?? -1
    if (idx < 0) continue
    if (idx > cursor) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor, idx)))
    }

    const span = doc.createElement('span')
    span.className = className
    span.textContent = full
    fragment.appendChild(span)
    cursor = idx + full.length
  }

  if (cursor < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(cursor)))
  }

  node.parentNode?.replaceChild(fragment, node)
}

function processParagraph(doc, paragraph) {
  const rawText = paragraph.textContent?.replace(/\s+/g, ' ').trim() || ''
  if (!rawText) return

  if (looksLikeHeading(rawText) && !paragraph.querySelector('*')) {
    const h4 = doc.createElement('h4')
    h4.className = 'tafsir-auto-heading'
    h4.textContent = rawText
    paragraph.replaceWith(h4)
    return
  }

  if (NOTE_LINE_REGEX.test(rawText)) {
    paragraph.classList.add('tafsir-note')
  }

  const leadMatch = rawText.match(LEAD_LINE_REGEX)
  if (leadMatch && !paragraph.querySelector('*')) {
    const lead = doc.createElement('span')
    lead.className = 'tafsir-lead'
    lead.textContent = `${leadMatch[1]}:`
    paragraph.textContent = ''
    paragraph.appendChild(lead)
    paragraph.appendChild(doc.createTextNode(` ${leadMatch[2]}`))
  }
}

function isNumericHeading(text) {
  const value = normalizeTafsirText(text || '').replace(/\s+/g, ' ').trim()
  return /^\d+([\-–]\d+)?$/.test(value)
}

function transformUtilityHeadings(doc, root, options = {}) {
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4'))

  for (const heading of headings) {
    const rawText = normalizeTafsirText(heading.textContent || '').replace(/\s+/g, ' ').trim()
    if (!rawText) {
      heading.remove()
      continue
    }

    if (!isNumericHeading(rawText)) continue

    if (options.context === 'verse') {
      heading.remove()
      continue
    }

    const marker = doc.createElement('div')
    marker.className = 'tafsir-ayah-marker'
    marker.textContent = rawText
    heading.replaceWith(marker)
  }
}

function normalizeHeadingLabel(text, options = {}) {
  let value = normalizeTafsirText(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''

  value = value.replace(/^[\-–—:;,.()[\]\s]+/, '').replace(/[\-–—:;,.()[\]\s]+$/, '').trim()

  if (options.context === 'verse') {
    value = value
      .replace(/\b\d+\s*[.)-]?\s*ayet(\s*tefsiri)?\b/gi, '')
      .replace(/\bayet(\s*tefsiri)?\b/gi, '')
      .replace(/\bsure(si)?\b/gi, '')
      .replace(/\btefsir(i)?\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  value = value.replace(/^(\d+\s*[.)\-:])\s*/, '').trim()
  if (!value || /^\d+([\-–]\d+)?$/.test(value)) return ''
  return value
}

function applyHeadingNormalization(root, options = {}) {
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, .tafsir-auto-heading'))
  let order = 1

  for (const heading of headings) {
    const cleaned = normalizeHeadingLabel(heading.textContent || '', options)
    const label = cleaned || 'Bölüm'
    heading.textContent = `${order}. ${label}`
    heading.classList.add('tafsir-numbered-heading')
    heading.setAttribute('data-tafsir-order', String(order))
    order += 1
  }
}

function decorateTextNodes(doc, root) {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []

  while (walker.nextNode()) {
    const node = walker.currentNode
    const parentTag = node.parentElement?.tagName?.toLowerCase()
    if (!node.nodeValue?.trim()) continue
    if (parentTag === 'script' || parentTag === 'style') continue
    nodes.push(node)
  }

  for (const textNode of nodes) {
    wrapTextPattern(doc, textNode, REFERENCE_REGEX, 'tafsir-reference')
  }

  const secondPass = []
  const walker2 = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker2.nextNode()) {
    const node = walker2.currentNode
    if (node.nodeValue?.trim()) secondPass.push(node)
  }
  for (const textNode of secondPass) {
    wrapTextPattern(doc, textNode, QUOTE_REGEX, 'tafsir-quote')
  }

  const thirdPass = []
  const walker3 = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker3.nextNode()) {
    const node = walker3.currentNode
    if (node.nodeValue?.trim()) thirdPass.push(node)
  }
  for (const textNode of thirdPass) {
    wrapTextPattern(doc, textNode, ARABIC_SEGMENT_REGEX, 'tafsir-arabic')
  }
}

export function formatTafsirRichText(inputHtml, options = {}) {
  const normalized = normalizeTafsirText(inputHtml || '')
  if (!normalized || typeof window === 'undefined') return normalized

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="root">${normalized}</div>`, 'text/html')
    const root = doc.querySelector('#root')
    if (!root) return normalized

    root.querySelectorAll('p').forEach((paragraph) => processParagraph(doc, paragraph))
    transformUtilityHeadings(doc, root, options)
    decorateTextNodes(doc, root)
    applyHeadingNormalization(root, options)

    return root.innerHTML
  } catch {
    return normalized
  }
}
