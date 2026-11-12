import { useCallback, type CSSProperties } from 'react'

import type { PcbLayerSide } from '@shared/layers'
import type { SvgElementMode, SvgElementNode, SvgElementRules } from '@shared/types'

import NumInput from './NumInput'
import PanelAccordion from './PanelAccordion'
import { useAppStore } from '../store'

type Props = {
  embedded?: boolean
}

function countShapes(node: SvgElementNode): number {
  let n = node.shape ? 1 : 0
  for (const c of node.children) n += countShapes(c)
  return n
}

function ModeToggle({
  active,
  title,
  onClick,
  children,
  disabled = false,
  reserved = false
}: {
  active: boolean
  title: string
  onClick: () => void
  children: string
  disabled?: boolean
  reserved?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      className={[
        'svg-tree-mode-btn',
        active ? 'svg-tree-mode-btn--on' : '',
        reserved ? 'svg-tree-mode-btn--reserved' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
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
  const mode = rules[node.id]?.mode ?? 'skip'
  const layer = rules[node.id]?.layer ?? 1
  const subtractInvert = rules[node.id]?.subtractInvert === true

  return (
    <>
      <div className="svg-tree-row" style={{ '--tree-depth': depth } as CSSProperties}>
        <span className={`svg-tree-tag ${node.shape ? 'svg-tree-tag--shape' : ''}`}>{node.tag}</span>
        <span className="svg-tree-label" title={node.id}>
          {node.label}
        </span>
        {node.shape ? (
          <span className="svg-tree-actions">
            <ModeToggle
              active={mode === 'isolation'}
              title="Изоляция — линия по контуру элемента"
              onClick={() => onMode(node.id, mode === 'isolation' ? 'skip' : 'isolation')}
            >
              ○
            </ModeToggle>
            <ModeToggle
              active={mode === 'fill'}
              title="Заливка — гравировка всей области внутри контура"
              onClick={() => onMode(node.id, mode === 'fill' ? 'skip' : 'fill')}
            >
              ▣
            </ModeToggle>
            <ModeToggle
              active={mode === 'subtract'}
              title="Вырез — убрать залитую область path (outer − subpath-дырки); в дырках заливка rect остаётся"
              onClick={() => onMode(node.id, mode === 'subtract' ? 'skip' : 'subtract')}
            >
              −
            </ModeToggle>
            <ModeToggle
              active={mode === 'subtract' && subtractInvert}
              reserved={mode !== 'subtract'}
              disabled={mode !== 'subtract'}
              title={
                mode !== 'subtract'
                  ? 'Переключение поле/subpath — доступно в режиме «вырез»'
                  : subtractInvert
                    ? 'Вырез: subpath-дырки (клик — вырезать поле path)'
                    : 'Вырез: поле path (клик — вырезать subpath-дырки)'
              }
              onClick={() => onSubtractInvert(node.id, !subtractInvert)}
            >
              ⇄
            </ModeToggle>
            <span className="svg-tree-layer" title="Слой заливки/выреза: вырез слоя N режет заливки слоёв 1…N">
              <NumInput
                value={layer}
                min={1}
                max={99}
                aria-label="Слой"
                onChange={(n) => onLayer(node.id, n)}
              />
            </span>
          </span>
        ) : null}
      </div>
      {node.children.map((c) => (
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

function LayerTree({
  side,
  tree,
  rules
}: {
  side: PcbLayerSide
  tree: SvgElementNode | null
  rules: SvgElementRules
}): JSX.Element {
  const { setSvgElementMode, setSvgElementLayer, setSvgElementSubtractInvert } = useAppStore()
  const onMode = useCallback(
    (id: string, mode: SvgElementMode | 'skip') => setSvgElementMode(side, id, mode),
    [side, setSvgElementMode]
  )
  const onLayer = useCallback(
    (id: string, layer: number) => setSvgElementLayer(side, id, layer),
    [side, setSvgElementLayer]
  )
  const onSubtractInvert = useCallback(
    (id: string, invert: boolean) => setSvgElementSubtractInvert(side, id, invert),
    [side, setSvgElementSubtractInvert]
  )

  if (!tree) {
    return (
      <div className="svg-tree-scroll">
        <p className="coord-hint svg-tree-empty">
          {side === 'top' ? 'Загрузите SVG верхнего слоя.' : 'Загрузите SVG нижнего слоя (зеркальный).'}
        </p>
      </div>
    )
  }

  const shapeCount = countShapes(tree)
  return (
    <div className="svg-tree-scroll">
      <div className="svg-tree-meta">SVG-дерево (фигур: {shapeCount})</div>
      {tree.children.map((c) => (
        <TreeRow
          key={c.id}
          node={c}
          depth={0}
          rules={rules}
          onMode={onMode}
          onLayer={onLayer}
          onSubtractInvert={onSubtractInvert}
        />
      ))}
    </div>
  )
}

export default function SvgElementPanel({ embedded = false }: Props): JSX.Element | null {
  const { topLayer, bottomLayer, svgPanelTab, setSvgPanelTab } = useAppStore()
  const hasAny = Boolean(topLayer.svgElementTree || bottomLayer.svgElementTree)

  const legendHint = (
    <div className="svg-legend">
      <p className="svg-legend__intro">
        После загрузки SVG гравировка <strong>не</strong> строится, пока вы не отметите фигуры в дереве.
      </p>
      <ul className="svg-legend__list">
        <li>
          <span className="svg-legend__glyph" aria-hidden>
            ○
          </span>
          <span>
            <strong>Изоляция</strong> — линия по контуру элемента.
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph" aria-hidden>
            ▣
          </span>
          <span>
            <strong>Заливка</strong> — гравировка всей области внутри контура.
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph" aria-hidden>
            −
          </span>
          <span>
            <strong>Вырез</strong> — вычитание залитой области path (внешний контур минус дырки subpath).
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph" aria-hidden>
            ⇄
          </span>
          <span>
            У режима «вырез»: переключение — вырезать поле path или subpath-дырки.
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph svg-legend__glyph--text" aria-hidden>
            L
          </span>
          <span>
            <strong>Слой</strong> — порядок заливки; вырез слоя N убирает заливки слоёв 1…N.
          </span>
        </li>
      </ul>
      <p className="svg-legend__note">
        <strong>Нижний слой:</strong> SVG уже зеркальный; координаты от правого края платы.
      </p>
    </div>
  )

  const legendAccordion = (
    <PanelAccordion label="Обозначения">
      {legendHint}
    </PanelAccordion>
  )

  const tabs = (
    <div className="view-tabs" role="tablist" aria-label="Слой SVG">
      <button
        type="button"
        role="tab"
        aria-selected={svgPanelTab === 'top'}
        className={`view-tab ${svgPanelTab === 'top' ? 'view-tab--active' : ''}`}
        onClick={() => setSvgPanelTab('top')}
      >
        Верх
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={svgPanelTab === 'bottom'}
        className={`view-tab ${svgPanelTab === 'bottom' ? 'view-tab--active' : ''}`}
        onClick={() => setSvgPanelTab('bottom')}
      >
        Низ
      </button>
    </div>
  )

  const activeTree = svgPanelTab === 'top' ? topLayer.svgElementTree : bottomLayer.svgElementTree
  const activeRules =
    svgPanelTab === 'top' ? topLayer.svgElementRules : bottomLayer.svgElementRules

  const treeBody = <LayerTree side={svgPanelTab} tree={activeTree} rules={activeRules} />

  if (embedded) {
    return (
      <>
        <div className="panel-header panel-header--split">
          <span>Элементы SVG</span>
          {tabs}
        </div>
        <div className="panel-body panel-body--flush svg-tree-panel-body">
          <div className="svg-tree-embedded">
            {legendAccordion}
            {treeBody}
          </div>
        </div>
      </>
    )
  }

  if (!hasAny) return null

  return (
    <section className="settings-section svg-tree-section">
      <h3>Элементы SVG</h3>
      {tabs}
      {legendAccordion}
      {treeBody}
    </section>
  )
}
