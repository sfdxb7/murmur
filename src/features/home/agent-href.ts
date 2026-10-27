// Where an agent's roster row goes: the chat its line names (the newest), unless one is waiting on you.

export function agentHref(agentId: string, waitingChatId?: string, newestChatId?: string) {
  const chatId = waitingChatId || newestChatId
  return chatId ? `/chat/${agentId}/${chatId}` : `/chat/${agentId}`
}
