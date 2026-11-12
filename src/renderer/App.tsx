import { useCallback, useRef, useState } from 'react'
import MainNav, { type MainPage } from './components/MainNav'
import CncPlaceholder from './components/CncPlaceholder'
import ToolbarDropdown from './components/ToolbarDropdown'
import {
  IconDownload,
  IconFolderOpen,
  IconGcode,
  IconSave,
  IconUpload,
  ToolbarButton
} from './components/ToolbarIcons'
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
import {
  buildProjectFile,
  defaultGcodeFileName,
  defaultProjectFileName,
  serializeProjectFile
} from '@shared/project'
import type { PcbLayerSide } from '@shared/layers'

export default function App(): JSX.Element {
  const [mainPage, setMainPage] = useState<MainPage>('design')
  const topFileRef = useRef<HTMLInputElement>(null)
  const bottomFileRef = useRef<HTMLInputElement>(null)
  const projectFileRef = useRef<HTMLInputElement>(null)
  const {
    topLayer,
    bottomLayer,
    settings,
    bedLayout,
    viewTab,
    statusMessage,
    setViewTab,
    loadLayerSvg,
    loadProject,
    generate,
    setStatus
  } = useAppStore()

  const onPickFile = useCallback(
    async (file: File, side: PcbLayerSide) => {
      const text = await file.text()
      await loadLayerSvg(side, file.name, text)
    },
    [loadLayerSvg]
  )

  const openLayerSvg = useCallback(
    async (side: PcbLayerSide) => {
      if (window.koolSlicer?.pickSvgFile) {
        const picked = await window.koolSlicer.pickSvgFile()
        if (picked) await loadLayerSvg(side, picked.name, picked.content)
        return
      }
      if (side === 'top') topFileRef.current?.click()
      else bottomFileRef.current?.click()
    },
    [loadLayerSvg]
  )

  const downloadGcodeForSide = useCallback(
    async (side: PcbLayerSide) => {
      const layer = side === 'top' ? topLayer : bottomLayer
      const gcode = layer.gcode
      if (!gcode) {
        setStatus(`Сначала сгенерируйте G-code (${side === 'top' ? 'верх' : 'низ'})`)
        return
      }
      const name = defaultGcodeFileName(layer.svgName, side)
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
    },
    [topLayer, bottomLayer, setStatus]
  )

  const saveProject = useCallback(async () => {
    const topBundle =
      topLayer.svgText && topLayer.svgName
        ? {
            svgName: topLayer.svgName,
            svgText: topLayer.svgText,
            svgElementRules: topLayer.svgElementRules
          }
        : null
    const bottomBundle =
      bottomLayer.svgText && bottomLayer.svgName
        ? {
            svgName: bottomLayer.svgName,
            svgText: bottomLayer.svgText,
            svgElementRules: bottomLayer.svgElementRules
          }
        : null
    if (!topBundle && !bottomBundle) {
      setStatus('Нет SVG — нечего сохранять в проект')
      return
    }
    const json = serializeProjectFile(
      buildProjectFile({
        settings,
        bedLayout,
        layers: { top: topBundle, bottom: bottomBundle }
      })
    )
    const name = defaultProjectFileName(topLayer.svgName ?? bottomLayer.svgName)
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
  }, [topLayer, bottomLayer, settings, bedLayout, setStatus])

  const openProject = useCallback(async () => {
    if (window.koolSlicer?.openProjectFile) {
      const picked = await window.koolSlicer.openProjectFile()
      if (picked) await loadProject(picked.name, picked.content)
      return
    }
    projectFileRef.current?.click()
  }, [loadProject])

  const hasAnySvg = Boolean(topLayer.svgText || bottomLayer.svgText)
  const pathHint = [topLayer.svgName, bottomLayer.svgName].filter(Boolean).join(' · ')

  return (
    <div className="app-shell">
      <BusyIndicator />
      <MainNav page={mainPage} onChange={setMainPage} />
      {mainPage === 'cnc' ? (
        <CncPlaceholder />
      ) : (
        <>
      <div className="toolbar">
        <ToolbarButton variant="secondary" icon={<IconFolderOpen />} onClick={() => void openProject()} />

        <ToolbarButton
          variant="secondary"
          icon={<IconSave />}
          onClick={() => void saveProject()}
          disabled={!hasAnySvg}
        />
        

        <ToolbarDropdown
          label="Добавить"
          items={[
            {
              id: 'svg-top',
              label: 'SVG верхний',
              icon: <IconDownload />,
              onSelect: () => void openLayerSvg('top')
            },
            {
              id: 'svg-bottom',
              label: 'SVG нижний',
              icon: <IconDownload />,
              onSelect: () => void openLayerSvg('bottom')
            }
          ]}
        />
        <ToolbarDropdown
          label="Выгрузить"
          variant="secondary"
          items={[
            {
              id: 'gcode-top',
              label: 'GCode верхний',
              icon: <IconUpload />,
              disabled: !topLayer.gcode,
              onSelect: () => void downloadGcodeForSide('top')
            },
            {
              id: 'gcode-bottom',
              label: 'GCode нижний',
              icon: <IconUpload />,
              disabled: !bottomLayer.gcode,
              onSelect: () => void downloadGcodeForSide('bottom')
            }
          ]}
        />
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
        <div className="toolbar-spacer" />
        {pathHint && (
          <span className="toolbar-path" title={pathHint}>
            {pathHint}
          </span>
        )}
        <ToolbarButton icon={<IconGcode />} onClick={() => void generate({ skipConfirm: false })}>
          Реген
        </ToolbarButton>
        <input
          ref={topFileRef}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onPickFile(f, 'top')
            e.target.value = ''
          }}
        />
        <input
          ref={bottomFileRef}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onPickFile(f, 'bottom')
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
                <SvgElementPanel embedded />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        <Panel defaultSize={61} minSize={30}>
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
        <Panel defaultSize={15} minSize={10}>
          <div className="panel" style={{ height: '100%' }}>
            <div className="panel-header">G-code</div>
            <div className="panel-body" style={{ padding: 0 }}>
              <GcodeViewer />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      <div className="status-bar">{statusMessage}</div>
        </>
      )}
    </div>
  )
}
