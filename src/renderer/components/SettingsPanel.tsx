import NumInput from './NumInput'
import PanelAccordion from './PanelAccordion'
import { useAppStore } from '../store'

function CoordinatesLegend(): JSX.Element {
  return (
    <div className="svg-legend">
      <p className="svg-legend__intro">Система координат в превью и в G-code совпадает.</p>
      <ul className="svg-legend__list">
        <li>
          <span className="svg-legend__glyph svg-legend__glyph--text" aria-hidden>
            0
          </span>
          <span>
            <strong>Ноль станка</strong> — нижний левый угол рабочей зоны (стол W×H).
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph svg-legend__glyph--text" aria-hidden>
            B
          </span>
          <span>
            <strong>Текстолит</strong> — заготовка на столе; смещение X/Y от нуля станка.
          </span>
        </li>
        <li>
          <span className="svg-legend__glyph svg-legend__glyph--text" aria-hidden>
            P
          </span>
          <span>
            <strong>Плата</strong> — копия SVG на текстолите; колонки, строки, зазоры и поля задают раскладку.
          </span>
        </li>
      </ul>
      <p className="svg-legend__note">
        <strong>Оси:</strong> +X вправо, +Y вверх. Якорь SVG определяет, что считается (0,0) платы.
      </p>
    </div>
  )
}

export default function SettingsPanel(): JSX.Element {
  const { settings, bedLayout, setSettings, setBedLayout } = useAppStore()

  return (
    <div className="panel-body settings-panel-body">
      <div className="settings-accordions">
        <PanelAccordion label="Лазер" defaultOpen>
          <div className="settings-accordion-fields">
            <div className="field-row">
              <label>Ширина луча, мм</label>
              <NumInput
                value={settings.beamSize}
                min={0}
                onChange={(v) => setSettings({ beamSize: v })}
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
              <label>Проходы</label>
              <NumInput value={settings.passes} min={0} onChange={(v) => setSettings({ passes: v })} />
            </div>
            <div className="field-row">
              <label>Скорость без луча, мм/м</label>
              <NumInput
                value={settings.rapidFeed}
                min={0}
                onChange={(v) => setSettings({ rapidFeed: v })}
              />
            </div>
            <div className="field-row">
              <label>Скорость с лучом, мм/м</label>
              <NumInput
                value={settings.cutFeed}
                min={0}
                onChange={(v) => setSettings({ cutFeed: v })}
              />
            </div>
            <div className="field-row">
              <label>Мощность S</label>
              <NumInput
                value={settings.power}
                min={0}
                onChange={(v) => setSettings({ power: v })}
              />
            </div>
            <div className="field-row">
              <label>Макс. S</label>
              <NumInput
                value={settings.maxS}
                min={0}
                onChange={(v) => setSettings({ maxS: v })}
              />
            </div>
            <div className="preset-row">
              {[255, 1000, 10000].map((v) => (
                <button key={v} type="button" onClick={() => setSettings({ maxS: v })}>
                  {v}
                </button>
              ))}
            </div>
            <div className="field-row">
              <label>Режим лазера</label>
              <select
                value={settings.laserMode}
                onChange={(e) => setSettings({ laserMode: e.target.value as 'M3' | 'M4' })}
              >
                <option value="M3">M3 — постоянная</option>
                <option value="M4">M4 — динамическая</option>
              </select>
            </div>
          </div>
        </PanelAccordion>

        <PanelAccordion label="Гравировка">
          <div className="settings-accordion-fields">
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
                <option value="scanline">скан-линии (горизонталь)</option>
                <option value="dual-scanline">двойной скан (сначала V, затем H)</option>
              </select>
            </div>
            <div className="field-row">
              <label htmlFor="setting-travel-optimize">Оптимизация холостых</label>
              <span className="field-row__check">
                <input
                  id="setting-travel-optimize"
                  type="checkbox"
                  checked={settings.travelOptimize}
                  onChange={(e) => setSettings({ travelOptimize: e.target.checked })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Сетка холостых, мм</label>
              <NumInput
                disabled={!settings.travelOptimize}
                value={settings.travelGridMm}
                min={0}
                onChange={(v) => setSettings({ travelGridMm: v })}
                title="0 = авто (~10× ширина луча). Группировка холостых ходов по ячейкам."
              />
            </div>
          </div>
        </PanelAccordion>

        <PanelAccordion label="Координаты и смещения">
          <div className="settings-accordion-fields">
            <PanelAccordion label="Обозначения" className="settings-nested-accordion">
              <CoordinatesLegend />
            </PanelAccordion>
            <div className="field-row">
              <label>Стол W×H</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.workArea.widthMm}
                  min={0}
                  onChange={(v) =>
                    setBedLayout({ workArea: { ...bedLayout.workArea, widthMm: v } })
                  }
                />
                <NumInput
                  value={bedLayout.workArea.heightMm}
                  min={0}
                  onChange={(v) =>
                    setBedLayout({ workArea: { ...bedLayout.workArea, heightMm: v } })
                  }
                />
              </span>
            </div>
            <div className="field-row">
              <label>Заготовка W×H</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.blank.widthMm}
                  min={0}
                  onChange={(v) => setBedLayout({ blank: { ...bedLayout.blank, widthMm: v } })}
                />
                <NumInput
                  value={bedLayout.blank.heightMm}
                  min={0}
                  onChange={(v) => setBedLayout({ blank: { ...bedLayout.blank, heightMm: v } })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Смещение X/Y</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.blank.offsetX}
                  onChange={(v) => setBedLayout({ blank: { ...bedLayout.blank, offsetX: v } })}
                />
                <NumInput
                  value={bedLayout.blank.offsetY}
                  onChange={(v) => setBedLayout({ blank: { ...bedLayout.blank, offsetY: v } })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Колонки × строки</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.panel.columns}
                  min={1}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, columns: v } })}
                />
                <NumInput
                  value={bedLayout.panel.rows}
                  min={1}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, rows: v } })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Зазор X/Y</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.panel.gapX}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, gapX: v } })}
                />
                <NumInput
                  value={bedLayout.panel.gapY}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, gapY: v } })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Поле X/Y</label>
              <span className="field-row__nums">
                <NumInput
                  value={bedLayout.panel.marginX}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, marginX: v } })}
                />
                <NumInput
                  value={bedLayout.panel.marginY}
                  onChange={(v) => setBedLayout({ panel: { ...bedLayout.panel, marginY: v } })}
                />
              </span>
            </div>
            <div className="field-row">
              <label>Якорь SVG</label>
              <select
                value={bedLayout.boardAnchor}
                onChange={(e) =>
                  setBedLayout({ boardAnchor: e.target.value as 'svgOrigin' | 'bboxMin' })
                }
              >
                <option value="bboxMin">мин. bbox → ноль платы</option>
                <option value="svgOrigin">начало SVG</option>
              </select>
            </div>
          </div>
        </PanelAccordion>
      </div>
    </div>
  )
}
