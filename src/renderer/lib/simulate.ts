import type { Move, Point } from '@shared/types'
import { distance } from './geometry'

export type SimulationTimeline = {
  moves: Move[]
  prefixDuration: number[]
  prefixCutLength: number[]
  prefixTravelLength: number[]
  totalTime: number
  totalCutLength: number
  totalTravelLength: number
}

export function buildTimeline(moves: Move[]): SimulationTimeline {
  const prefixDuration: number[] = []
  const prefixCutLength: number[] = []
  const prefixTravelLength: number[] = []
  let acc = 0
  let cutLen = 0
  let travelLen = 0
  for (const m of moves) {
    prefixDuration.push(acc)
    prefixCutLength.push(cutLen)
    prefixTravelLength.push(travelLen)
    const segLen = distance(m.from, m.to)
    travelLen += segLen
    if (m.type === 'cut') cutLen += segLen
    acc += m.duration
  }
  return {
    moves,
    prefixDuration,
    prefixCutLength,
    prefixTravelLength,
    totalTime: acc,
    totalCutLength: cutLen,
    totalTravelLength: travelLen
  }
}

export function segmentIndexAtTime(timeline: SimulationTimeline, t: number): number {
  const { moves, prefixDuration, totalTime } = timeline
  if (moves.length === 0) return -1
  const clamped = Math.max(0, Math.min(t, totalTime))
  let lo = 0
  let hi = moves.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (prefixDuration[mid] <= clamped) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function positionAtTime(timeline: SimulationTimeline, t: number): Point {
  const idx = segmentIndexAtTime(timeline, t)
  if (idx < 0) return { x: 0, y: 0 }
  const move = timeline.moves[idx]
  const startT = timeline.prefixDuration[idx]
  const segDur = move.duration || 1e-9
  const u = Math.max(0, Math.min(1, (t - startT) / segDur))
  return {
    x: move.from.x + (move.to.x - move.from.x) * u,
    y: move.from.y + (move.to.y - move.from.y) * u
  }
}

export function gcodeLineAtTime(timeline: SimulationTimeline, t: number): number {
  const idx = segmentIndexAtTime(timeline, t)
  if (idx < 0) return 0
  return timeline.moves[idx].gcodeLineStart ?? 0
}

export function moveProgress(timeline: SimulationTimeline, t: number): number {
  if (timeline.totalTime <= 0) return 0
  return (t / timeline.totalTime) * 100
}

/** Доля текущего сегмента [0..1] на момент t. */
export function segmentProgressAtTime(timeline: SimulationTimeline, t: number): number {
  const idx = segmentIndexAtTime(timeline, t)
  if (idx < 0) return 0
  const move = timeline.moves[idx]
  const startT = timeline.prefixDuration[idx]
  const segDur = move.duration || 1e-9
  return Math.max(0, Math.min(1, (t - startT) / segDur))
}

export function totalCutLength(moves: Move[]): number {
  return moves.filter((m) => m.type === 'cut').reduce((s, m) => s + distance(m.from, m.to), 0)
}

/** Накопленная длина хода и резки на момент t (мм). */
export function travelLengthsAtTime(
  timeline: SimulationTimeline,
  t: number
): { cutMm: number; travelMm: number } {
  const { moves, totalTime } = timeline
  if (moves.length === 0) return { cutMm: 0, travelMm: 0 }
  const clamped = Math.max(0, Math.min(t, totalTime))
  const idx = segmentIndexAtTime(timeline, clamped)
  if (idx < 0) return { cutMm: 0, travelMm: 0 }
  const move = moves[idx]
  const segLen = distance(move.from, move.to)
  const partial = segLen * segmentProgressAtTime(timeline, clamped)
  return {
    cutMm: timeline.prefixCutLength[idx] + (move.type === 'cut' ? partial : 0),
    travelMm: timeline.prefixTravelLength[idx] + partial
  }
}
