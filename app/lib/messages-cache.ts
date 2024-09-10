export const getCachedMessages = async (sessionId: string, kv: KVNamespace<string>) => {
  const cachedMessages = await kv.get<RoleScopedChatInput[]>(`${sessionId}:messages`, 'json')
  return cachedMessages ?? []
}

export const cacheMessages = async (sessionId: string, messages: RoleScopedChatInput[], kv: KVNamespace<string>) => {
  await kv.put(`${sessionId}:messages`, JSON.stringify(messages), { expirationTtl: 60 * 60 * 24 * 7 })
}

export const clearMessagesCache = async (sessionId: string, kv: KVNamespace<string>) => {
  await kv.delete(`${sessionId}:messages`)
}
