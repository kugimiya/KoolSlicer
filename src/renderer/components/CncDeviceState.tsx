import type { GrblPoint } from '@shared/grbl/grblParse'
import type { JobPhase } from '@shared/grbl/grblJobRunner'
import { formatDuration, type JobProgress } from '@shared/grbl/jobProgress'

type CncDeviceStateProps = {
  connected: boolean
  job: JobPhase
  grblState?: string
  mpos?: GrblPoint
  wpos?: GrblPoint
  progress: JobProgress
  notice: string
}

function fmtPoint(p: GrblPoint | undefined): string {
  if (!p) return '—'
  return `${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`
}

export default function CncDeviceState(props: CncDeviceStateProps): JSX.Element {
  return (
    <section className="cnc-pane cnc-state">
      <div className="panel-header">Device</div>
      <dl className="cnc-state-list">
        <dt>Link</dt>
        <dd>{props.connected ? 'Connected' : 'Disconnected'}</dd>
        <dt>Job</dt>
        <dd>{props.job}</dd>
        <dt>GRBL</dt>
        <dd>{props.grblState ?? '—'}</dd>
        <dt>MPos</dt>
        <dd>{fmtPoint(props.mpos)}</dd>
        <dt>WPos</dt>
        <dd>{fmtPoint(props.wpos)}</dd>
        <dt>Done</dt>
        <dd>{props.progress.totalLines > 0 ? `${Math.round(props.progress.percent)}%` : '—'}</dd>
        <dt>Lines</dt>
        <dd>
          {props.progress.totalLines > 0
            ? `${props.progress.executedLines} / ${props.progress.totalLines}`
            : '—'}
        </dd>
        <dt>Elapsed</dt>
        <dd>{formatDuration(props.progress.elapsedSec)}</dd>
        <dt>Estimate</dt>
        <dd>
          {props.progress.estimatedRemainingSec == null
            ? '—'
            : `${formatDuration(props.progress.estimatedRemainingSec)} left`}
        </dd>
      </dl>
      {props.notice && <p className="cnc-notice">{props.notice}</p>}
    </section>
  )
}
