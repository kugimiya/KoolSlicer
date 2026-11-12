import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import {
  clampNumber,
  formatNumericDisplay,
  parseNumericText,
  sanitizeNumericText
} from '../lib/numericInput'

type NumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function NumInput({
  value,
  onChange,
  min,
  max,
  className = '',
  disabled,
  onBlur,
  onFocus,
  ...rest
}: NumInputProps): JSX.Element {
  const [text, setText] = useState(() => formatNumericDisplay(value))
  const editingRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setText(formatNumericDisplay(value))
  }, [value])

  const commit = (raw: string, final: boolean): void => {
    const sanitized = sanitizeNumericText(raw)
    setText(sanitized)
    let n = parseNumericText(sanitized)
    if (final) n = clampNumber(n, min, max)
    onChange(n)
    if (final) setText(formatNumericDisplay(n))
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      className={`num-input ${className}`.trim()}
      value={text}
      onFocus={(e) => {
        editingRef.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        editingRef.current = false
        commit(e.target.value, true)
        onBlur?.(e)
      }}
      onChange={(e) => commit(e.target.value, false)}
    />
  )
}
