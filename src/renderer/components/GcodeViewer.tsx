import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { gcodeLineAtTime, gcodeLineRangeAtTime } from '../lib/simulate'
import { activePlayerLayer, singlePreviewLayer, useAppStore } from '../store'

export default function GcodeViewer(): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const lastScrollLine = useRef(-1)
  const playerTime = useAppStore((s) => s.playerTime)
  const state = useAppStore()
  const layer = activePlayerLayer(state)
  const playable = singlePreviewLayer(state)
  const gcodeLines = layer?.gcodeLines ?? []
  const timeline = layer?.timeline ?? null

  const activeLine = timeline ? gcodeLineAtTime(timeline, playerTime) : 0
  const activeRange = timeline ? gcodeLineRangeAtTime(timeline, playerTime) : null

  const virtualizer = useVirtualizer({
    count: gcodeLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18,
    overscan: 24
  })

  useEffect(() => {
    if (gcodeLines.length === 0 || activeLine < 0 || activeLine >= gcodeLines.length) return
    if (lastScrollLine.current === activeLine) return
    lastScrollLine.current = activeLine
    virtualizer.scrollToIndex(activeLine, { align: 'center' })
  }, [activeLine, gcodeLines.length, virtualizer])

  useEffect(() => {
    lastScrollLine.current = -1
  }, [gcodeLines])

  const emptyMessage =
    playable === null
      ? 'Включите один слой в превью, чтобы смотреть G-code и проигрыватель'
      : 'Сгенерируйте G-code'

  return (
    <div ref={parentRef} className="gcode-viewer">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const inMove =
            activeRange != null && item.index >= activeRange.start && item.index <= activeRange.end
          const isPrimary = item.index === activeLine
          const className = [
            'gcode-line',
            inMove ? 'gcode-line--in-move' : '',
            isPrimary ? 'gcode-line--active' : ''
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <div
              key={item.key}
              className={className}
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
          )
        })}
      </div>
      {gcodeLines.length === 0 && <div className="preview-empty">{emptyMessage}</div>}
    </div>
  )
}
