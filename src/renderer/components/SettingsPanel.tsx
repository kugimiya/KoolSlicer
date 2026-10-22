import { useAppStore } from '../store'
import { polygonArea } from '../lib/geometry'
export default function SettingsPanel(): JSX.Element {
  const { settings, bedLayout, parseResult, setSettings, setBedLayout } = useAppStore()

  const powerPct = settings.maxS > 0 ? Math.round((settings.power / settings.maxS) * 100) : 0

  const applyBlankFromSvg = (): void => {
    if (!parseResult) return
    const { minX, minY, maxX, maxY } = parseResult.boardBBox
    setBedLayout({
      blank: {
        ...bedLayout.blank,
        widthMm: Math.ceil(maxX - minX + bedLayout.panel.marginX * 2),
        heightMm: Math.ceil(maxY - minY + bedLayout.panel.marginY * 2)
      }
    })
  }

  return (
    <div className="panel-body">
      <section className="settings-section">
        <h3>Лазер</h3>
        <div className="field-row">
          <label>beamSize (мм)</label>
          <input
            type="number"
            step="0.01"
            value={settings.beamSize}
            onChange={(e) => setSettings({ beamSize: Number(e.target.value) })}
          />
        </div>
        <div className="preset-row">
          {[1, 0.1, 0.05, 0.01].map((v) => (
            <button key={v} type="button" onClick={() => setSettings({ beamSize: v })}>
              {v}
            </button>
          ))}
        </div>
        <div className="field-row">
          <label>passes</label>
          <input
            type="number"
            value={settings.passes}
            onChange={(e) => setSettings({ passes: Number(e.target.value) })}
          />
        </div>
        <div className="field-row">
          <label>rapid F</label>
          <input
            type="number"
            value={settings.rapidFeed}
            onChange={(e) => setSettings({ rapidFeed: Number(e.target.value) })}
          />
        </div>
        <div className="field-row">
          <label>cut F</label>
          <input
            type="number"
            value={settings.cutFeed}
            onChange={(e) => setSettings({ cutFeed: Number(e.target.value) })}
          />
        </div>
        <div className="field-row">
          <label>S / maxS</label>
          <input
            type="number"
            value={settings.power}
            onChange={(e) => setSettings({ power: Number(e.target.value) })}
          />
        </div>
        <div className="preset-row">
          {[255, 1000, 10000].map((v) => (
            <button key={v} type="button" onClick={() => setSettings({ maxS: v })}>
              max {v}
            </button>
          ))}
        </div>
        <div className="field-row">
          <label>maxS</label>
          <input
            type="number"
            value={settings.maxS}
            onChange={(e) => setSettings({ maxS: Number(e.target.value) })}
          />
        </div>
        <div className="field-row">
          <label>Мощность</label>
          <span>{powerPct}%</span>
        </div>
        <div className="field-row">
          <label>Режим</label>
          <select
            value={settings.laserMode}
            onChange={(e) => setSettings({ laserMode: e.target.value as 'M3' | 'M4' })}
          >
            <option value="M3">M3 constant</option>
            <option value="M4">M4 dynamic</option>
          </select>
        </div>
        <div className="field-row">
          <label>Заливка</label>
          <select
            value={settings.fillStrategy}
            onChange={(e) =>
              setSettings({
                fillStrategy: e.target.value as 'contour' | 'scanline' | 'dual-scanline'
              })
            }
          >
            <option value="contour">контур (inset-кольца)</option>
            <option value="scanline">scan-line (горизонталь)</option>
            <option value="dual-scanline">dual scan-line (V, затем H)</option>
          </select>
        </div>
        <label className="field-row">
          <input
            type="checkbox"
            checked={settings.travelOptimize}
            onChange={(e) => setSettings({ travelOptimize: e.target.checked })}
          />
          travelOptimize
        </label>
        <div className="field-row">
          <label>Сетка travel (mm)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            disabled={!settings.travelOptimize}
            value={settings.travelGridMm}
            onChange={(e) => setSettings({ travelGridMm: Math.max(0, Number(e.target.value) || 0) })}
            title="0 = авто (~10× ширина луча). Группировка холостых ходов по ячейкам."
          />
        </div>
        <label className="field-row">
          <input
            type="checkbox"
            checked={settings.showBurnZone}
            onChange={(e) => setSettings({ showBurnZone: e.target.checked })}
          />
          зона выжигания
        </label>
        <p className="coord-hint">
          Изоляция — контур по краю меди. Заливка: inset-кольца или горизонтальный scan-line с обходом
          вырезов (контур выреза дополнительно изолируется).
        </p>
      </section>

      <section className="settings-section">
        <h3>Стол и текстолит</h3>
        <p className="coord-hint">
          Ноль (0,0) — нижний левый угол: сначала станок, затем текстолит (offset), затем плата на
          заготовке. +X вправо, +Y вверх; то же в G-code.
        </p>
        <div className="field-row">
          <label>Стол W×H</label>
          <input
            type="number"
            value={bedLayout.workArea.widthMm}
            onChange={(e) =>
              setBedLayout({ workArea: { ...bedLayout.workArea, widthMm: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            value={bedLayout.workArea.heightMm}
            onChange={(e) =>
              setBedLayout({
                workArea: { ...bedLayout.workArea, heightMm: Number(e.target.value) }
              })
            }
          />
        </div>
        <div className="field-row">
          <label>Blank W×H</label>
          <input
            type="number"
            value={bedLayout.blank.widthMm}
            onChange={(e) =>
              setBedLayout({ blank: { ...bedLayout.blank, widthMm: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            value={bedLayout.blank.heightMm}
            onChange={(e) =>
              setBedLayout({ blank: { ...bedLayout.blank, heightMm: Number(e.target.value) } })
            }
          />
        </div>
        <button type="button" className="secondary" onClick={applyBlankFromSvg} disabled={!parseResult}>
          Blank из SVG
        </button>
        <div className="field-row">
          <label>Offset X/Y</label>
          <input
            type="number"
            value={bedLayout.blank.offsetX}
            onChange={(e) =>
              setBedLayout({ blank: { ...bedLayout.blank, offsetX: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            value={bedLayout.blank.offsetY}
            onChange={(e) =>
              setBedLayout({ blank: { ...bedLayout.blank, offsetY: Number(e.target.value) } })
            }
          />
        </div>
        <div className="field-row">
          <label>Колонки × строки</label>
          <input
            type="number"
            min={1}
            value={bedLayout.panel.columns}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, columns: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            min={1}
            value={bedLayout.panel.rows}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, rows: Number(e.target.value) } })
            }
          />
        </div>
        <div className="field-row">
          <label>gap X/Y</label>
          <input
            type="number"
            value={bedLayout.panel.gapX}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, gapX: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            value={bedLayout.panel.gapY}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, gapY: Number(e.target.value) } })
            }
          />
        </div>
        <div className="field-row">
          <label>margin X/Y</label>
          <input
            type="number"
            value={bedLayout.panel.marginX}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, marginX: Number(e.target.value) } })
            }
          />
          <input
            type="number"
            value={bedLayout.panel.marginY}
            onChange={(e) =>
              setBedLayout({ panel: { ...bedLayout.panel, marginY: Number(e.target.value) } })
            }
          />
        </div>
        <div className="field-row">
          <label>Якорь SVG</label>
          <select
            value={bedLayout.boardAnchor}
            onChange={(e) =>
              setBedLayout({ boardAnchor: e.target.value as 'svgOrigin' | 'bboxMin' })
            }
          >
            <option value="bboxMin">bbox min → ноль платы</option>
            <option value="svgOrigin">origin SVG</option>
          </select>
        </div>
      </section>

      {parseResult && (
        <section className="settings-section">
          <h3>SVG</h3>
          <div className="field-row">
            <span>
              Полигонов: {parseResult.polygons.length}, площадь max:{' '}
              {Math.max(...parseResult.polygons.map((p) => polygonArea(p.outer))).toFixed(2)} mm²
            </span>
          </div>
        </section>
      )}
    </div>
  )
}
