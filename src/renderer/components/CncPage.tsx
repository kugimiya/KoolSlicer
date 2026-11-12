import { useCallback, useEffect, useRef, useState } from 'react'
import type { JobPhase } from '@shared/grbl/grblJobRunner'
import type { GrblPoint } from '@shared/grbl/grblParse'
import type { GrblLogEntry } from '@shared/grbl/grblSession'
import { jobProgress, plannedSecondsByLine } from '@shared/grbl/jobProgress'
import type { GrblPortInfo } from '@shared/types'
import { activePlayerLayer, singlePreviewLayer, useAppStore } from '../store'
import CncDeviceState from './CncDeviceState'
import CncGcodePane from './CncGcodePane'
import CncSerialPane from './CncSerialPane'
import CncToolbar from './CncToolbar'

const LOG_CAP = 500

function jobCanStart(job: JobPhase): boolean {
  return job === 'idle' || job === 'completed' || job === 'aborted'
}

export default function CncPage(): JSX.Element {
  const previewShowTop = useAppStore((s) => s.previewShowTop)
  const previewShowBottom = useAppStore((s) => s.previewShowBottom)
  const state = useAppStore()
  const playable = singlePreviewLayer({ previewShowTop, previewShowBottom })
  const layer = activePlayerLayer(state)
  const gcodeLines = playable ? (layer?.gcodeLines ?? []) : []

  const [ports, setPorts] = useState<GrblPortInfo[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [connected, setConnected] = useState(false)
  const [job, setJob] = useState<JobPhase>('idle')
  const [grblState, setGrblState] = useState<string | undefined>()
  const [mpos, setMpos] = useState<GrblPoint | undefined>()
  const [wpos, setWpos] = useState<GrblPoint | undefined>()
  const [executingLine, setExecutingLine] = useState(-1)
  const [logs, setLogs] = useState<GrblLogEntry[]>([])
  const [notice, setNotice] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const clockRef = useRef({ startedAt: 0, pausedAccum: 0, pauseBegan: 0 })
  const prevJobRef = useRef<JobPhase>('idle')

  const refresh = useCallback(async () => {
    const list = (await window.koolSlicer?.listSerialPorts()) ?? []
    setPorts(list)
    setSelectedPath((current) =>
      current && list.some((port) => port.path === current) ? current : (list[0]?.path ?? '')
    )
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const unsubscribe = window.koolSlicer?.subscribeGrblEvents((event) => {
      if (event.type === 'log') {
        setLogs((prev) => {
          const next = [...prev, { direction: event.direction, text: event.text }]
          return next.length > LOG_CAP ? next.slice(next.length - LOG_CAP) : next
        })
        return
      }
      if (event.type === 'lineAck') {
        setExecutingLine(event.index)
        return
      }
      setConnected(event.connection === 'connected')
      setJob(event.job)
      setGrblState(event.grblState)
      setMpos(event.mpos)
      setWpos(event.wpos)
      setExecutingLine(event.executingLine)
      if (event.connection === 'disconnected') {
        setGrblState(undefined)
        setMpos(undefined)
        setWpos(undefined)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const prev = prevJobRef.current
    prevJobRef.current = job
    const now = Date.now()
    const clock = clockRef.current
    if ((job === 'running' || job === 'paused') && prev !== 'running' && prev !== 'paused') {
      clock.startedAt = now
      clock.pausedAccum = 0
      clock.pauseBegan = 0
      setElapsedSec(0)
    } else if (job === 'paused' && prev === 'running') {
      clock.pauseBegan = now
      setElapsedSec((now - clock.startedAt - clock.pausedAccum) / 1000)
    } else if (job === 'running' && prev === 'paused' && clock.pauseBegan) {
      clock.pausedAccum += now - clock.pauseBegan
      clock.pauseBegan = 0
    } else if (job === 'completed' || job === 'aborted') {
      const end = prev === 'paused' && clock.pauseBegan ? clock.pauseBegan : now
      if (clock.startedAt) setElapsedSec((end - clock.startedAt - clock.pausedAccum) / 1000)
    } else if (job === 'idle') {
      clock.startedAt = 0
      clock.pausedAccum = 0
      clock.pauseBegan = 0
      setElapsedSec(0)
    }
  }, [job])

  useEffect(() => {
    if (job !== 'running') return
    const id = window.setInterval(() => {
      const clock = clockRef.current
      setElapsedSec((Date.now() - clock.startedAt - clock.pausedAccum) / 1000)
    }, 200)
    return () => window.clearInterval(id)
  }, [job])

  const report = (result: { ok: boolean; error?: string } | void): void => {
    if (result && result.ok === false) setNotice(result.error ?? 'Command failed')
    else setNotice('')
  }

  const emptyMessage =
    playable === null
      ? 'Включите один слой в превью, чтобы смотреть G-code и проигрыватель'
      : 'Сгенерируйте G-code'

  const streaming = job === 'running' || job === 'paused'
  const progress = jobProgress({
    totalLines: gcodeLines.length,
    ackedLine: executingLine,
    elapsedSec,
    plannedLineSec: plannedSecondsByLine(gcodeLines.length, playable ? (layer?.moves ?? []) : [])
  })

  return (
    <div className="cnc-page">
      <CncToolbar
        ports={ports}
        selectedPath={selectedPath}
        connected={connected}
        job={job}
        canStart={connected && jobCanStart(job) && playable !== null && gcodeLines.length > 0}
        onRefresh={() => void refresh()}
        onSelectPath={setSelectedPath}
        onConnect={() => {
          void window.koolSlicer?.grblConnect(selectedPath).then(report)
        }}
        onDisconnect={() => {
          void window.koolSlicer?.grblDisconnect().then(() => setNotice(''))
        }}
        onHome={() => {
          void window.koolSlicer?.grblHome().then(report)
        }}
        onStart={() => {
          setExecutingLine(-1)
          void window.koolSlicer?.grblStartJob(gcodeLines).then(report)
        }}
        onPause={() => {
          void window.koolSlicer?.grblPause().then(report)
        }}
        onResume={() => {
          void window.koolSlicer?.grblResume().then(report)
        }}
        onAbort={() => {
          setNotice('Abort sent feed hold, then a soft-reset (Ctrl-X) to clear the planner.')
          void window.koolSlicer?.grblAbort().then((result) => {
            if (!result.ok) setNotice(result.error)
          })
        }}
      />
      <div className="cnc-body">
        <CncDeviceState
          connected={connected}
          job={job}
          grblState={grblState}
          mpos={mpos}
          wpos={wpos}
          progress={progress}
          notice={notice}
        />
        <CncGcodePane lines={gcodeLines} activeLine={executingLine} emptyMessage={emptyMessage} />
        <CncSerialPane
          logs={logs}
          canSend={connected && !streaming}
          onSend={(line) => {
            void window.koolSlicer?.grblSendLine(line).then(report)
          }}
        />
      </div>
    </div>
  )
}
