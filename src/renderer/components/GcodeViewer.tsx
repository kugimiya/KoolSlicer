import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../store'

export default function GcodeViewer(): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const { gcodeLines, currentGcodeLine } = useAppStore()

  const virtualizer = useVirtualizer({
    count: gcodeLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18,
    overscan: 20
  })

  return (
    <div ref={parentRef} className="gcode-viewer">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            className={`gcode-line ${item.index === currentGcodeLine ? 'gcode-line--active' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`
            }}
          >
            {gcodeLines[item.index]}
          </div>
        ))}
      </div>
      {gcodeLines.length === 0 && <div className="preview-empty">Сгенерируйте G-code</div>}
    </div>
  )
}
