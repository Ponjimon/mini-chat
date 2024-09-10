import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import invariant from 'tiny-invariant'
import { streamSSE } from 'hono/streaming'
import { getSession } from 'remix-hono/session'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { z } from 'zod'
import { cacheMessages, getCachedMessages } from '~/lib/messages-cache'

const bodySchema = z.object({
  message: z.string(),
})

export const completionRoute = new Hono<{
  Bindings: Env
}>().post('/api/completion', zValidator('json', bodySchema), async (c) => {
  const session = getSession(c)
  const messages = await getCachedMessages(session.id, c.env.KV)
  if (messages.length === 0) {
    messages.push({ role: 'system', content: 'You are a helpful assistant.' })
  }
  const ai = c.env.AI
  const userMessage: RoleScopedChatInput = { role: 'user', content: c.req.valid('json').message }
  const completion = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [...messages, userMessage],
    stream: true,
  })
  invariant(completion instanceof ReadableStream, 'Completion is not a stream')
  const eventStream = completion.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream())

  return streamSSE(c, async (stream) => {
    const reader = eventStream.getReader()
    try {
      let message = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          messages.push(userMessage, { role: 'assistant', content: message })
          await cacheMessages(session.id, messages, c.env.KV)
          break
        }
        const { data } = value
        const isDone = data === '[DONE]'
        const response = isDone ? '' : JSON.parse(data).response
        message += response
        stream.writeSSE({
          data: JSON.stringify({ response, done: isDone }),
        })
      }
    } finally {
      reader.releaseLock()
    }
  })
})
