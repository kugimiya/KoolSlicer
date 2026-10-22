import { useAppStore } from '../store'
import { polygonArea } from '../lib/geometry'

export default function PolygonDebug(): JSX.Element {
  const parseResult = useAppStore((s) => s.parseResult)
  if (!parseResult) {
    return <div className="preview-empty">Нет данных парсинга</div>
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
