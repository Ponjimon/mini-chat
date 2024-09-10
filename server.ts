import type { AppLoadContext, RequestHandler } from '@remix-run/cloudflare'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import { staticAssets, workerKVSession } from 'remix-hono/cloudflare'
import { remix } from 'remix-hono/handler'
import { completionRoute } from '~/routes/api/completion'
import { getSession } from 'remix-hono/session'

const app = new Hono<{
  Bindings: Env
}>()

let handler: RequestHandler | undefined

app.use(secureHeaders())
app.use('/api/*', cors())
app.use(
  '*',
  workerKVSession({
    autoCommit: true, // same as in the session middleware
    cookie: {
      name: 'session', // all cookie options as in createWorkerKVSessionStorage
      // In this function, you can access c.env to get the session secret
      httpOnly: true,
      // Allow 7 day sessions
      maxAge: 3600 * 24 * 7,
      sameSite: 'strict',
      secure: true,
      secrets(c) {
        return [c.env.SESSION_SECRET]
      },
    },
    // The name of the binding using for the KVNamespace
    binding: 'KV',
  }),
)

const routes = app.route('/', completionRoute)

app.use(
  async (c, next) => {
    if (process.env.NODE_ENV !== 'development' || import.meta.env.PROD) {
      return staticAssets()(c, next)
    }
    await next()
  },
  async (c, next) => {
    if (process.env.NODE_ENV !== 'development' || import.meta.env.PROD) {
      const serverBuild = await import('./build/server')
      return remix({
        build: serverBuild,
        mode: 'production',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        getLoadContext(c) {
          return {
            cloudflare: {
              env: c.env,
            },
            session: getSession(c),
          }
        },
      })(c, next)
    }
    if (!handler) {
      // @ts-expect-error it's not typed
      const build = await import('virtual:remix/server-build')
      const { createRequestHandler } = await import('@remix-run/cloudflare')
      handler = createRequestHandler(build, 'development')
    }
    const remixContext = {
      cloudflare: {
        env: c.env,
      },
      session: getSession(c),
    } as unknown as AppLoadContext
    return handler(c.req.raw, remixContext)
  },
)

export type AppType = typeof routes

export default app
