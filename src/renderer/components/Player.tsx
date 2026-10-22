import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { gcodeLineAtTime, moveProgress, travelLengthsAtTime } from '../lib/simulate'

const SPEEDS = [0.5, 1, 2, 10, 100, 1000]

export default function Player(): JSX.Element {
  const {
    timeline,
    playerTime,
    playerSpeed,
    playerPlaying,
    setPlayerTime,
    setPlayerSpeed,
    setPlayerPlaying,
    setCurrentGcodeLine,
    resetPlayer
  } = useAppStore()

  const lastFrame = useRef<number | null>(null)

  useEffect(() => {
    if (!playerPlaying || !timeline) {
      lastFrame.current = null
      return
    }
    let raf = 0
    const tick = (now: number): void => {
      if (lastFrame.current == null) lastFrame.current = now
      const dt = (now - lastFrame.current) / 1000
      lastFrame.current = now
      const state = useAppStore.getState()
      const tl = state.timeline
      if (!tl) return
      let next = state.playerTime + dt * state.playerSpeed
      if (next >= tl.totalTime) {
        next = tl.totalTime
        setPlayerPlaying(false)
      }
      setPlayerTime(next)
      setCurrentGcodeLine(gcodeLineAtTime(tl, next))
      if (state.playerPlaying) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playerPlaying, timeline, setPlayerTime, setPlayerPlaying, setCurrentGcodeLine])

  const total = timeline?.totalTime ?? 0
  const pct = timeline ? moveProgress(timeline, playerTime) : 0
  const { cutMm, travelMm } = timeline
    ? travelLengthsAtTime(timeline, playerTime)
    : { cutMm: 0, travelMm: 0 }
  const totalCutMm = timeline?.totalCutLength ?? 0
  const totalTravelMm = timeline?.totalTravelLength ?? 0

  return (
    <div className="player-bar">
      <div className="player-controls">
        <button type="button" onClick={() => setPlayerPlaying(!playerPlaying)} disabled={!timeline}>
          {playerPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlayerPlaying(false)
            resetPlayer()
          }}
        >
          Stop
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={playerSpeed === s ? '' : 'secondary'}
            onClick={() => setPlayerSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>
      <input
        className="player-scrubber"
        type="range"
        min={0}
        max={total || 1}
        step={0.01}
        value={playerTime}
        disabled={!timeline}
        onChange={(e) => {
          const t = Number(e.target.value)
          setPlayerTime(t)
          if (timeline) setCurrentGcodeLine(gcodeLineAtTime(timeline, t))
        }}
      />
      <div className="player-meta">
        {playerTime.toFixed(2)} / {total.toFixed(2)} s — {pct.toFixed(1)}%
      </div>
      <div className="player-meta player-meta--dist">
        Лазер: {cutMm.toFixed(1)} / {totalCutMm.toFixed(1)} mm · Ход: {travelMm.toFixed(1)} /{' '}
        {totalTravelMm.toFixed(1)} mm
      </div>
    </div>
  )
}
