import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setAgentHidden, type Agent } from '@/state/agents'
import { settle } from '@/state/records'

export function useSetAgentHidden() {
  const qc = useQueryClient()
  return async (agent: Agent, hidden: boolean) => {
    try {
      await setAgentHidden(qc, agent.id, hidden)
    } catch {
      toast.error(`Couldn’t ${hidden ? 'hide' : 'unhide'} ${agent.name}. Try again.`)
    } finally {
      settle(qc)
    }
  }
}
