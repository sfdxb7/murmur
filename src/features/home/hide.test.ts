import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Agent } from '@/state/agents'
import type { MenuItem } from './row-menu'

vi.mock('@/hermes/rest', () => ({ api: {} }))
vi.mock('@/hermes/compat', () => ({ listProfiles: vi.fn(), listProfileNames: vi.fn() }))
vi.mock('@/hermes/gateway', () => ({ rpc: vi.fn(), gateway: {} }))
vi.mock('@/hermes/instance', () => ({ scoped: (key: string) => key }))
vi.mock('@/state/timezone', () => ({ ensureAgentTimezone: vi.fn(async () => '') }))
vi.mock('@/state/toolsets', () => ({ hideDesktopToolsets: vi.fn(async () => {}) }))
vi.mock('@/state/umbrel-context', () => ({ ensureUmbrelContext: vi.fn(async () => {}) }))
vi.mock('@/state/umbrel-mcp', () => ({ ensureUmbrelMcp: vi.fn(async () => {}) }))
vi.mock('@/state/mail', () => ({ forgetInheritedMail: vi.fn(async () => {}) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { setAgentHidden, withHideAgent } = await import('./hide')
const { agentHidden, agentsKey } = await import('@/state/agents')
const { rpc } = (await import('@/hermes/gateway')) as unknown as { rpc: ReturnType<typeof vi.fn> }

const scout = (hidden?: boolean): Agent => ({
  id: 'scout',
  name: 'Scout',
  hue: 12,
  role: 'Looks things up',
  isDefault: false,
  botMeta: { title: 'Scout', color: '#4f8', pinned: true, ...(hidden !== undefined && { hidden }) },
  metaRevisions: { 'hermes-bots': 5 },
})

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ ok: true, applied: { ui_meta: true, ui_meta_revisions: { 'hermes-bots': 6 } } })
})

describe('hiding an agent', () => {
  it('writes the flag onto the hermes-bots record, and leaves the rest of it alone', async () => {
    const qc = new QueryClient()
    qc.setQueryData<Agent[]>(agentsKey, [scout()])
    await setAgentHidden(qc, 'scout', true)

    expect(rpc).toHaveBeenCalledWith('profiles.configure', {
      name: 'scout',
      ui_meta: { 'hermes-bots': { title: 'Scout', color: '#4f8', pinned: true, hidden: true } },
      ui_meta_expected_revisions: { 'hermes-bots': 5 },
    })
    const saved = qc.getQueryData<Agent[]>(agentsKey)?.[0]
    expect(agentHidden(saved!)).toBe(true)
    expect(saved?.botMeta).toMatchObject({ title: 'Scout', color: '#4f8', pinned: true })
    expect(saved?.metaRevisions?.['hermes-bots']).toBe(6)
  })

  it('clears the flag to bring the agent back, still without touching its name or colour', async () => {
    const qc = new QueryClient()
    qc.setQueryData<Agent[]>(agentsKey, [scout(true)])
    await setAgentHidden(qc, 'scout', false)

    expect(rpc).toHaveBeenCalledWith(
      'profiles.configure',
      expect.objectContaining({
        ui_meta: { 'hermes-bots': { title: 'Scout', color: '#4f8', pinned: true, hidden: false } },
      }),
    )
    expect(agentHidden(qc.getQueryData<Agent[]>(agentsKey)![0])).toBe(false)
  })
})

describe('Hide agent in a row menu', () => {
  const hide: MenuItem = { label: 'Hide agent', icon: null, onSelect: () => {} }
  const labels = (items: MenuItem[]) => withHideAgent(items, hide).map((item) => item.label)

  it('sits above Delete, and on its own when the row has nothing else', () => {
    expect(labels([])).toEqual(['Hide agent'])
    expect(
      labels([
        { label: 'Edit', icon: null },
        { label: 'Delete', icon: null, danger: true },
      ]),
    ).toEqual(['Edit', 'Hide agent', 'Delete'])
    expect(
      labels([
        { label: 'Pin', icon: null },
        { label: 'Rename', icon: null },
      ]),
    ).toEqual(['Pin', 'Rename', 'Hide agent'])
  })
})
