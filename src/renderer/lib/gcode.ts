import type { GcodeResult, LaserSettings, Move } from '@shared/types'

function fmt(n: number): string {
  return n.toFixed(3)
}

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9
}

export function movesToGcode(moves: Move[], settings: LaserSettings): GcodeResult {
  const lines: string[] = ['G21', 'G90', 'G94', 'M5', 'G28 X0 Y0']
  let laserOn = false
  let lastPower: number | null = null
  let needFeed = true
  let pos = { x: 0, y: 0 }

  const emitRapid = (to: { x: number; y: number }): void => {
    if (samePoint(pos, to)) return
    if (laserOn) {
      lines.push('M5')
      laserOn = false
      lastPower = null
      needFeed = true
    }
    lines.push(`G0 X${fmt(to.x)} Y${fmt(to.y)}`)
    pos = { x: to.x, y: to.y }
  }

  for (const move of moves) {
    const lineStart = lines.length

    if (move.type === 'rapid') {
      emitRapid(move.to)
    } else {
      emitRapid(move.from)
      const power = move.power ?? settings.power
      if (!laserOn || lastPower !== power) {
        lines.push(`${settings.laserMode} S${Math.round(power)}`)
        laserOn = true
        lastPower = power
        needFeed = true
      }
      if (needFeed) {
        lines.push(`G1 X${fmt(move.to.x)} Y${fmt(move.to.y)} F${Math.round(move.feed)}`)
        needFeed = false
      } else {
        lines.push(`G1 X${fmt(move.to.x)} Y${fmt(move.to.y)}`)
      }
      pos = { x: move.to.x, y: move.to.y }
    }

    move.gcodeLineStart = lineStart
    move.gcodeLineEnd = lines.length - 1
  }

  if (laserOn) lines.push('M5')
  lines.push('G0 X0.000 Y0.000', 'M2')

  return { text: lines.join('\n'), lines }
}
