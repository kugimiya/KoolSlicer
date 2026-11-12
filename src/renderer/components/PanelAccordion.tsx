import { useId, useState, type ReactNode } from 'react'

type PanelAccordionProps = {
  label: string
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}

function IconChevronDown({ open }: { open: boolean }): JSX.Element {
  return (
    <svg
      className={`panel-accordion__chevron${open ? ' panel-accordion__chevron--open' : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PanelAccordion({
  label,
  children,
  className = '',
  defaultOpen = false
}: PanelAccordionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={`panel-accordion${open ? ' panel-accordion--open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="panel-accordion__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <IconChevronDown open={open} />
      </button>
      {open ? (
        <div id={panelId} className="panel-accordion__body" role="region" aria-label={label}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
