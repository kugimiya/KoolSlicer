import { useAppStore } from '../store'

export default function SettingsAlerts(): JSX.Element | null {
  const { errors, warnings } = useAppStore()
  if (errors.length === 0 && warnings.length === 0) return null

  return (
    <div className="alert-overlay" aria-live="polite">
      {errors.map((e) => (
        <div key={e} className="alert alert--error">
          {e}
        </div>
      ))}
      {warnings.map((w) => (
        <div key={`w-${w}`} className="alert alert--warn">
          {w}
        </div>
      ))}
    </div>
  )
}
