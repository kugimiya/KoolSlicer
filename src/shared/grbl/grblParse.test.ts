import { describe, expect, it } from 'vitest'
import { GrblRxBuffer, parseGrblLine } from './grblParse'

describe('parseGrblLine', () => {
  it('parses ok', () => {
    expect(parseGrblLine('ok')).toEqual({ type: 'ok' })
    expect(parseGrblLine('ok\r')).toEqual({ type: 'ok' })
  })

  it('parses error and alarm codes', () => {
    expect(parseGrblLine('error:20')).toEqual({ type: 'error', code: 20, raw: 'error:20' })
    expect(parseGrblLine('ALARM:1')).toEqual({ type: 'alarm', code: 1, raw: 'ALARM:1' })
  })

  it('parses welcome banner', () => {
    expect(parseGrblLine("Grbl 1.1h ['$' for help]")).toEqual({
      type: 'welcome',
      raw: "Grbl 1.1h ['$' for help]"
    })
  })

  it('extracts state and positions from a status report', () => {
    const parsed = parseGrblLine('<Run|MPos:1.000,2.500,0.000|FS:500,800>')
    expect(parsed).toEqual({
      type: 'status',
      state: 'Run',
      mpos: { x: 1, y: 2.5, z: 0 },
      raw: '<Run|MPos:1.000,2.500,0.000|FS:500,800>'
    })
  })

  it('extracts work position when MPos is absent', () => {
    const parsed = parseGrblLine('<Idle|WPos:-1.250,0.000,0.000|FS:0,0>')
    expect(parsed.type).toBe('status')
    if (parsed.type !== 'status') return
    expect(parsed.state).toBe('Idle')
    expect(parsed.wpos).toEqual({ x: -1.25, y: 0, z: 0 })
    expect(parsed.mpos).toBeUndefined()
  })

  it('keeps unknown lines as messages', () => {
    expect(parseGrblLine('[MSG:Pgm End]')).toEqual({ type: 'message', raw: '[MSG:Pgm End]' })
  })
})

describe('GrblRxBuffer', () => {
  it('assembles chunked multiline responses', () => {
    const buf = new GrblRxBuffer()
    expect(buf.push('o')).toEqual([])
    expect(buf.push('k\nerror:')).toEqual([{ type: 'ok' }])
    expect(buf.push('2\r\n<Idle|WPos:0.000,0.000,0.000>\n')).toEqual([
      { type: 'error', code: 2, raw: 'error:2' },
      {
        type: 'status',
        state: 'Idle',
        wpos: { x: 0, y: 0, z: 0 },
        raw: '<Idle|WPos:0.000,0.000,0.000>'
      }
    ])
  })

  it('ignores blank lines', () => {
    const buf = new GrblRxBuffer()
    expect(buf.push('\n\nok\n')).toEqual([{ type: 'ok' }])
  })
})
