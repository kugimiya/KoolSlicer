import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'

function SvgIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  const { children, ...rest } = props
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden {...rest}>
      {children}
    </svg>
  )
}

export function IconUpload(): JSX.Element {
  return (
    <SvgIcon>
      <path d="M8 2v8M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11h10v3H3z" strokeLinejoin="round" />
    </SvgIcon>
  )
}

export function IconSave(): JSX.Element {
  return (
    <SvgIcon>
      <path d="M3 3h8l2 2v9H3z" strokeLinejoin="round" />
      <path d="M5 3v4h6V3" strokeLinejoin="round" />
      <path d="M6 11h4" strokeLinecap="round" />
    </SvgIcon>
  )
}

export function IconFolderOpen(): JSX.Element {
  return (
    <SvgIcon>
      <path d="M2 5.5h5l1.5 1.5H13V13H2z" strokeLinejoin="round" />
      <path d="M2 6.5c0-1 .8-2 2-2h3l1 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  )
}

export function IconDownload(): JSX.Element {
  return (
    <SvgIcon>
      <path d="M8 2v8M5 9l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h10" strokeLinecap="round" />
    </SvgIcon>
  )
}

export function IconGcode(): JSX.Element {
  return (
    <SvgIcon>
      <path d="M4 4.5h2.5L9 8.5 6.5 11.5H4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4.5h2v7h-2" strokeLinecap="round" strokeLinejoin="round" />
    </SvgIcon>
  )
}

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode
  variant?: 'primary' | 'secondary'
}

export function ToolbarButton({
  icon,
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`toolbar-btn toolbar-btn--${variant} ${className}`.trim()}
      {...rest}
    >
      <span className="toolbar-btn__icon">{icon}</span>
      {children != null && children !== '' ? <span className="toolbar-btn__label">{children}</span> : null}
    </button>
  )
}
