import { BrowserWindow, ipcMain } from 'electron'
import { SerialPort } from 'serialport'
import { IPC } from '../../shared/ipcChannels'
import { GrblSession, type GrblEvent } from '../../shared/grbl/grblSession'
import type { GrblPortInfo } from '../../shared/types'

const DEFAULT_BAUD = 115200

function broadcast(event: GrblEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.GRBL_EVENT, event)
  }
}

function disconnectedEvent(): GrblEvent {
  return { type: 'state', connection: 'disconnected', job: 'idle', executingLine: -1 }
}

export function registerGrblIpc(): void {
  let port: SerialPort | null = null
  let session: GrblSession | null = null

  const dropLink = async (): Promise<void> => {
    const currentSession = session
    const currentPort = port
    session = null
    port = null
    currentSession?.dispose()
    if (currentPort?.isOpen) {
      await new Promise<void>((resolve) => {
        currentPort.close(() => resolve())
      })
    }
  }

  ipcMain.handle(IPC.GRBL_LIST_PORTS, async (): Promise<GrblPortInfo[]> => {
    const listed = await SerialPort.list()
    return listed.map((info) => ({
      path: info.path,
      manufacturer: info.manufacturer
    }))
  })

  ipcMain.handle(IPC.GRBL_CONNECT, async (_evt, path: string, baud?: number) => {
    if (!path) return { ok: false as const, error: 'No port selected' }
    try {
      await dropLink()
      const opened = new SerialPort({
        path,
        baudRate: baud && baud > 0 ? baud : DEFAULT_BAUD,
        autoOpen: false
      })
      await new Promise<void>((resolve, reject) => {
        opened.open((err) => (err ? reject(err) : resolve()))
      })
      port = opened
      session = new GrblSession(
        {
          write: (data) => {
            opened.write(data)
          }
        },
        { onEvent: broadcast }
      )
      opened.on('data', (buf: Buffer) => {
        session?.pushRx(buf.toString('utf8'))
      })
      opened.on('close', () => {
        if (port !== opened) return
        session?.dispose()
        session = null
        port = null
        broadcast(disconnectedEvent())
      })
      opened.on('error', (err: Error) => {
        broadcast({ type: 'log', direction: 'rx', text: err.message })
      })
      broadcast({ type: 'state', connection: 'connected', job: 'idle', executingLine: -1 })
      return { ok: true as const }
    } catch (err) {
      await dropLink()
      return { ok: false as const, error: err instanceof Error ? err.message : 'Connect failed' }
    }
  })

  ipcMain.handle(IPC.GRBL_DISCONNECT, async () => {
    await dropLink()
    broadcast(disconnectedEvent())
  })

  ipcMain.handle(IPC.GRBL_HOME, async () => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.home()
  })

  ipcMain.handle(IPC.GRBL_START_JOB, async (_evt, lines: string[]) => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.startJob(Array.isArray(lines) ? lines : [])
  })

  ipcMain.handle(IPC.GRBL_PAUSE, async () => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.pause()
  })

  ipcMain.handle(IPC.GRBL_RESUME, async () => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.resume()
  })

  ipcMain.handle(IPC.GRBL_ABORT, async () => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.abort()
  })

  ipcMain.handle(IPC.GRBL_SEND_LINE, async (_evt, line: string) => {
    if (!session) return { ok: false as const, error: 'Not connected' }
    return session.sendUserLine(line)
  })
}
