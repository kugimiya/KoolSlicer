import type { GcodeResult, LaserSettings, Move } from '@shared/types'

function fmt(n: number): string {
  return n.toFixed(3)
}

export function movesToGcode(moves: Move[], settings: LaserSettings): GcodeResult {
  const lines: string[] = ['G21', 'G90', 'G94', 'M5']
  let laserOn = false
  let lastPower: number | null = null
  let needFeed = true

  for (const move of moves) {
    const lineStart = lines.length

    if (move.type === 'rapid') {
      if (laserOn) {
        lines.push('M5')
        laserOn = false
        lastPower = null
        needFeed = true
      }
      lines.push(`G0 X${fmt(move.to.x)} Y${fmt(move.to.y)}`)
    } else {
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
    }

    move.gcodeLineStart = lineStart
    move.gcodeLineEnd = lines.length - 1
  }

  if (laserOn) lines.push('M5')
  lines.push('G0 X0.000 Y0.000', 'M2')

  return { text: lines.join('\n'), lines }
}
