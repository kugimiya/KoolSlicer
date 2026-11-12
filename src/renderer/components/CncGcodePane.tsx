import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

type CncGcodePaneProps = {
  lines: string[]
  activeLine: number
  emptyMessage: string
}

export default function CncGcodePane(props: CncGcodePaneProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const lastScrollLine = useRef(-1)
  const virtualizer = useVirtualizer({
    count: props.lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18,
    overscan: 24
  })

  useEffect(() => {
    if (props.activeLine < 0 || props.activeLine >= props.lines.length) return
    if (lastScrollLine.current === props.activeLine) return
    lastScrollLine.current = props.activeLine
    virtualizer.scrollToIndex(props.activeLine, { align: 'center' })
  }, [props.activeLine, props.lines.length, virtualizer])

  useEffect(() => {
    lastScrollLine.current = -1
  }, [props.lines])

  return (
    <section className="cnc-pane cnc-gcode">
      <div className="panel-header">G-code</div>
      <div ref={parentRef} className="gcode-viewer">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const isPrimary = item.index === props.activeLine
            return (
              <div
                key={item.key}
                className={isPrimary ? 'gcode-line gcode-line--active' : 'gcode-line'}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${item.start}px)`
                }}
              >
                {props.lines[item.index]}
              </div>
            )
          })}
        </div>
        {props.lines.length === 0 && <div className="preview-empty">{props.emptyMessage}</div>}
      </div>
    </section>
  )
}
