import { BrowserWindow, net } from 'electron'

async function waitForDevServer(url: string, attempts = 60, delayMs = 100): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await net.fetch(url, { method: 'GET' })
      if (res.ok) return
    } catch {
      /* vite starting */
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error(`Dev server not reachable: ${url}`)
}

export async function loadRenderer(
  win: BrowserWindow,
  devUrl: string | undefined,
  prodHtml: string
): Promise<void> {
  if (devUrl) {
    await waitForDevServer(devUrl)
    await win.loadURL(devUrl)
    return
  }
  await win.loadFile(prodHtml)
}
