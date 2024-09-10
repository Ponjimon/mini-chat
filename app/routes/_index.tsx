import { zodResolver } from '@hookform/resolvers/zod'
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/cloudflare'
import { Form, useFetcher, useLoaderData } from '@remix-run/react'
import { events } from 'fetch-event-stream'
import { hc } from 'hono/client'
import { AlertTriangle, Bot, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Message } from '~/components/Message'
import { Spinner } from '~/components/Spinner'
import { Button } from '~/components/ui/button'
import { FormField } from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { ScrollArea } from '~/components/ui/scroll-area'
import { clearMessagesCache, getCachedMessages } from '~/lib/messages-cache'

import type { AppType } from '../../server'
import { scrollToBottom } from '~/lib/utils'

type ChatMessage = {
  id: string
  role: RoleScopedChatInput['role']
  text: ReactNode
  done: boolean
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Mini Chat' },
    {
      name: 'description',
      content: 'Welcome to Remix on Cloudflare!',
    },
  ]
}

export const action = async (args: ActionFunctionArgs) => {
  await clearMessagesCache(args.context.session.id, args.context.cloudflare.env.KV)
  return json({ success: true })
}

export const loader = async (args: LoaderFunctionArgs) => {
  const messages = await getCachedMessages(args.context.session.id, args.context.cloudflare.env.KV)
  const chatMessages = messages.slice(1).map<Omit<ChatMessage, 'text'> & { text: string }>((msg) => ({
    done: true,
    id: crypto.randomUUID(),
    role: msg.role,
    text: msg.content,
  }))
  return json({
    messages: chatMessages,
  })
}

const formSchema = z.object({
  message: z.string().min(1),
})

const responseSchema = z.object({
  response: z.string(),
  done: z.boolean(),
})

const client = hc<AppType>('/')

export default function Index() {
  const scrollRef = useRef<HTMLUListElement>(null)
  const { messages: data } = useLoaderData<typeof loader>()
  const [messages, setMessages] = useState<ChatMessage[]>(() => data)
  const fetcher = useFetcher()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: '',
    },
  })
  const { setValue, reset } = form

  const retry = () => {
    const lastUserMessage = messages.at(-2)
    if (!lastUserMessage || typeof lastUserMessage?.text !== 'string') {
      return
    }
    setMessages((prev) => {
      // Delete the last two messages
      const newMessages = [...prev]
      newMessages.pop()
      newMessages.pop()
      return newMessages
    })
    onSubmit({ message: lastUserMessage.text })
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const messageId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: data.message, done: true },
      { id: messageId, role: 'system', text: '', done: false },
    ])

    setValue('message', '')

    const abort = new AbortController()
    const res = await client.api.completion.$post(
      { json: { message: data.message } },
      { init: { signal: abort.signal } },
    )

    if (!res.ok) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                text: (
                  <div className="flex flex-row gap-2 items-center">
                    <AlertTriangle className="size-4" aria-hidden />
                    <span>Error: {res.statusText}</span>
                  </div>
                ),
                done: true,
              }
            : msg,
        ),
      )
      return
    }

    const stream = events(res, abort.signal)

    for await (const event of stream) {
      if (!event.data) continue
      const { response, done } = responseSchema.parse(JSON.parse(event.data))
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, text: msg.text + response, done } : msg)),
      )
    }

    reset()
  }

  const handleClear: FormEventHandler<HTMLFormElement> = async (e) => {
    setMessages([])
    fetcher.submit(e.currentTarget, { method: 'POST' })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies(messages): Trigger scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom(scrollRef.current, true)
  }, [messages])

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Mini Chat</h1>
          </div>
        </header>
        <ScrollArea className="flex-grow p-4">
          <ul className="max-w-2xl mx-auto" ref={scrollRef}>
            {messages.map((message) => (
              <li key={message.id}>
                <Message role={message.role} isLoading={!message.done} onRetry={retry}>
                  {message.text}
                </Message>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="border-t p-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <div className="flex-1 flex flex-col gap-2">
                  <form onSubmit={form.handleSubmit(onSubmit)} id="chat-form">
                    <Input placeholder="Say something..." {...field} />
                  </form>
                  <Form method="post" id="clear-form" navigate={false} onSubmit={handleClear}>
                    <div className="text-right text-sm text-muted-foreground">
                      <button type="submit" form="clear-form">
                        Clear
                      </button>
                    </div>
                  </Form>
                </div>
              )}
            />
            <Button type="submit" form="chat-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
