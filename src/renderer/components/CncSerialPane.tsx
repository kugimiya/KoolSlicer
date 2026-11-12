import { useEffect, useRef, useState } from 'react'
import type { GrblLogEntry } from '@shared/grbl/grblSession'

type CncSerialPaneProps = {
  logs: GrblLogEntry[]
  canSend: boolean
  onSend: (line: string) => void
}

export default function CncSerialPane(props: CncSerialPaneProps): JSX.Element {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [props.logs])

  return (
    <section className="cnc-pane cnc-serial">
      <div className="panel-header">Serial</div>
      <div ref={logRef} className="cnc-log" aria-live="polite">
        {props.logs.map((entry, index) => (
          <div key={`${index}-${entry.text}`} className={`cnc-log-line cnc-log-line--${entry.direction}`}>
            <span className="cnc-log-dir">{entry.direction === 'tx' ? '→' : '←'}</span>
            {entry.text}
          </div>
        ))}
      </div>
      <form
        className="cnc-send"
        onSubmit={(e) => {
          e.preventDefault()
          const line = draft.trim()
          if (!line || !props.canSend) return
          props.onSend(line)
          setDraft('')
        }}
      >
        <input
          className="cnc-send-input"
          aria-label="G-code command"
          value={draft}
          placeholder="G-code"
          onChange={(e) => setDraft(e.target.value)}
          disabled={!props.canSend}
          autoComplete="off"
        />
        <button type="submit" className="toolbar-btn toolbar-btn--secondary" disabled={!props.canSend || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
