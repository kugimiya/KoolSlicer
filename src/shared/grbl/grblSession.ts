import { prepareGcodeLine } from './grblLines'
import { GrblRxBuffer, type GrblPoint } from './grblParse'
import { GrblJobRunner, type GrblByteTransport, type JobPhase } from './grblJobRunner'
import { GRBL_STATUS_QUERY } from './grblRealtime'

export type { GrblByteTransport }

export type GrblLogEntry = { direction: 'rx' | 'tx'; text: string }

export type GrblSnapshot = {
  connection: 'connected'
  job: JobPhase
  grblState?: string
  mpos?: GrblPoint
  wpos?: GrblPoint
  executingLine: number
  logs: GrblLogEntry[]
}

export type GrblEvent =
  | { type: 'log'; direction: 'rx' | 'tx'; text: string }
  | {
      type: 'state'
      connection: 'connected' | 'disconnected'
      job: JobPhase
      grblState?: string
      mpos?: GrblPoint
      wpos?: GrblPoint
      executingLine: number
    }
  | { type: 'lineAck'; index: number }

export type GrblCommandResult = { ok: true } | { ok: false; error: string }

const DEFAULT_POLL_MS = 250
const DEFAULT_LOG_LIMIT = 500

export class GrblSession {
  private readonly runner: GrblJobRunner
  private readonly rx = new GrblRxBuffer()
  private readonly logs: GrblLogEntry[] = []
  private readonly timer: ReturnType<typeof setInterval>
  private grblState: string | undefined
  private mpos: GrblPoint | undefined
  private wpos: GrblPoint | undefined
  private executingLine = -1
  private manualPending = false

  constructor(
    private readonly transport: GrblByteTransport,
    private readonly options: {
      onEvent?: (event: GrblEvent) => void
      pollIntervalMs?: number
      logLimit?: number
    } = {}
  ) {
    this.runner = new GrblJobRunner(transport, {
      onLineAck: (index) => {
        this.executingLine = index
        this.options.onEvent?.({ type: 'lineAck', index })
        this.emitState()
      },
      onStateChange: () => this.emitState(),
      onLog: (direction, text) => this.pushLog(direction, text)
    })
    this.timer = setInterval(() => {
      this.transport.write(GRBL_STATUS_QUERY)
    }, options.pollIntervalMs ?? DEFAULT_POLL_MS)
  }

  snapshot(): GrblSnapshot {
    return {
      connection: 'connected',
      job: this.runner.phase,
      grblState: this.grblState,
      mpos: this.mpos,
      wpos: this.wpos,
      executingLine: this.executingLine,
      logs: [...this.logs]
    }
  }

  startJob(lines: string[]): GrblCommandResult {
    if (this.runner.phase === 'running' || this.runner.phase === 'paused') {
      return { ok: false, error: 'Job is active' }
    }
    if (this.manualPending) return { ok: false, error: 'Waiting for controller' }
    this.executingLine = -1
    try {
      this.runner.start(lines)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Cannot start job' }
    }
    return { ok: true }
  }

  pause(): GrblCommandResult {
    if (this.runner.phase !== 'running') return { ok: false, error: 'Not running' }
    this.runner.pause()
    return { ok: true }
  }

  resume(): GrblCommandResult {
    if (this.runner.phase !== 'paused') return { ok: false, error: 'Not paused' }
    this.runner.resume()
    return { ok: true }
  }

  abort(): GrblCommandResult {
    if (this.runner.phase !== 'running' && this.runner.phase !== 'paused') {
      return { ok: false, error: 'Not active' }
    }
    this.manualPending = false
    this.runner.abort()
    return { ok: true }
  }

  home(): GrblCommandResult {
    if (!this.runner.home()) return { ok: false, error: 'Cannot home during a job' }
    return { ok: true }
  }

  sendUserLine(line: string): GrblCommandResult {
    if (this.runner.phase === 'running' || this.runner.phase === 'paused') {
      return { ok: false, error: 'Job is active' }
    }
    if (this.manualPending) return { ok: false, error: 'Waiting for controller' }
    let prepared: string | null
    try {
      prepared = prepareGcodeLine(line)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invalid line' }
    }
    if (!prepared) return { ok: false, error: 'Empty line' }
    this.manualPending = true
    this.transport.write(`${prepared}\n`)
    this.pushLog('tx', prepared)
    return { ok: true }
  }

  pushRx(chunk: string): void {
    for (const parsed of this.rx.push(chunk)) {
      if (parsed.type === 'status') {
        this.grblState = parsed.state
        this.mpos = parsed.mpos
        this.wpos = parsed.wpos
        this.emitState()
        continue
      }
      if (parsed.type === 'ok' && this.runner.phase !== 'running' && this.runner.phase !== 'paused') {
        this.manualPending = false
      }
      this.runner.ingest(parsed)
    }
  }

  dispose(): void {
    clearInterval(this.timer)
  }

  private pushLog(direction: 'rx' | 'tx', text: string): void {
    const limit = this.options.logLimit ?? DEFAULT_LOG_LIMIT
    this.logs.push({ direction, text })
    while (this.logs.length > limit) this.logs.shift()
    this.options.onEvent?.({ type: 'log', direction, text })
  }

  private emitState(): void {
    const snap = this.snapshot()
    this.options.onEvent?.({
      type: 'state',
      connection: 'connected',
      job: snap.job,
      grblState: snap.grblState,
      mpos: snap.mpos,
      wpos: snap.wpos,
      executingLine: snap.executingLine
    })
  }
}
