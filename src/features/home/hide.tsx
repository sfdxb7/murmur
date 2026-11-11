import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { agentsKey, type Agent } from '@/state/agents'
import { settle, writeRecord } from '@/state/records'
import type { MenuItem } from './row-menu'

/**
 * Hide an agent, or bring it back. Only its flag on the hermes-bots record
 * changes, the same record that already carries its name and colour, so the
 * choice follows the agent to every device signed in to this Hermes.
 */
export async function setAgentHidden(qc: QueryClient, id: string, hidden: boolean) {
  await qc.cancelQueries({ queryKey: agentsKey })
  await writeRecord(qc, id, 'hermes-bots', (agent) => ({ ...agent.botMeta, hidden }))
}

export function useSetAgentHidden() {
  const qc = useQueryClient()
  return async (agent: Agent, hidden: boolean) => {
    try {
      await setAgentHidden(qc, agent.id, hidden)
      toast.success(hidden ? `${agent.name} is hidden` : `${agent.name} is back`)
    } catch {
      toast.error(`Couldn’t ${hidden ? 'hide' : 'unhide'} ${agent.name}. Try again.`)
    } finally {
      settle(qc)
    }
  }
}

/** "Hide agent", for a row's menu. */
export function useHideAgentItem(agent: Agent): MenuItem {
  const setHidden = useSetAgentHidden()
  return {
    label: 'Hide agent',
    icon: <EyeOff size={18} strokeWidth={1.85} />,
    onSelect: () => void setHidden(agent, true),
  }
}

/** Puts Hide agent just above the destructive items, so Delete stays last. */
export function withHideAgent(items: MenuItem[], hide: MenuItem): MenuItem[] {
  const at = items.findIndex((item) => item.danger)
  if (at < 0) return [...items, hide]
  return [...items.slice(0, at), hide, ...items.slice(at)]
}
