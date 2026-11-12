export type GrblPoint = { x: number; y: number; z: number }

export type GrblParsedLine =
  | { type: 'ok' }
  | { type: 'error'; code: number; raw: string }
  | { type: 'alarm'; code: number; raw: string }
  | { type: 'welcome'; raw: string }
  | {
      type: 'status'
      state: string
      mpos?: GrblPoint
      wpos?: GrblPoint
      raw: string
    }
  | { type: 'message'; raw: string }

function parsePoint(body: string): GrblPoint | undefined {
  const parts = body.split(',').map((n) => Number(n))
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return undefined
  return { x: parts[0], y: parts[1], z: parts[2] }
}

export function parseGrblLine(rawLine: string): GrblParsedLine {
  const raw = rawLine.replace(/\r$/, '').trim()
  if (raw === 'ok') return { type: 'ok' }

  const error = /^error:(\d+)$/i.exec(raw)
  if (error) return { type: 'error', code: Number(error[1]), raw }

  const alarm = /^ALARM:(\d+)$/i.exec(raw)
  if (alarm) return { type: 'alarm', code: Number(alarm[1]), raw }

  if (/^Grbl\s/i.test(raw)) return { type: 'welcome', raw }

  if (raw.startsWith('<') && raw.endsWith('>')) {
    const inner = raw.slice(1, -1)
    const fields = inner.split('|')
    const state = fields[0] ?? ''
    let mpos: GrblPoint | undefined
    let wpos: GrblPoint | undefined
    for (const field of fields.slice(1)) {
      if (field.startsWith('MPos:')) mpos = parsePoint(field.slice(5))
      if (field.startsWith('WPos:')) wpos = parsePoint(field.slice(5))
    }
    const status: Extract<GrblParsedLine, { type: 'status' }> = { type: 'status', state, raw }
    if (mpos) status.mpos = mpos
    if (wpos) status.wpos = wpos
    return status
  }

  return { type: 'message', raw }
}

/** Accumulates serial chunks and emits complete GRBL lines. */
export class GrblRxBuffer {
  private pending = ''

  push(chunk: string): GrblParsedLine[] {
    this.pending += chunk
    const parts = this.pending.split('\n')
    this.pending = parts.pop() ?? ''
    const out: GrblParsedLine[] = []
    for (const part of parts) {
      const trimmed = part.replace(/\r$/, '').trim()
      if (!trimmed) continue
      out.push(parseGrblLine(trimmed))
    }
    return out
  }
}
