import { describe, expect, it } from 'vitest'
import { standIn, toKeep, type StandIn } from './stand-in'
import type { AgentChat } from './chats'

const chat = (id: string): AgentChat => ({ id, title: id, preview: '', startedAt: 0, messageCount: 0, source: '', at: 1 })
const base: StandIn = {
  kept: [chat('a'), chat('b')],
  hidden: new Set(),
  opened: [],
  chats: 'waiting',
  rest: 'waiting',
}
const ids = (s: StandIn) => standIn(s)?.map((c) => c.id)

describe('the stored chat list standing in for the fresh one', () => {
  it('shows while the chats are on their way', () => {
    expect(ids(base)).toEqual(['a', 'b'])
  })

  it('has nothing to show on a first open', () => {
    expect(ids({ ...base, kept: undefined })).toBeUndefined()
  })

  it('stays up after the chats answer only until activity and routines have settled or failed', () => {
    expect(ids({ ...base, chats: 'answered' })).toEqual(['a', 'b'])
    expect(ids({ ...base, chats: 'answered', rest: 'settled' })).toBeUndefined()
  })

  it('steps aside when the chats fail, so the list can say so and offer Retry', () => {
    expect(ids({ ...base, chats: 'failed' })).toBeUndefined()
    expect(ids({ ...base, chats: 'failed', rest: 'settled' })).toBeUndefined()
  })

  it('leaves out a chat archived or deleted meanwhile, including once its Undo has expired', () => {
    // Archived or deleted for good: out of the stored rows' view though they still hold it.
    expect(ids({ ...base, hidden: new Set(['a']) })).toEqual(['b'])
    expect(ids({ ...base, hidden: new Set(['a', 'b']) })).toEqual([])
  })

  it('steps aside for a chat the list does not know, as one made meanwhile', () => {
    expect(ids({ ...base, opened: ['a', 'new'] })).toBeUndefined()
    expect(ids({ ...base, opened: ['a'] })).toEqual(['a', 'b'])
  })
})

describe('what gets stored of a list just shown', () => {
  const chat = { id: 'c', at: 2 }
  const result = { id: 'r', at: 3, result: true }
  const old = { id: 'o', at: 1 }

  it('stores a list with results as it is', () => {
    expect(toKeep([chat], true, [result, old])).toEqual([chat])
  })

  it('keeps stored results from a list without them, in order, and drops stale chats', () => {
    expect(toKeep([chat], false, [result, old])).toEqual([result, chat])
  })

  it('stores a first list without results when nothing is stored yet', () => {
    expect(toKeep([chat], false, undefined)).toEqual([chat])
  })
})
