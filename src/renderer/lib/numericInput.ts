/** Strip invalid characters; comma → decimal point; at most one `.` and leading `-`. */
export function sanitizeNumericText(raw: string): string {
  let s = raw.replace(/,/g, '.')
  s = s.replace(/[^\d.-]/g, '')
  const startsNegative = s.startsWith('-')
  s = s.replace(/-/g, '')
  if (startsNegative) s = `-${s}`
  const dot = s.indexOf('.')
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, '')}`
  }
  return s
}

/** Empty string → 0. */
export function parseNumericText(raw: string): number {
  const sanitized = sanitizeNumericText(raw.trim())
  if (!sanitized || sanitized === '-' || sanitized === '.') return 0
  const n = Number(sanitized)
  return Number.isFinite(n) ? n : 0
}

export function clampNumber(n: number, min?: number, max?: number): number {
  let x = n
  if (min !== undefined) x = Math.max(min, x)
  if (max !== undefined) x = Math.min(max, x)
  return x
}

export function formatNumericDisplay(n: number): string {
  if (!Number.isFinite(n)) return ''
  return String(n)
}
