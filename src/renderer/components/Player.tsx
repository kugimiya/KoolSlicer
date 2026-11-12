import { useEffect, useRef } from 'react'
import { useAppStore, activePlayerLayer, singlePreviewLayer } from '../store'
import { gcodeLineAtTime, moveProgress, travelLengthsAtTime } from '../lib/simulate'

const SPEEDS = [0.5, 1, 2, 10, 100, 1000]

export default function Player(): JSX.Element {
  const state = useAppStore()
  const {
    playerTime,
    playerSpeed,
    playerPlaying,
    setPlayerTime,
    setPlayerSpeed,
    setPlayerPlaying,
    setCurrentGcodeLine,
    resetPlayer
  } = state

  const playableSide = singlePreviewLayer(state)
  const layer = activePlayerLayer(state)
  const timeline = layer?.timeline ?? null
  const playerEnabled = playableSide !== null && Boolean(timeline)

  const lastFrame = useRef<number | null>(null)

  useEffect(() => {
    if (!playerPlaying || !timeline || !playerEnabled) {
      lastFrame.current = null
      return
    }
    let raf = 0
    const tick = (now: number): void => {
      if (lastFrame.current == null) lastFrame.current = now
      const dt = (now - lastFrame.current) / 1000
      lastFrame.current = now
      const st = useAppStore.getState()
      const active = activePlayerLayer(st)
      const tl = active?.timeline
      if (!tl || singlePreviewLayer(st) === null) return
      let next = st.playerTime + dt * st.playerSpeed
      if (next >= tl.totalTime) {
        next = tl.totalTime
        setPlayerPlaying(false)
      }
      setPlayerTime(next)
      setCurrentGcodeLine(gcodeLineAtTime(tl, next))
      if (st.playerPlaying) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playerPlaying, timeline, playerEnabled, setPlayerTime, setPlayerPlaying, setCurrentGcodeLine])

  useEffect(() => {
    if (!timeline || !playerEnabled) {
      setCurrentGcodeLine(0)
      return
    }
    setCurrentGcodeLine(gcodeLineAtTime(timeline, playerTime))
  }, [playerTime, timeline, playerEnabled, setCurrentGcodeLine])

  const total = timeline?.totalTime ?? 0
  const pct = timeline ? moveProgress(timeline, playerTime) : 0
  const { cutMm, travelMm } = timeline
    ? travelLengthsAtTime(timeline, playerTime)
    : { cutMm: 0, travelMm: 0 }
  const totalCutMm = timeline?.totalCutLength ?? 0
  const totalTravelMm = timeline?.totalTravelLength ?? 0

  const disabledHint =
    playableSide === null
      ? 'Включите ровно один слой в превью для проигрывания'
      : !timeline
        ? 'Сгенерируйте G-code для выбранного слоя'
        : undefined

  return (
    <div className="player-bar">
      <div className="player-controls">
        <button
          type="button"
          onClick={() => setPlayerPlaying(!playerPlaying)}
          disabled={!playerEnabled}
          title={disabledHint}
        >
          {playerPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          disabled={!playerEnabled}
          onClick={() => {
            setPlayerPlaying(false)
            resetPlayer()
          }}
        >
          Stop
        </button>
        <div className="view-tabs player-speed-tabs" role="group" aria-label="Скорость воспроизведения">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`view-tab ${playerSpeed === s ? 'view-tab--active' : ''}`}
              disabled={!playerEnabled}
              aria-pressed={playerSpeed === s}
              onClick={() => setPlayerSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
      <input
        className="player-scrubber"
        type="range"
        min={0}
        max={total || 1}
        step={0.01}
        value={playerTime}
        disabled={!playerEnabled}
        title={disabledHint}
        onChange={(e) => {
          const t = Number(e.target.value)
          setPlayerTime(t)
          if (timeline) setCurrentGcodeLine(gcodeLineAtTime(timeline, t))
        }}
      />
      <div className="player-meta">
        {playerEnabled
          ? `${playerTime.toFixed(2)} / ${total.toFixed(2)} s — ${pct.toFixed(1)}% (${playableSide === 'top' ? 'верх' : 'низ'})`
          : disabledHint ?? '—'}
      </div>
      <div className="player-meta player-meta--dist">
        Лазер: {cutMm.toFixed(1)} / {totalCutMm.toFixed(1)} mm · Ход: {travelMm.toFixed(1)} /{' '}
        {totalTravelMm.toFixed(1)} mm
      </div>
    </div>
  )
}
