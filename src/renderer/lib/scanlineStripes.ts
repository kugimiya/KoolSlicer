export type ScanSegment = {
  lineIndex: number
  y: number
  x0: number
  x1: number
}

export function overlapAmountX(a: ScanSegment, b: ScanSegment): number {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
}

/** Связь только между соседними scan-строками одной вертикальной «колонки». */
export function segmentsLinkVertically(a: ScanSegment, b: ScanSegment, stepMm: number): boolean {
  const ov = overlapAmountX(a, b)
  if (ov > stepMm * 0.2) return true
  const wa = a.x1 - a.x0
  const wb = b.x1 - b.x0
  const minW = Math.min(wa, wb)
  if (ov > minW * 0.35) return true
  const ca = (a.x0 + a.x1) / 2
  const cb = (b.x0 + b.x1) / 2
  return Math.abs(ca - cb) <= stepMm * 0.75 && minW <= stepMm * 4
}

/**
 * ID вертикальной колонки: сопоставление 1:1 между соседними непустыми строками.
 * Union-find давал одну «полосу» на U-заливку → на одной Y резали все островки подряд (40 mm rapids).
 */
export function assignScanColumnIds(segments: ScanSegment[], stepMm: number): number[] {
  const n = segments.length
  const columnId = new Array<number>(n).fill(-1)
  if (n === 0) return columnId

  const byLine = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const list = byLine.get(segments[i].lineIndex) ?? []
    list.push(i)
    byLine.set(segments[i].lineIndex, list)
  }

  const lineIndices = [...byLine.keys()].sort((a, b) => a - b)
  let nextColumn = 0

  for (const i of byLine.get(lineIndices[0])!) {
    columnId[i] = nextColumn++
  }

  for (let k = 1; k < lineIndices.length; k++) {
    const prevIdxs = byLine.get(lineIndices[k - 1])!
    const curIdxs = byLine.get(lineIndices[k])!
    const usedCur = new Set<number>()
    const usedPrev = new Set<number>()

    type Pair = { pi: number; ci: number; score: number }
    const pairs: Pair[] = []
    for (const pi of prevIdxs) {
      for (const ci of curIdxs) {
        if (segmentsLinkVertically(segments[pi], segments[ci], stepMm)) {
          pairs.push({ pi, ci, score: overlapAmountX(segments[pi], segments[ci]) })
        }
      }
    }
    pairs.sort((a, b) => b.score - a.score)

    for (const { pi, ci } of pairs) {
      if (usedPrev.has(pi) || usedCur.has(ci)) continue
      usedPrev.add(pi)
      usedCur.add(ci)
      columnId[ci] = columnId[pi]
    }
    for (const ci of curIdxs) {
      if (!usedCur.has(ci)) columnId[ci] = nextColumn++
    }
  }

  return columnId
}

/** @deprecated имя поля scanStripe; логика — assignScanColumnIds */
export function assignScanStripeIds(segments: ScanSegment[], stepMm: number): number[] {
  return assignScanColumnIds(segments, stepMm)
}
