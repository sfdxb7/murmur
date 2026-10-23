import { beforeAll, describe, expect, it, vi } from 'vitest'

const get = vi.fn(async () => ({ messages: [{ id: 1, role: 'assistant', content: 'Three new emails need you.' }] }))
vi.mock('@/hermes/rest', () => ({ api: { get }, HermesError: class {} }))
vi.mock('@/hermes/instance', () => ({ scoped: (key: string) => key }))

const store = new Map<string, string>()
let routines: typeof import('./routines')
beforeAll(async () => {
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  })
  routines = await import('./routines')
})

describe('what came of a run, kept on this device', () => {
  const run = { id: 'cron_abc_20261023_080000', lastAt: 1000 }

  it('is read from Hermes once, then answered here', async () => {
    const query = routines.runResultQuery('work', run)
    expect(query.initialData()).toBeUndefined()
    expect(await query.queryFn()).toMatchObject({ text: 'Three new emails need you.' })
    expect(routines.runResultQuery('work', run).initialData()).toMatchObject({ text: 'Three new emails need you.' })
    expect(get).toHaveBeenCalledTimes(1)
    expect(store.get('murmur:run-results')).toContain(run.id)
  })

  it('is read again once the run has moved', () => {
    expect(routines.runResultQuery('work', { ...run, lastAt: 2000 }).initialData()).toBeUndefined()
  })

  it('whether a chat is a run is asked once, and still known after a fresh start', async () => {
    get.mockResolvedValueOnce({ source: 'cron', cron_job_id: 'job1' } as never)
    const calls = get.mock.calls.length
    expect(await routines.runOf('work', 'local-abc')).toEqual({ routineId: 'job1' })
    await new Promise((r) => setTimeout(r))
    vi.resetModules()
    const fresh = await import('./routines')
    expect(await fresh.runOf('work', 'local-abc')).toEqual({ routineId: 'job1' })
    expect(get.mock.calls.length).toBe(calls + 1)
  })

  it('keeps only the newest 200', async () => {
    for (let i = 0; i < 205; i++) await routines.runResultQuery('work', { id: `run-${i}`, lastAt: 1 }).queryFn()
    const kept = JSON.parse(store.get('murmur:run-results')!) as [string][]
    expect(kept).toHaveLength(200)
    expect(kept.at(-1)?.[0]).toBe('work/run-204@1')
  })
})
