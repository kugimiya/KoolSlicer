import { useAppStore } from '../store'

export default function BusyIndicator(): JSX.Element | null {
  const busyCount = useAppStore((s) => s.busyCount)
  if (busyCount <= 0) return null

  return (
    <div className="app-busy" role="status" aria-live="polite" aria-label="Выполняется операция">
      <div className="app-busy-spinner" />
    </div>
  )
}
