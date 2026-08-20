import { describe, expect, it } from 'vitest'
import { mergeEntries } from './cloud'
import type { LogEntry } from '../types'

function entry(id: string, ts: number): LogEntry {
  return { id, ts, rawText: id, items: [] }
}

describe('mergeEntries', () => {
  it('server wint per id, offline-loggings blijven en worden gepusht', () => {
    const local = [entry('a', 1), entry('b', 2), entry('offline', 3)]
    const server = [entry('a', 1), entry('b', 2), entry('ander-apparaat', 4)]
    const { merged, toPush } = mergeEntries(local, server)
    expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'offline', 'ander-apparaat'])
    expect(toPush.map((e) => e.id)).toEqual(['offline'])
  })

  it('lege lokale log neemt de server volledig over', () => {
    const server = [entry('x', 5)]
    const { merged, toPush } = mergeEntries([], server)
    expect(merged).toHaveLength(1)
    expect(toPush).toHaveLength(0)
  })
})
