import { prepareGcodeLines } from './grblLines'
import type { GrblParsedLine } from './grblParse'
import { GRBL_CYCLE_START, GRBL_FEED_HOLD, GRBL_SOFT_RESET } from './grblRealtime'

export type JobPhase = 'idle' | 'running' | 'paused' | 'aborted' | 'completed'

export interface GrblByteTransport {
  write(data: string): void
}

export type GrblJobHandlers = {
  onLineAck?: (index: number) => void
  onStateChange?: (phase: JobPhase) => void
  onLog?: (direction: 'rx' | 'tx', text: string) => void
}

export class GrblJobRunner {
  phase: JobPhase = 'idle'
  private lines: string[] = []
  private index = 0
  private awaitingOk = false

  constructor(
    private readonly transport: GrblByteTransport,
    private readonly handlers: GrblJobHandlers
  ) {}

  start(lines: string[]): void {
    if (this.phase === 'running' || this.phase === 'paused') {
      throw new Error('Job is active')
    }
    this.lines = prepareGcodeLines(lines)
    this.index = 0
    this.awaitingOk = false
    if (this.lines.length === 0) {
      this.setPhase('completed')
      return
    }
    this.setPhase('running')
    this.sendCurrent()
  }

  pause(): void {
    if (this.phase !== 'running') return
    this.setPhase('paused')
    this.writeRaw(GRBL_FEED_HOLD)
  }

  resume(): void {
    if (this.phase !== 'paused') return
    this.setPhase('running')
    this.writeRaw(GRBL_CYCLE_START)
    if (!this.awaitingOk) this.advance()
  }

  abort(): void {
    if (this.phase !== 'running' && this.phase !== 'paused') return
    this.awaitingOk = false
    this.setPhase('aborted')
    this.writeRaw(GRBL_FEED_HOLD)
    this.writeRaw(GRBL_SOFT_RESET)
  }

  /** Sends `$H` when no job is streaming. */
  home(): boolean {
    if (this.phase === 'running' || this.phase === 'paused') return false
    this.writeLine('$H')
    return true
  }

  ingest(line: GrblParsedLine): void {
    if (line.type === 'status') return
    const text = line.type === 'ok' ? 'ok' : line.raw
    this.handlers.onLog?.('rx', text)
    if (line.type === 'ok') this.onOk()
    if (line.type === 'error' || line.type === 'alarm') this.onFault()
  }

  private onOk(): void {
    if (!this.awaitingOk) return
    if (this.phase !== 'running' && this.phase !== 'paused') return
    const acked = this.index
    this.awaitingOk = false
    this.index += 1
    this.handlers.onLineAck?.(acked)
    if (this.phase === 'paused') return
    this.advance()
  }

  private onFault(): void {
    if (this.phase !== 'running' && this.phase !== 'paused') return
    this.awaitingOk = false
    this.setPhase('aborted')
  }

  private advance(): void {
    if (this.index >= this.lines.length) {
      this.setPhase('completed')
      return
    }
    this.sendCurrent()
  }

  private sendCurrent(): void {
    const line = this.lines[this.index]
    if (line == null) return
    this.writeLine(line)
    this.awaitingOk = true
  }

  private writeLine(line: string): void {
    this.transport.write(`${line}\n`)
    this.handlers.onLog?.('tx', line)
  }

  private writeRaw(data: string): void {
    this.transport.write(data)
    this.handlers.onLog?.('tx', data === GRBL_SOFT_RESET ? 'soft-reset' : data)
  }

  private setPhase(phase: JobPhase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.handlers.onStateChange?.(phase)
  }
}
