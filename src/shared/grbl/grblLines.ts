/** GRBL RX buffer is 128 bytes; keep lines safely under that including the newline. */
export const GRBL_MAX_LINE_LENGTH = 100

export function prepareGcodeLine(line: string): string | null {
  const withoutComment = line.replace(/;.*$/, '').trim()
  if (!withoutComment) return null
  if (withoutComment.length > GRBL_MAX_LINE_LENGTH) {
    throw new Error(`GRBL line exceeds ${GRBL_MAX_LINE_LENGTH} characters`)
  }
  return withoutComment
}

export function prepareGcodeLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const prepared = prepareGcodeLine(line)
    if (prepared) out.push(prepared)
  }
  return out
}
