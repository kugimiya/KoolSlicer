import * as clipperLib from 'js-angusj-clipper/web'

export type ClipperInstance = clipperLib.NativeClipperLibInstance

let clipperPromise: Promise<ClipperInstance> | null = null

export function getClipper(): Promise<ClipperInstance> {
  if (!clipperPromise) {
    clipperPromise = clipperLib.loadNativeClipperLibInstanceAsync(
      clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback
    )
  }
  return clipperPromise
}

export { clipperLib }
