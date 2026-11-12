import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type { GrblEvent } from '../shared/grbl/grblSession'
import type { KoolSlicerApi } from '../shared/types'

const api: KoolSlicerApi = {
  pickSvgFile: () => ipcRenderer.invoke(IPC.PICK_SVG),
  saveGcodeFile: (defaultName, content) => ipcRenderer.invoke(IPC.SAVE_GCODE, defaultName, content),
  openProjectFile: () => ipcRenderer.invoke(IPC.OPEN_PROJECT),
  saveProjectFile: (defaultName, content) =>
    ipcRenderer.invoke(IPC.SAVE_PROJECT, defaultName, content),
  listSerialPorts: () => ipcRenderer.invoke(IPC.GRBL_LIST_PORTS),
  grblConnect: (path, baud) => ipcRenderer.invoke(IPC.GRBL_CONNECT, path, baud),
  grblDisconnect: () => ipcRenderer.invoke(IPC.GRBL_DISCONNECT),
  grblHome: () => ipcRenderer.invoke(IPC.GRBL_HOME),
  grblStartJob: (lines) => ipcRenderer.invoke(IPC.GRBL_START_JOB, lines),
  grblPause: () => ipcRenderer.invoke(IPC.GRBL_PAUSE),
  grblResume: () => ipcRenderer.invoke(IPC.GRBL_RESUME),
  grblAbort: () => ipcRenderer.invoke(IPC.GRBL_ABORT),
  grblSendLine: (line) => ipcRenderer.invoke(IPC.GRBL_SEND_LINE, line),
  subscribeGrblEvents: (cb) => {
    const listener = (_event: unknown, payload: GrblEvent): void => cb(payload)
    ipcRenderer.on(IPC.GRBL_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC.GRBL_EVENT, listener)
  }
}

contextBridge.exposeInMainWorld('koolSlicer', api)
