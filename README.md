# KoolSlicer

Desktop app (Electron + React) for **PCB isolation** laser G-code (GRBL) from SVG — one pass along each copper contour.

## Commands

- `npm install`
- `npm run dev` — Electron + Vite
- `npm test` — vitest (geometry, offsets, layout, G-code)
- `npm run build` / `npm run dist` — portable Windows build

## GRBL notes

- Enable laser mode: `$32=1`
- Set max spindle/S: `$30` to match **maxS** in the app (255 / 1000 / 10000 depending on firmware)
- Generated files use **machine absolute** coordinates (blank offset is baked in, no G92 for the board)

## Coordinates

Везде одна система: **(0,0) в нижнем левом углу**, **+X вправо**, **+Y вверх** (как в G-code).

- **Machine** — home станка = нижний левый угол рабочей области
- **Blank** — `offsetX/Y` = нижний левый угол текстолита на столе (ноль платы для гравировки)
- **Board** — SVG после импорта (Y из SVG перевёрнут); якорь `bboxMin` ставит нижний левый bbox в margin панели

## SVG / PCB exports (EasyEDA и др.)

- Поддерживаются **`path`** (заливка и обводка), `rect`, `circle`, `polygon`, смещённый **`viewBox`**, **`transform`** на группах.
- EasyEDA часто экспортирует **медь белой заливкой** (`#FFFFFF`) и дорожки **белой обводкой** — это нормально, импорт включён.
- KoolSlicer строит **изоляцию PCB**: одна линия по краю каждого распознанного контура меди (заливки и обводки `polyline`/`line`).

## Элементы SVG (панель слева)

- После загрузки SVG траектории **не** строятся — отметьте нужные элементы в дереве.
- **○** — **изоляция** (линия по контуру элемента).
- **▣** — **заливка**: контурная гравировка всей области внутри элемента.
- **−** — **вырез из заливки** (дырка в элементах с ▣; изоляция по контуру элемента остаётся).
- **L** — **слой** (1…99): для каждого слоя сначала добавляются заливки этого слоя, затем вырезы. Вырез слоя *N* действует на все накопленные заливки слоёв 1…*N* (удобно: заливка дочернего элемента на слое 1, вырез родителя на слое 2).
