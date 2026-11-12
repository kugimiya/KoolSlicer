export type PlannedMove = {
  duration: number
  gcodeLineStart?: number
  gcodeLineEnd?: number
}

export type JobProgress = {
  executedLines: number
  totalLines: number
  percent: number
  elapsedSec: number
  /** Remaining seconds after pace correction. Null when there is nothing to estimate yet. */
  estimatedRemainingSec: number | null
}

/** Split each move's planned duration evenly across the G-code lines that move emitted. */
export function plannedSecondsByLine(lineCount: number, moves: PlannedMove[]): number[] {
  const planned = Array.from({ length: Math.max(0, lineCount) }, () => 0)
  for (const move of moves) {
    const start = move.gcodeLineStart
    const end = move.gcodeLineEnd
    if (start == null || end == null || end < start) continue
    const span = end - start + 1
    const each = move.duration / span
    for (let i = start; i <= end && i < planned.length; i++) {
      if (i >= 0) planned[i] += each
    }
  }
  return planned
}

export function jobProgress(input: {
  totalLines: number
  ackedLine: number
  elapsedSec: number
  plannedLineSec?: number[]
}): JobProgress {
  const totalLines = Math.max(0, input.totalLines)
  const executedLines =
    input.ackedLine < 0 ? 0 : Math.min(totalLines, Math.floor(input.ackedLine) + 1)
  const elapsedSec = Math.max(0, input.elapsedSec)
  const percent = totalLines === 0 ? 0 : (executedLines / totalLines) * 100
  return {
    executedLines,
    totalLines,
    percent,
    elapsedSec,
    estimatedRemainingSec: estimateRemaining(executedLines, totalLines, elapsedSec, input.plannedLineSec)
  }
}

function estimateRemaining(
  executed: number,
  total: number,
  elapsedSec: number,
  plannedLineSec: number[] | undefined
): number | null {
  if (total === 0) return 0
  if (executed >= total) return 0
  const planned = plannedLineSec ?? []
  const plannedDone = sum(planned, 0, executed)
  const plannedLeft = sum(planned, executed, total)
  if (plannedDone > 0) return (elapsedSec / plannedDone) * plannedLeft
  if (plannedLeft > 0) return plannedLeft
  if (executed === 0) return null
  return (elapsedSec / executed) * (total - executed)
}

function sum(values: number[], from: number, to: number): number {
  let acc = 0
  const end = Math.min(to, values.length)
  for (let i = Math.max(0, from); i < end; i++) acc += values[i] ?? 0
  return acc
}

export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0')
  const ss = String(secs).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${minutes}:${ss}`
}
