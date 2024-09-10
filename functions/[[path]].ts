import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - the server build file is generated by `remix vite:build`
// eslint-disable-next-line import/no-unresolved
import * as build from '../build/server'
import { sessionWrapper } from '~/session.server'

export const onRequest = async (context: EventContext<Env, string, unknown>) => {
  context.request.headers.get('cookie')

  const sessionStorage = sessionWrapper({
    kv: context.env.KV,
    sessionSecret: context.env.SESSION_SECRET,
  })
  const session = await sessionStorage.getSession(context.request.headers.get('cookie'))

  const handleRequest = createPagesFunctionHandler({
    build,
    getLoadContext: ({ context }) => ({
      ...context,
      session,
    }),
  })

  const response = await handleRequest(context)

  response.headers.append('Set-Cookie', await sessionStorage.commitSession(session))

  return response
}
