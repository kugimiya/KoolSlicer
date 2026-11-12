import { describe, expect, it } from 'vitest'
import { GrblJobRunner, type GrblByteTransport } from './grblJobRunner'

class FakeTransport implements GrblByteTransport {
  writes: string[] = []
  write(data: string): void {
    this.writes.push(data)
  }
}

function setup(lines: string[]) {
  const transport = new FakeTransport()
  const acks: number[] = []
  const phases: string[] = []
  const logs: { direction: string; text: string }[] = []
  const runner = new GrblJobRunner(transport, {
    onLineAck: (index) => acks.push(index),
    onStateChange: (phase) => phases.push(phase),
    onLog: (direction, text) => logs.push({ direction, text })
  })
  runner.start(lines)
  return { transport, runner, acks, phases, logs }
}

describe('GrblJobRunner', () => {
  it('streams one line at a time and completes after the last ok', () => {
    const { transport, runner, acks, phases } = setup(['G21', 'G90', 'M2'])
    expect(transport.writes).toEqual(['G21\n'])
    expect(phases.at(-1)).toBe('running')

    runner.ingest({ type: 'ok' })
    expect(acks).toEqual([0])
    expect(transport.writes).toEqual(['G21\n', 'G90\n'])

    runner.ingest({ type: 'ok' })
    expect(acks).toEqual([0, 1])
    expect(transport.writes).toEqual(['G21\n', 'G90\n', 'M2\n'])

    runner.ingest({ type: 'ok' })
    expect(acks).toEqual([0, 1, 2])
    expect(runner.phase).toBe('completed')
    expect(phases.at(-1)).toBe('completed')
  })

  it('stops the queue on error or alarm', () => {
    const errorRun = setup(['G21', 'G90'])
    errorRun.runner.ingest({ type: 'error', code: 20, raw: 'error:20' })
    expect(errorRun.runner.phase).toBe('aborted')
    expect(errorRun.acks).toEqual([])
    errorRun.runner.ingest({ type: 'ok' })
    expect(errorRun.transport.writes).toEqual(['G21\n'])

    const alarmRun = setup(['G21', 'G90'])
    alarmRun.runner.ingest({ type: 'alarm', code: 1, raw: 'ALARM:1' })
    expect(alarmRun.runner.phase).toBe('aborted')
    expect(alarmRun.transport.writes).toEqual(['G21\n'])
  })

  it('holds the queue on pause until resume', () => {
    const { transport, runner, acks } = setup(['G21', 'G90', 'M2'])
    runner.pause()
    expect(transport.writes).toEqual(['G21\n', '!'])

    runner.ingest({ type: 'ok' })
    expect(acks).toEqual([0])
    expect(transport.writes.filter((w) => w.startsWith('G') || w.startsWith('M'))).toEqual(['G21\n'])

    runner.resume()
    expect(transport.writes).toContain('~')
    expect(transport.writes.at(-1)).toBe('G90\n')
    expect(runner.phase).toBe('running')
  })

  it('aborts with feed hold then soft reset and ignores later ok', () => {
    const { transport, runner, acks } = setup(['G21', 'G90'])
    runner.abort()
    expect(runner.phase).toBe('aborted')
    expect(transport.writes).toEqual(['G21\n', '!', '\x18'])
    runner.ingest({ type: 'ok' })
    expect(acks).toEqual([])
    expect(transport.writes).toEqual(['G21\n', '!', '\x18'])
  })

  it('logs transmitted lines', () => {
    const { logs, runner } = setup(['G0 X0'])
    expect(logs).toContainEqual({ direction: 'tx', text: 'G0 X0' })
    runner.ingest({ type: 'ok' })
    expect(logs).toContainEqual({ direction: 'rx', text: 'ok' })
  })

  it('sends $H only while idle', () => {
    const transport = new FakeTransport()
    const runner = new GrblJobRunner(transport, {})
    expect(runner.home()).toBe(true)
    expect(transport.writes).toEqual(['$H\n'])

    const busy = setup(['G21'])
    expect(busy.runner.home()).toBe(false)
    expect(busy.transport.writes).toEqual(['G21\n'])
  })

  it('strips comments before sending', () => {
    const { transport } = setup(['G21 ; mm', '', '; skip'])
    expect(transport.writes).toEqual(['G21\n'])
  })
})
