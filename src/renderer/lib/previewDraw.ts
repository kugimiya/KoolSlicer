import type { WorldRect } from './coordinates'

export type ScreenPoint = { x: number; y: number }

/** Machine mm (bottom-left origin, Y up) → canvas pixels. */
export function createMachineToScreen(
  canvasHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number
): (x: number, y: number) => ScreenPoint {
  return (x: number, y: number) => ({
    x: offsetX + x * scale,
    y: canvasHeight - (offsetY + y * scale)
  })
}

/** Прямоугольник задаётся нижним левым углом (x, y) в machine mm. */
export function strokeWorldRect(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => ScreenPoint,
  rect: WorldRect,
  scale: number
): void {
  const topLeft = toScreen(rect.x, rect.y + rect.heightMm)
  ctx.strokeRect(topLeft.x, topLeft.y, rect.widthMm * scale, rect.heightMm * scale)
}

export function fillWorldRect(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => ScreenPoint,
  rect: WorldRect,
  scale: number
): void {
  const topLeft = toScreen(rect.x, rect.y + rect.heightMm)
  ctx.fillRect(topLeft.x, topLeft.y, rect.widthMm * scale, rect.heightMm * scale)
}
