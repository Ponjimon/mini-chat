import type { ActionFunctionArgs } from '@remix-run/cloudflare'
import { eventStream as sse } from 'remix-utils/sse/server'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import { cacheMessages, getCachedMessages } from '~/lib/messages-cache'

const bodySchema = z.object({
  message: z.string(),
})

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const r = await request.json()
  const { message } = bodySchema.parse(r)
  const { session } = context
  const messages = await getCachedMessages(session.id, context.cloudflare.env.KV)
  if (messages.length === 0) {
    messages.push({ role: 'system', content: 'You are a helpful assistant.' })
  }

  const ai = context.cloudflare.env.AI
  const userMessage: RoleScopedChatInput = { role: 'user', content: message }
  const completion = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [...messages, userMessage],
    stream: true,
  })
  invariant(completion instanceof ReadableStream, 'Completion is not a stream')
  const eventStream = completion.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream())

  return sse(request.signal, (send, close) => {
    const reader = eventStream.getReader()
    const run = async () => {
      try {
        let message = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            messages.push(userMessage, { role: 'assistant', content: message })
            await cacheMessages(session.id, messages, context.cloudflare.env.KV)
            break
          }
          const { data } = value
          const isDone = data === '[DONE]'
          const response = isDone ? '' : JSON.parse(data).response
          message += response
          send({
            data: JSON.stringify({ response, done: isDone }),
          })
        }
      } finally {
        reader.releaseLock()
        close()
      }
    }
    run()

    return () => {
      reader?.releaseLock()
    }
  })
}

export type Action = typeof action
