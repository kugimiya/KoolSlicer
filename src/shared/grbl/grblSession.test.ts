import { afterEach, describe, expect, it, vi } from 'vitest'
import { GrblSession, type GrblByteTransport } from './grblSession'

class FakeTransport implements GrblByteTransport {
  writes: string[] = []
  write(data: string): void {
    this.writes.push(data)
  }
}

describe('GrblSession', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls status and updates device state without logging the poll', () => {
    vi.useFakeTimers()
    const transport = new FakeTransport()
    const events: { type: string }[] = []
    const session = new GrblSession(transport, {
      onEvent: (event) => events.push(event)
    })

    vi.advanceTimersByTime(250)
    expect(transport.writes).toContain('?')

    session.pushRx('<Run|MPos:1.000,2.000,0.000|FS:0,0>\n')
    expect(session.snapshot().grblState).toBe('Run')
    expect(session.snapshot().mpos).toEqual({ x: 1, y: 2, z: 0 })
    expect(session.snapshot().logs.some((l) => l.text.startsWith('<Run'))).toBe(false)
    expect(events.some((e) => e.type === 'state')).toBe(true)
    session.dispose()
  })

  it('streams a job and reports acknowledged lines', () => {
    vi.useFakeTimers()
    const transport = new FakeTransport()
    const acks: number[] = []
    const session = new GrblSession(transport, {
      onEvent: (event) => {
        if (event.type === 'lineAck') acks.push(event.index)
      }
    })
    const started = session.startJob(['G21', 'M2'])
    expect(started).toEqual({ ok: true })
    expect(transport.writes).toContain('G21\n')

    session.pushRx('ok\n')
    expect(acks).toEqual([0])
    expect(session.snapshot().executingLine).toBe(0)

    session.pushRx('ok\n')
    expect(acks).toEqual([0, 1])
    expect(session.snapshot().job).toBe('completed')
    expect(session.snapshot().executingLine).toBe(1)
    session.dispose()
  })

  it('sends a manual line only while the job is idle', () => {
    vi.useFakeTimers()
    const transport = new FakeTransport()
    const session = new GrblSession(transport, {})
    expect(session.sendUserLine('$$')).toEqual({ ok: true })
    expect(transport.writes).toContain('$$\n')

    session.startJob(['G21', 'M2'])
    const denied = session.sendUserLine('G0 X0')
    expect(denied.ok).toBe(false)
    expect(transport.writes.filter((w) => w.startsWith('G0'))).toEqual([])
    session.dispose()
  })

  it('keeps a ring buffer of serial log lines', () => {
    vi.useFakeTimers()
    const transport = new FakeTransport()
    const session = new GrblSession(transport, { logLimit: 3 })
    session.pushRx('ok\n')
    session.pushRx('ok\n')
    session.pushRx('ok\n')
    session.pushRx('error:1\n')
    expect(session.snapshot().logs.map((l) => l.text)).toEqual(['ok', 'ok', 'error:1'])
    session.dispose()
  })

  it('homes, pauses, and aborts through the job runner', () => {
    vi.useFakeTimers()
    const transport = new FakeTransport()
    const session = new GrblSession(transport, {})
    expect(session.home()).toEqual({ ok: true })
    expect(transport.writes).toContain('$H\n')

    session.startJob(['G21', 'G90'])
    expect(session.pause()).toEqual({ ok: true })
    expect(transport.writes).toContain('!')
    expect(session.resume()).toEqual({ ok: true })
    expect(transport.writes).toContain('~')
    expect(session.abort()).toEqual({ ok: true })
    expect(transport.writes).toContain('\x18')
    expect(session.snapshot().job).toBe('aborted')
    session.dispose()
  })
})
