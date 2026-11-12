export type MainPage = 'design' | 'cnc'

type MainNavProps = {
  page: MainPage
  onChange: (page: MainPage) => void
}

const TABS: { id: MainPage; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'cnc', label: 'CNC' }
]

export default function MainNav({ page, onChange }: MainNavProps): JSX.Element {
  return (
    <nav className="main-nav" aria-label="Главные разделы">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`main-nav-tab ${page === tab.id ? 'main-nav-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
