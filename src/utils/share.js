function fallbackStripTags(text = '') {
    return String(text).replace(/<[^>]*>/g, ' ')
}

function collapseWhitespace(text = '') {
    return String(text).replace(/\s+/g, ' ').trim()
}

export function htmlToPlainText(value = '') {
    if (!value) return ''

    if (typeof window !== 'undefined' && window.document) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(String(value), 'text/html')
        return collapseWhitespace(doc.body.textContent || '')
    }

    return collapseWhitespace(fallbackStripTags(value))
}

export function getAppUrl(path = '/') {
    if (typeof window === 'undefined') return path
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${window.location.origin}${cleanPath}`
}

export function buildVerseShareText({
    surahName,
    ayahNo,
    arabicText,
    translationText,
    includeLink = true,
    path = '/'
}) {
    const header = `${surahName} Suresi, ${ayahNo}. Ayet`
    const lines = [header, '', htmlToPlainText(arabicText)]

    const meal = htmlToPlainText(translationText)
    if (meal) {
        lines.push('', meal)
    }

    if (includeLink) {
        lines.push('', getAppUrl(path))
    }

    return lines.join('\n').trim()
}

export function buildSurahShareText({
    surahName,
    surahNo,
    ayahCount,
    includeLink = true,
    path = '/'
}) {
    const lines = [
        `${surahName} Suresi (${surahNo})`,
        `${ayahCount} ayet`,
        '',
        'Kuran23'
    ]

    if (includeLink) {
        lines.push(getAppUrl(path))
    }

    return lines.join('\n').trim()
}

export async function copyToClipboard(text) {
    const value = String(text || '')
    if (!value) return false

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value)
            return true
        } catch (_e) {
            // Fallback below.
        }
    }

    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
        ok = document.execCommand('copy')
    } catch (_e) {
        ok = false
    }
    document.body.removeChild(ta)
    return ok
}

export function getXShareUrl(text, url) {
    const base = 'https://x.com/intent/tweet'
    const params = new URLSearchParams({
        text: text || '',
        url: url || ''
    })
    return `${base}?${params.toString()}`
}

export function getWhatsAppShareUrl(text, url) {
    const payload = [text, url].filter(Boolean).join('\n')
    return `https://wa.me/?text=${encodeURIComponent(payload)}`
}

export function getTelegramShareUrl(text, url) {
    const params = new URLSearchParams({
        text: text || '',
        url: url || ''
    })
    return `https://t.me/share/url?${params.toString()}`
}

export function openShareWindow(url) {
    if (typeof window === 'undefined') return
    window.open(url, '_blank', 'noopener,noreferrer')
}
