/** Debounce для частых правок числовых полей. */
export function createDebounced(delayMs: number, run: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      run()
    }, delayMs)
  }
}
