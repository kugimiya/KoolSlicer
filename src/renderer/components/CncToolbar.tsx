import type { GrblPortInfo } from '@shared/types'
import type { JobPhase } from '@shared/grbl/grblJobRunner'

type CncToolbarProps = {
  ports: GrblPortInfo[]
  selectedPath: string
  connected: boolean
  job: JobPhase
  canStart: boolean
  onRefresh: () => void
  onSelectPath: (path: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onHome: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onAbort: () => void
}

export default function CncToolbar(props: CncToolbarProps): JSX.Element {
  const streaming = props.job === 'running' || props.job === 'paused'
  const homeOk = props.connected && !streaming

  return (
    <div className="cnc-toolbar">
      <button type="button" className="toolbar-btn toolbar-btn--secondary" onClick={props.onRefresh}>
        Refresh
      </button>
      <select
        className="cnc-port-select"
        aria-label="Serial port"
        value={props.selectedPath}
        onChange={(e) => props.onSelectPath(e.target.value)}
      >
        {props.ports.length === 0 && <option value="">No serial devices</option>}
        {props.ports.map((port) => (
          <option key={port.path} value={port.path}>
            {port.manufacturer ? `${port.path} — ${port.manufacturer}` : port.path}
          </option>
        ))}
      </select>
      {props.connected ? (
        <button type="button" className="toolbar-btn toolbar-btn--secondary" onClick={props.onDisconnect}>
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          className="toolbar-btn toolbar-btn--primary"
          disabled={!props.selectedPath}
          onClick={props.onConnect}
        >
          Connect
        </button>
      )}
      <button type="button" className="toolbar-btn toolbar-btn--secondary" disabled={!homeOk} onClick={props.onHome}>
        Home
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn--primary"
        disabled={!props.canStart}
        onClick={props.onStart}
      >
        Start
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn--secondary"
        disabled={props.job !== 'running'}
        onClick={props.onPause}
      >
        Pause
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn--secondary"
        disabled={props.job !== 'paused'}
        onClick={props.onResume}
      >
        Resume
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn--secondary"
        disabled={!streaming}
        onClick={props.onAbort}
      >
        Abort
      </button>
    </div>
  )
}
