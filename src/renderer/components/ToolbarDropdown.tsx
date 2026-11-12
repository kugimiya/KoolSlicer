import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type ToolbarDropdownItem = {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  onSelect: () => void
}

type ToolbarDropdownProps = {
  label: string
  items: ToolbarDropdownItem[]
  variant?: 'primary' | 'secondary'
  align?: 'start' | 'end'
}

function IconChevronDown(): JSX.Element {
  return (
    <svg
      className="toolbar-dropdown__chevron"
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

export default function ToolbarDropdown({
  label,
  items,
  variant = 'primary',
  align = 'start'
}: ToolbarDropdownProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  const runItem = (item: ToolbarDropdownItem) => {
    if (item.disabled) return
    close()
    item.onSelect()
  }

  return (
    <div
      ref={rootRef}
      className={`toolbar-dropdown toolbar-dropdown--${variant} toolbar-dropdown--align-${align}`}
    >
      <button
        type="button"
        className={`toolbar-btn toolbar-btn--${variant} toolbar-dropdown__trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="toolbar-btn__label">{label}</span>
        <IconChevronDown />
      </button>
      {open ? (
        <div id={menuId} className="toolbar-dropdown__menu" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="toolbar-dropdown__item"
              disabled={item.disabled}
              onClick={() => runItem(item)}
            >
              {item.icon ? <span className="toolbar-dropdown__item-icon">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
