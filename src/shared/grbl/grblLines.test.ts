import { describe, expect, it } from 'vitest'
import { GRBL_MAX_LINE_LENGTH, prepareGcodeLine, prepareGcodeLines } from './grblLines'

describe('prepareGcodeLine', () => {
  it('trims and strips semicolon comments', () => {
    expect(prepareGcodeLine('  G1 X1 Y2 ; cut  ')).toBe('G1 X1 Y2')
    expect(prepareGcodeLine('; only a comment')).toBeNull()
    expect(prepareGcodeLine('   ')).toBeNull()
  })

  it('rejects lines longer than the GRBL safe length', () => {
    const long = 'G1 X' + '1'.repeat(GRBL_MAX_LINE_LENGTH)
    expect(() => prepareGcodeLine(long)).toThrow(/GRBL/)
  })
})

describe('prepareGcodeLines', () => {
  it('drops empty lines and comments', () => {
    expect(prepareGcodeLines(['G21', '', '  ', '; skip', 'G90 ; abs'])).toEqual(['G21', 'G90'])
  })
})
