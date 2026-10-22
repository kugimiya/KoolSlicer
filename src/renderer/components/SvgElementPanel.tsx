import { useCallback, useMemo, useState } from 'react'

import type { SvgElementMode, SvgElementNode, SvgElementRules } from '@shared/types'

import { useAppStore } from '../store'



type Props = {
  tree: SvgElementNode | null
  embedded?: boolean
}



function countShapes(node: SvgElementNode): number {

  let n = node.shape ? 1 : 0

  for (const c of node.children) n += countShapes(c)

  return n

}



function TreeRow({

  node,

  depth,

  rules,

  onMode,

  onLayer,

  onSubtractInvert

}: {

  node: SvgElementNode

  depth: number

  rules: SvgElementRules

  onMode: (id: string, mode: SvgElementMode | 'skip') => void

  onLayer: (id: string, layer: number) => void

  onSubtractInvert: (id: string, invert: boolean) => void

}): JSX.Element {

  const [open, setOpen] = useState(depth < 2)

  const hasKids = node.children.length > 0

  const mode = rules[node.id]?.mode ?? 'skip'

  const layer = rules[node.id]?.layer ?? 1

  const subtractInvert = rules[node.id]?.subtractInvert === true



  return (

    <>

      <div className="svg-tree-row" style={{ paddingLeft: 8 + depth * 12 }}>

        {hasKids ? (

          <button type="button" className="svg-tree-toggle" onClick={() => setOpen(!open)}>

            {open ? '▾' : '▸'}

          </button>

        ) : (

          <span className="svg-tree-toggle svg-tree-toggle--spacer" />

        )}

        <span className={`svg-tree-tag ${node.shape ? 'svg-tree-tag--shape' : ''}`}>{node.tag}</span>

        <span className="svg-tree-label" title={node.id}>

          {node.label}

        </span>

        {node.shape ? (

          <span className="svg-tree-actions">

            <label className="color-rules-check" title="Изоляция — линия по контуру элемента">

              <input

                type="checkbox"

                checked={mode === 'isolation'}

                onChange={(e) => onMode(node.id, e.target.checked ? 'isolation' : 'skip')}

              />

              ○

            </label>

            <label className="color-rules-check" title="Заливка — гравировка всей области внутри контура">

              <input

                type="checkbox"

                checked={mode === 'fill'}

                onChange={(e) => onMode(node.id, e.target.checked ? 'fill' : 'skip')}

              />

              ▣

            </label>

            <label

              className="color-rules-check"

              title="Вырез — убрать залитую область path (outer − subpath-дырки); в дырках заливка rect остаётся"

            >

              <input

                type="checkbox"

                checked={mode === 'subtract'}

                onChange={(e) => onMode(node.id, e.target.checked ? 'subtract' : 'skip')}

              />

              −

            </label>

            {mode === 'subtract' ? (
              <button
                type="button"
                className={`svg-tree-invert${subtractInvert ? ' svg-tree-invert--on' : ''}`}
                title={
                  subtractInvert
                    ? 'Вырез: subpath-дырки (клик — вырезать поле path)'
                    : 'Вырез: поле path (клик — вырезать subpath-дырки)'
                }
                onClick={() => onSubtractInvert(node.id, !subtractInvert)}
              >
                ⇄
              </button>
            ) : null}

            <label className="svg-tree-layer" title="Слой заливки/выреза: вырез слоя N режет заливки слоёв 1…N">

              <span className="svg-tree-layer-label">L</span>

              <input

                type="number"

                min={1}

                max={99}

                value={layer}

                onChange={(e) => onLayer(node.id, Number(e.target.value))}

              />

            </label>

          </span>

        ) : null}

      </div>

      {open &&

        node.children.map((c) => (

          <TreeRow

            key={c.id}

            node={c}

            depth={depth + 1}

            rules={rules}

            onMode={onMode}

            onLayer={onLayer}

            onSubtractInvert={onSubtractInvert}

          />

        ))}

    </>

  )

}



export default function SvgElementPanel({ tree, embedded = false }: Props): JSX.Element | null {

  const { svgElementRules, setSvgElementMode, setSvgElementLayer, setSvgElementSubtractInvert } =
    useAppStore()

  const shapeCount = useMemo(() => (tree ? countShapes(tree) : 0), [tree])



  const onMode = useCallback(

    (id: string, mode: SvgElementMode) => {

      setSvgElementMode(id, mode)

    },

    [setSvgElementMode]

  )

  const onLayer = useCallback(

    (id: string, layer: number) => {

      setSvgElementLayer(id, layer)

    },

    [setSvgElementLayer]

  )

  const onSubtractInvert = useCallback(
    (id: string, invert: boolean) => {
      setSvgElementSubtractInvert(id, invert)
    },
    [setSvgElementSubtractInvert]
  )



  if (!tree) {
    if (!embedded) return null
    return (
      <p className="coord-hint svg-tree-empty">
        Загрузите SVG, чтобы отметить элементы для гравировки.
      </p>
    )
  }

  const hint = (
    <p className="coord-hint">
      После загрузки SVG гравировка <strong>не</strong> строится — отметьте элементы.{' '}
      <strong>○</strong> изоляция (контур). <strong>▣</strong> заливка. <strong>−</strong> вырез из
      заливки. <strong>⇄</strong> у выреза — поле/дырки path. <strong>L</strong> — слой: сначала
      заливки слоя 1, вырез слоя 1, затем слой 2 и т.д.; вырез слоя 2 режет заливки слоёв 1–2.
    </p>
  )

  const body = (
    <>
      {!embedded ? <h3>Элементы SVG</h3> : null}
      {hint}
      <div className="svg-tree-meta">Фигур: {shapeCount}</div>
      <div className="svg-tree-scroll">
        {tree.children.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={0}
            rules={svgElementRules}
            onMode={onMode}
            onLayer={onLayer}
            onSubtractInvert={onSubtractInvert}
          />
        ))}
      </div>
    </>
  )

  if (embedded) {
    return <div className="svg-tree-embedded">{body}</div>
  }

  return <section className="settings-section svg-tree-section">{body}</section>

}


