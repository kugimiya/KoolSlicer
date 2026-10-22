import { ipcMain, dialog } from 'electron'
import fs from 'fs/promises'
import { IPC } from '../../shared/ipcChannels'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.PICK_SVG, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SVG', extensions: ['svg'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf8')
    const name = filePath.replace(/^.*[/\\]/, '')
    return { name, content }
  })

  ipcMain.handle(IPC.SAVE_GCODE, async (_evt, defaultName: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'G-code', extensions: ['gcode'] }]
    })
    if (result.canceled || !result.filePath) return false
    await fs.writeFile(result.filePath, content, 'utf8')
    return true
  })

  ipcMain.handle(IPC.OPEN_PROJECT, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'KoolSlicer project', extensions: ['koolslicer'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = await fs.readFile(filePath, 'utf8')
    const name = filePath.replace(/^.*[/\\]/, '')
    return { name, content }
  })

  ipcMain.handle(IPC.SAVE_PROJECT, async (_evt, defaultName: string, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'KoolSlicer project', extensions: ['koolslicer'] }]
    })
    if (result.canceled || !result.filePath) return false
    await fs.writeFile(result.filePath, content, 'utf8')
    return true
  })
}
