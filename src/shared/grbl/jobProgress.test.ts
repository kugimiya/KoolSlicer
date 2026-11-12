import { describe, expect, it } from 'vitest'
import { formatDuration, jobProgress, plannedSecondsByLine } from './jobProgress'

describe('plannedSecondsByLine', () => {
  it('spreads each move duration across the gcode lines it owns', () => {
    const planned = plannedSecondsByLine(6, [
      { duration: 4, gcodeLineStart: 2, gcodeLineEnd: 3 },
      { duration: 1, gcodeLineStart: 4, gcodeLineEnd: 4 }
    ])
    expect(planned).toEqual([0, 0, 2, 2, 1, 0])
  })
})

describe('jobProgress', () => {
  const plan = [0, 0, 2, 2]

  it('uses the full plan before any line is acknowledged', () => {
    const progress = jobProgress({ totalLines: 4, ackedLine: -1, elapsedSec: 0, plannedLineSec: plan })
    expect(progress.executedLines).toBe(0)
    expect(progress.percent).toBe(0)
    expect(progress.estimatedRemainingSec).toBe(4)
  })

  it('keeps the plan until a timed line has actually finished', () => {
    const progress = jobProgress({ totalLines: 4, ackedLine: 1, elapsedSec: 0.4, plannedLineSec: plan })
    expect(progress.executedLines).toBe(2)
    expect(progress.percent).toBe(50)
    expect(progress.estimatedRemainingSec).toBe(4)
  })

  it('scales the remaining plan by actual pace', () => {
    const progress = jobProgress({ totalLines: 4, ackedLine: 2, elapsedSec: 4, plannedLineSec: plan })
    expect(progress.executedLines).toBe(3)
    expect(progress.percent).toBe(75)
    expect(progress.estimatedRemainingSec).toBe(4)
  })

  it('falls back to the mean line time when there is no plan', () => {
    const progress = jobProgress({ totalLines: 4, ackedLine: 1, elapsedSec: 10, plannedLineSec: [0, 0, 0, 0] })
    expect(progress.estimatedRemainingSec).toBe(10)
  })

  it('reports a finished job as complete', () => {
    const progress = jobProgress({ totalLines: 4, ackedLine: 3, elapsedSec: 9, plannedLineSec: plan })
    expect(progress.percent).toBe(100)
    expect(progress.executedLines).toBe(4)
    expect(progress.estimatedRemainingSec).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})
