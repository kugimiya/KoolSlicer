import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type { KoolSlicerApi } from '../shared/types'

const api: KoolSlicerApi = {
  pickSvgFile: () => ipcRenderer.invoke(IPC.PICK_SVG),
  saveGcodeFile: (defaultName, content) => ipcRenderer.invoke(IPC.SAVE_GCODE, defaultName, content),
  openProjectFile: () => ipcRenderer.invoke(IPC.OPEN_PROJECT),
  saveProjectFile: (defaultName, content) =>
    ipcRenderer.invoke(IPC.SAVE_PROJECT, defaultName, content)
}

contextBridge.exposeInMainWorld('koolSlicer', api)
