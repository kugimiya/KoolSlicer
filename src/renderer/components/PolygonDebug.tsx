import { useAppStore } from '../store'
import { polygonArea } from '../lib/geometry'

export default function PolygonDebug(): JSX.Element {
  const { topLayer, bottomLayer, svgPanelTab } = useAppStore()
  const parseResult = svgPanelTab === 'top' ? topLayer.parseResult : bottomLayer.parseResult
  if (!parseResult) {
    return (
      <div className="preview-empty">
        Нет данных парсинга ({svgPanelTab === 'top' ? 'верх' : 'низ'})
      </div>
    )
  }
  return (
    <ul className="polygon-list">
      {parseResult.polygons.map((p) => {
        const area = polygonArea(p.outer)
        return (
          <li key={p.id}>
            #{p.id} — вершин {p.outer.length}, площадь {area.toFixed(3)} mm², дырок {p.holes.length}
          </li>
        )
      })}
    </ul>
  )
}
