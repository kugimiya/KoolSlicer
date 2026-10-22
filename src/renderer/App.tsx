import { useCallback, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import SettingsPanel from './components/SettingsPanel'
import SettingsAlerts from './components/SettingsAlerts'
import SvgElementPanel from './components/SvgElementPanel'
import Preview from './components/Preview'
import Player from './components/Player'
import GcodeViewer from './components/GcodeViewer'
import PolygonDebug from './components/PolygonDebug'
import BusyIndicator from './components/BusyIndicator'
import { useAppStore } from './store'
import sampleSvg from './assets/sample.svg?raw'
import {
  buildProjectFile,
  defaultGcodeFileName,
  defaultOutlineGcodeFileName,
  defaultProjectFileName,
  serializeProjectFile
} from '@shared/project'
import { outlineDebugGcode } from './lib/outlineDebugGcode'

export default function App(): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const projectFileRef = useRef<HTMLInputElement>(null)
  const {
    svgName,
    svgText,
    gcode,
    moves,
    settings,
    bedLayout,
    svgElementRules,
    viewTab,
    statusMessage,
    setViewTab,
    loadSvg,
    loadProject,
    generate,
    setStatus,
    svgElementTree
  } = useAppStore()

  const onPickFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      await loadSvg(file.name, text)
    },
    [loadSvg]
  )

  const openSvg = useCallback(async () => {
    if (window.koolSlicer?.pickSvgFile) {
      const picked = await window.koolSlicer.pickSvgFile()
      if (picked) await loadSvg(picked.name, picked.content)
      return
    }
    fileRef.current?.click()
  }, [loadSvg])

  const loadSample = useCallback(async () => {
    await loadSvg('sample.svg', sampleSvg)
  }, [loadSvg])

  const downloadGcode = useCallback(async () => {
    if (!gcode) {
      setStatus('Сначала сгенерируйте G-code')
      return
    }
    const name = defaultGcodeFileName(svgName)
    if (window.koolSlicer?.saveGcodeFile) {
      const ok = await window.koolSlicer.saveGcodeFile(name, gcode)
      setStatus(ok ? `Сохранено ${name}` : 'Сохранение отменено')
      return
    }
    const blob = new Blob([gcode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Скачан ${name}`)
  }, [gcode, svgName, setStatus])

  const downloadOutlineGcode = useCallback(async () => {
    if (moves.length === 0) {
      setStatus('Сначала сгенерируйте G-code')
      return
    }
    const text = outlineDebugGcode(moves, settings)
    if (!text) {
      setStatus('Нет cut-перемещений для контура отладки')
      return
    }
    const name = defaultOutlineGcodeFileName(svgName)
    if (window.koolSlicer?.saveGcodeFile) {
      const ok = await window.koolSlicer.saveGcodeFile(name, text)
      setStatus(ok ? `Сохранён контур отладки (${name})` : 'Сохранение отменено')
      return
    }
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Скачан ${name}`)
  }, [moves, settings, svgName, setStatus])

  const saveProject = useCallback(async () => {
    if (!svgText) {
      setStatus('Нет SVG — нечего сохранять в проект')
      return
    }
    const json = serializeProjectFile(
      buildProjectFile({
        svgName: svgName ?? 'project.svg',
        svgText,
        settings,
        bedLayout,
        svgElementRules
      })
    )
    const name = defaultProjectFileName(svgName)
    if (window.koolSlicer?.saveProjectFile) {
      const ok = await window.koolSlicer.saveProjectFile(name, json)
      setStatus(ok ? `Проект сохранён (${name})` : 'Сохранение отменено')
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Скачан проект ${name}`)
  }, [svgText, svgName, settings, bedLayout, svgElementRules, setStatus])

  const openProject = useCallback(async () => {
    if (window.koolSlicer?.openProjectFile) {
      const picked = await window.koolSlicer.openProjectFile()
      if (picked) await loadProject(picked.name, picked.content)
      return
    }
    projectFileRef.current?.click()
  }, [loadProject])

  return (
    <div className="app-shell">
      <BusyIndicator />
      <div className="toolbar">
        <button type="button" onClick={() => void openSvg()}>
          Загрузить SVG…
        </button>
        <button type="button" className="secondary" onClick={() => void loadSample()}>
          sample.svg
        </button>
        <button type="button" onClick={() => void generate({ skipConfirm: false })}>
          Сгенерировать
        </button>
        <button type="button" className="secondary" onClick={() => void saveProject()} disabled={!svgText}>
          Сохранить проект…
        </button>
        <button type="button" className="secondary" onClick={() => void openProject()}>
          Открыть проект…
        </button>
        <button type="button" className="secondary" onClick={() => void downloadGcode()} disabled={!gcode}>
          Скачать .gcode
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void downloadOutlineGcode()}
          disabled={moves.length === 0}
          title="5% мощности, F rapid — прямоугольник по границе всех cut-линий"
        >
          Контур отладки…
        </button>
        <div className="view-tabs">
          <button
            type="button"
            className={`view-tab ${viewTab === 'preview' ? 'view-tab--active' : ''}`}
            onClick={() => setViewTab('preview')}
          >
            Превью
          </button>
          <button
            type="button"
            className={`view-tab ${viewTab === 'polygons' ? 'view-tab--active' : ''}`}
            onClick={() => setViewTab('polygons')}
          >
            Полигоны
          </button>
        </div>
        {svgName && (
          <span className="toolbar-path" title={svgName}>
            {svgName}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onPickFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={projectFileRef}
          type="file"
          accept=".koolslicer,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              void f.text().then((text) => loadProject(f.name, text))
            }
            e.target.value = ''
          }}
        />
      </div>

      <PanelGroup direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
        <Panel defaultSize={24} minSize={18}>
          <PanelGroup direction="vertical" autoSaveId="koolslicer-left">
            <Panel defaultSize={58} minSize={28}>
              <div className="panel panel--overlay-host" style={{ height: '100%' }}>
                <SettingsAlerts />
                <div className="panel-header">Настройки</div>
                <SettingsPanel />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel defaultSize={42} minSize={18}>
              <div className="panel svg-tree-panel" style={{ height: '100%' }}>
                <div className="panel-header">Элементы SVG</div>
                <div className="panel-body panel-body--flush svg-tree-panel-body">
                  <SvgElementPanel tree={svgElementTree} embedded />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={46} minSize={30}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={78} minSize={40}>
              <div className="panel" style={{ height: '100%' }}>
                <div className="panel-header">{viewTab === 'preview' ? 'Превью' : 'Полигоны'}</div>
                <div className="panel-body" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
                  {viewTab === 'preview' ? <Preview /> : <PolygonDebug />}
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel defaultSize={22} minSize={12}>
              <Player />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={30} minSize={20}>
          <div className="panel" style={{ height: '100%' }}>
            <div className="panel-header">G-code</div>
            <div className="panel-body" style={{ padding: 0 }}>
              <GcodeViewer />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <div className="status-bar">{statusMessage}</div>
    </div>
  )
}
