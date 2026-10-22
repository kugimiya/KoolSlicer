import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParseResult } from '@shared/types'
import { useAppStore } from '../store'
import type { BoardRef } from '../lib/geo/types'
import { boardToMachinePoint, layoutCopyRects } from '../lib/layout'
import { positionAtTime, segmentIndexAtTime, segmentProgressAtTime } from '../lib/simulate'
import { createMachineToScreen, fillWorldRect, strokeWorldRect } from '../lib/previewDraw'

type ViewTransform = {
  scale: number
  offsetX: number
  offsetY: number
}

export default function Preview(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<ViewTransform>({ scale: 3, offsetX: 40, offsetY: 40 })
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [showCuts, setShowCuts] = useState(true)
  const [showRapids, setShowRapids] = useState(false)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const {
    parseResult,
    geometryImportCache,
    svgElementRules,
    boardRef,
    moves,
    settings,
    bedLayout,
    timeline,
    playerTime,
    viewTab
  } = useAppStore()

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = bedLayout.workArea.widthMm
    const h = bedLayout.workArea.heightMm
    const pad = 20
    const sx = (canvas.width - pad * 2) / w
    const sy = (canvas.height - pad * 2) / h
    const scale = Math.min(sx, sy)
    setTransform({ scale, offsetX: pad, offsetY: pad })
  }, [bedLayout.workArea])

  useEffect(() => {
    const el = containerRef.current
    const canvas = canvasRef.current
    if (!el || !canvas) return
    const syncSize = (): void => {
      const w = el.clientWidth
      const h = Math.max(200, el.clientHeight - 48)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        setCanvasSize({ w, h })
      }
    }
    const ro = new ResizeObserver(() => syncSize())
    ro.observe(el)
    syncSize()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const toScreen = createMachineToScreen(
      canvas.height,
      transform.offsetX,
      transform.offsetY,
      transform.scale
    )
    const { scale } = transform

    ctx.strokeStyle = '#666'
    ctx.setLineDash([4, 4])
    strokeWorldRect(
      ctx,
      toScreen,
      {
        x: 0,
        y: 0,
        widthMm: bedLayout.workArea.widthMm,
        heightMm: bedLayout.workArea.heightMm
      },
      scale
    )
    ctx.setLineDash([])

    const blankX = bedLayout.blank.offsetX
    const blankY = bedLayout.blank.offsetY
    ctx.fillStyle = 'rgba(80,120,80,0.15)'
    fillWorldRect(
      ctx,
      toScreen,
      {
        x: blankX,
        y: blankY,
        widthMm: bedLayout.blank.widthMm,
        heightMm: bedLayout.blank.heightMm
      },
      scale
    )

    const layoutParse = previewLayoutParse(parseResult, boardRef ?? geometryImportCache?.boardRef ?? null)

    if (layoutParse && viewTab === 'preview') {
      const rects = layoutCopyRects(layoutParse, bedLayout)
      for (const r of rects) {
        ctx.strokeStyle = r.fits ? '#4a4' : '#f44'
        strokeWorldRect(ctx, toScreen, { x: r.x, y: r.y, widthMm: r.w, heightMm: r.h }, scale)
      }

      const toMachine = (x: number, y: number) => {
        const m = boardToMachinePoint({ x, y }, layoutParse, bedLayout)
        return toScreen(m.x, m.y)
      }

      ctx.lineWidth = 1

      if (geometryImportCache) {
        const br = geometryImportCache.boardRef
        ctx.strokeStyle = 'rgba(110, 120, 140, 0.55)'
        ctx.setLineDash([6, 4])
        drawPath(ctx, boardRefRect(br), toMachine)
        ctx.setLineDash([])

        for (const el of geometryImportCache.elements) {
          const rule = svgElementRules[el.key]
          ctx.strokeStyle = rule
            ? rule.mode === 'fill'
              ? 'rgba(100, 190, 130, 0.55)'
              : rule.mode === 'subtract'
                ? 'rgba(210, 120, 120, 0.55)'
                : 'rgba(150, 195, 235, 0.6)'
            : 'rgba(180, 180, 180, 0.38)'
          for (const contour of el.contours) {
            drawPath(ctx, contour, toMachine)
          }
          for (const cmp of el.compounds) {
            drawPath(ctx, cmp.outer, toMachine)
            for (const hole of cmp.holes) drawPath(ctx, hole, toMachine)
          }
        }
      }

      if (parseResult && parseResult.polygons.length > 0) {
        ctx.strokeStyle = 'rgba(100, 170, 230, 0.85)'
        ctx.lineWidth = 1.25
        for (const poly of parseResult.polygons) {
          drawPath(ctx, poly.outer, toMachine)
          for (const hole of poly.holes) drawPath(ctx, hole, toMachine)
        }
        ctx.lineWidth = 1
      }
    }

    const CUT_COLOR = '#6eb5e0'
    const RAPID_COLOR = '#e8c060'
    const endIdx =
      timeline && timeline.moves.length > 0
        ? segmentIndexAtTime(timeline, playerTime)
        : moves.length - 1
    const partialU =
      timeline && timeline.moves.length > 0 ? segmentProgressAtTime(timeline, playerTime) : 1

    let pointCount = 0
    const stride = moves.length > 100_000 ? 4 : 1
    const drawLimit = timeline ? endIdx : moves.length - 1

    for (let i = 0; i <= drawLimit && i < moves.length; i++) {
      const m = moves[i]
      if (m.type === 'rapid') {
        if (!showRapids) continue
      } else if (!showCuts) {
        continue
      } else {
        pointCount++
        if (pointCount % stride !== 0) continue
      }

      let tx = m.to.x
      let ty = m.to.y
      if (i === drawLimit && timeline && m.type === 'cut') {
        tx = m.from.x + (m.to.x - m.from.x) * partialU
        ty = m.from.y + (m.to.y - m.from.y) * partialU
      }

      const a = toScreen(m.from.x, m.from.y)
      const b = toScreen(tx, ty)
      ctx.strokeStyle = m.type === 'rapid' ? RAPID_COLOR : CUT_COLOR
      ctx.globalAlpha = m.type === 'rapid' ? 0.85 : 0.9
      ctx.setLineDash(m.type === 'rapid' ? [4, 3] : [])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    if (timeline) {
      const pos = positionAtTime(timeline, playerTime)
      const p = toScreen(pos.x, pos.y)
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.font = '11px Segoe UI, sans-serif'
    ctx.fillStyle = '#9a9a9a'
    const home = toScreen(0, 0)
    ctx.fillRect(home.x - 3, home.y - 3, 6, 6)
    ctx.fillText('0,0 станок', home.x + 6, home.y + 4)
    ctx.fillStyle = '#ff0'
    const blankOrigin = toScreen(blankX, blankY)
    ctx.fillRect(blankOrigin.x - 3, blankOrigin.y - 3, 6, 6)
    ctx.fillStyle = '#d4a017'
    ctx.fillText('0,0 текстолит', blankOrigin.x + 6, blankOrigin.y + 4)
    ctx.fillStyle = '#666'
    ctx.fillText('+Y', home.x - 2, home.y - 14)
    ctx.fillText('+X', home.x + 14, home.y + 4)
  }, [
    parseResult,
    geometryImportCache,
    svgElementRules,
    boardRef,
    moves,
    settings,
    bedLayout,
    transform,
    timeline,
    playerTime,
    viewTab,
    canvasSize,
    showCuts,
    showRapids
  ])

  const onWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => {
      const worldX = (mx - t.offsetX) / t.scale
      const worldY = (canvas.height - my - t.offsetY) / t.scale
      const scale = t.scale * factor
      return {
        scale,
        offsetX: mx - worldX * scale,
        offsetY: canvas.height - my - worldY * scale
      }
    })
  }

  return (
    <div className="preview-wrap" ref={containerRef}>
      <div className="preview-toolbar">
        <button type="button" className="secondary" onClick={fitToView}>
          Вписать
        </button>
        <label className="preview-layer-toggle">
          <input type="checkbox" checked={showCuts} onChange={(e) => setShowCuts(e.target.checked)} />
          Резка
        </label>
        <label className="preview-layer-toggle">
          <input
            type="checkbox"
            checked={showRapids}
            onChange={(e) => setShowRapids(e.target.checked)}
          />
          Rapid (G0)
        </label>
      </div>
      <canvas
        ref={canvasRef}
        className="preview-canvas"
        onWheel={onWheel}
        onMouseDown={(e) => {
          dragging.current = true
          lastPos.current = { x: e.clientX, y: e.clientY }
        }}
        onMouseMove={(e) => {
          if (!dragging.current) return
          const dx = e.clientX - lastPos.current.x
          const dy = e.clientY - lastPos.current.y
          lastPos.current = { x: e.clientX, y: e.clientY }
          setTransform((t) => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY - dy }))
        }}
        onMouseUp={() => {
          dragging.current = false
        }}
        onMouseLeave={() => {
          dragging.current = false
        }}
      />
    </div>
  )
}

function previewLayoutParse(
  parseResult: ParseResult | null,
  board: BoardRef | null
): ParseResult | null {
  if (parseResult) return parseResult
  if (!board) return null
  return {
    polygons: [],
    boardBBox: {
      minX: board.minX,
      minY: board.minY,
      maxX: board.maxX,
      maxY: board.maxY
    },
    warnings: []
  }
}

function boardRefRect(board: BoardRef): { x: number; y: number }[] {
  return [
    { x: board.minX, y: board.minY },
    { x: board.maxX, y: board.minY },
    { x: board.maxX, y: board.maxY },
    { x: board.minX, y: board.maxY }
  ]
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  project: (x: number, y: number) => { x: number; y: number }
): void {
  if (path.length < 2) return
  ctx.beginPath()
  const p0 = project(path[0].x, path[0].y)
  ctx.moveTo(p0.x, p0.y)
  for (let i = 1; i < path.length; i++) {
    const p = project(path[i].x, path[i].y)
    ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.stroke()
}
