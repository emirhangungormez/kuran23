const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/g
const DANGEROUS_CHAR_REGEX = /[<>`]/g
const MULTISPACE_REGEX = /\s+/g
const MAX_SEARCH_QUERY_LENGTH = 120

export function sanitizeSearchInput(value) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .replace(CONTROL_CHAR_REGEX, ' ')
    .replace(DANGEROUS_CHAR_REGEX, ' ')
    .replace(MULTISPACE_REGEX, ' ')
    .trim()

  return normalized.slice(0, MAX_SEARCH_QUERY_LENGTH)
}
