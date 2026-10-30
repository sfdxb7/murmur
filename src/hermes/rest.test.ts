import { beforeEach, describe, expect, it, vi } from 'vitest'

const g = globalThis as { document?: { cookie: string } }
g.document = { cookie: '' }

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { api } = await import('./rest')

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  fetchMock.mockReset()
})

describe('GET /api/config', () => {
  it('collapses the 18 cold-open reads to one per profile', async () => {
    const profiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'main']
    let gets = 0
    fetchMock.mockImplementation(async () => {
      gets += 1
      return ok({ timezone: 'UTC' })
    })
    // Eight agents, each read by timezone and by toolsets, plus two more reads of main. Was 18 fetches.
    for (const profile of profiles) {
      await api.get(`/api/config?profile=${profile}&include_defaults=false`)
      await api.get(`/api/config?profile=${profile}&include_defaults=false`)
    }
    await api.get('/api/config?profile=main&include_defaults=false')
    await api.get('/api/config?profile=main&include_defaults=false')
    expect(gets).toBe(profiles.length)
  })

  it('shares one in-flight read', async () => {
    let release: (res: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => {
      release = resolve
    }))
    const first = api.get<{ timezone: string }>('/api/config?profile=bee&include_defaults=false')
    const second = api.get<{ timezone: string }>('/api/config?profile=bee&include_defaults=false')
    release(ok({ timezone: 'UTC' }))
    expect(await Promise.all([first, second])).toEqual([{ timezone: 'UTC' }, { timezone: 'UTC' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('drops a copy that overlapped a write', async () => {
    let release: (res: Response) => void = () => {}
    let gets = 0
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') !== 'GET') return Promise.resolve(ok({ ok: true }))
      gets += 1
      if (gets === 1) return new Promise<Response>((resolve) => {
        release = resolve
      })
      return Promise.resolve(ok({ timezone: 'fresh' }))
    })
    const first = api.get<{ timezone: string }>('/api/config?profile=ada&include_defaults=false')
    await api.put('/api/config?profile=ada', { config: { timezone: 'Asia/Dubai' } })
    release(ok({ timezone: 'stale' }))
    expect(await first).toEqual({ timezone: 'stale' })
    expect(await api.get<{ timezone: string }>('/api/config?profile=ada&include_defaults=false')).toEqual({ timezone: 'fresh' })
    expect(gets).toBe(2)
  })

  it('refetches a profile after a minute', async () => {
    let now = 1_000_000
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      fetchMock.mockImplementation(async () => ok({ n: fetchMock.mock.calls.length }))
      await api.get('/api/config?profile=ttl&include_defaults=false')
      now += 59_000
      await api.get('/api/config?profile=ttl&include_defaults=false')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      now += 2_000
      await api.get('/api/config?profile=ttl&include_defaults=false')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      clock.mockRestore()
    }
  })

  it('does not cache a failed read or any other GET', async () => {
    fetchMock.mockResolvedValueOnce(new Response('no', { status: 500 }))
    await expect(api.get('/api/config?profile=err&include_defaults=false')).rejects.toThrow()
    fetchMock.mockImplementation(async () => ok({ sessions: [] }))
    await api.get('/api/config?profile=err&include_defaults=false')
    await api.get('/api/sessions?limit=1')
    await api.get('/api/sessions?limit=1')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
