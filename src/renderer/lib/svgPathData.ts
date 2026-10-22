import type { Point } from '@shared/types'
import { polygonArea } from './geometry'

const NUM = /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g

type PathCmd = { cmd: string; args: number[] }

function tokenizePath(d: string): PathCmd[] {
  const cmds: PathCmd[] = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    const args: number[] = []
    const chunk = m[2]
    let nm: RegExpExecArray | null
    const numRe = new RegExp(NUM.source, 'g')
    while ((nm = numRe.exec(chunk)) !== null) {
      args.push(parseFloat(nm[0]))
    }
    cmds.push({ cmd: m[1], args })
  }
  return cmds
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Flatten SVG path `d` to closed/open subpaths (не склеивает M…Z M…Z в один контур). */
export function flattenSvgPathContours(d: string, curveTolerance = 0.05): Point[][] {
  const cmds = tokenizePath(d.trim())
  const contours: Point[][] = []
  let out: Point[] = []
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0

  const flushContour = (): void => {
    if (out.length >= 2) contours.push(out)
    out = []
  }

  const lineTo = (x: number, y: number): void => {
    out.push({ x, y })
    cx = x
    cy = y
  }

  for (const { cmd, args } of cmds) {
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()

    if (C === 'M') {
      let i = 0
      while (i < args.length) {
        const x = rel ? cx + args[i] : args[i]
        const y = rel ? cy + args[i + 1] : args[i + 1]
        if (i === 0) {
          if (out.length > 0) flushContour()
          sx = x
          sy = y
          lineTo(x, y)
        } else {
          lineTo(x, y)
        }
        i += 2
      }
    } else if (C === 'L') {
      let i = 0
      while (i < args.length) {
        const x = rel ? cx + args[i] : args[i]
        const y = rel ? cy + args[i + 1] : args[i + 1]
        lineTo(x, y)
        i += 2
      }
    } else if (C === 'H') {
      for (const a of args) {
        const x = rel ? cx + a : a
        lineTo(x, cy)
      }
    } else if (C === 'V') {
      for (const a of args) {
        const y = rel ? cy + a : a
        lineTo(cx, y)
      }
    } else if (C === 'Z') {
      if (out.length > 0 && (cx !== sx || cy !== sy)) lineTo(sx, sy)
    } else if (C === 'C') {
      let i = 0
      while (i + 5 < args.length) {
        const x1 = rel ? cx + args[i] : args[i]
        const y1 = rel ? cy + args[i + 1] : args[i + 1]
        const x2 = rel ? cx + args[i + 2] : args[i + 2]
        const y2 = rel ? cy + args[i + 3] : args[i + 3]
        const x = rel ? cx + args[i + 4] : args[i + 4]
        const y = rel ? cy + args[i + 5] : args[i + 5]
        const steps = Math.max(4, Math.ceil(1 / curveTolerance))
        for (let t = 1; t <= steps; t++) {
          const u = t / steps
          const omt = 1 - u
          const px =
            omt * omt * omt * cx +
            3 * omt * omt * u * x1 +
            3 * omt * u * u * x2 +
            u * u * u * x
          const py =
            omt * omt * omt * cy +
            3 * omt * omt * u * y1 +
            3 * omt * u * u * y2 +
            u * u * u * y
          lineTo(px, py)
        }
        i += 6
      }
    } else if (C === 'A') {
      let i = 0
      while (i + 6 < args.length) {
        const x = rel ? cx + args[i + 5] : args[i + 5]
        const y = rel ? cy + args[i + 6] : args[i + 6]
        const steps = 12
        for (let t = 1; t <= steps; t++) {
          lineTo(lerp(cx, x, t / steps), lerp(cy, y, t / steps))
        }
        i += 7
      }
    } else if (C === 'S' || C === 'Q' || C === 'T') {
      let i = 0
      const n = C === 'Q' || C === 'T' ? 2 : 4
      while (i + n - 1 < args.length) {
        const x = rel ? cx + args[i + n - 2] : args[i + n - 2]
        const y = rel ? cy + args[i + n - 1] : args[i + n - 1]
        lineTo(x, y)
        i += n
      }
    }
  }

  flushContour()
  return contours
}

/** Один контур: при нескольких subpath — самый большой по площади. */
export function flattenSvgPath(d: string, curveTolerance = 0.05): Point[] {
  const contours = flattenSvgPathContours(d, curveTolerance)
  if (contours.length === 0) return []
  if (contours.length === 1) return contours[0]
  return contours.reduce((best, cur) =>
    polygonArea(cur) >= polygonArea(best) ? cur : best
  )
}

export function isClosedPath(d: string): boolean {
  return /[zZ]\s*$/.test(d.trim()) || /\s[zZ]\s/.test(d)
}
