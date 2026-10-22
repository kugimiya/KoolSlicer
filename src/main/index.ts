import { app, BrowserWindow } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc/handlers'
import { loadRenderer } from './loadRenderer'

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  await loadRenderer(
    mainWindow,
    process.env.ELECTRON_RENDERER_URL,
    path.join(__dirname, '../renderer/index.html')
  )
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
