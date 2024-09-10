import { createWorkersKVSessionStorage } from '@remix-run/cloudflare'

export const sessionWrapper = ({ kv, sessionSecret }: { kv: KVNamespace<string>; sessionSecret: string }) =>
  createWorkersKVSessionStorage({
    kv,
    cookie: {
      name: 'session',
      httpOnly: true,
      // Allow 7 day sessions
      maxAge: 3600 * 24 * 7,
      sameSite: 'strict',
      secure: true,
      secrets: [sessionSecret],
    },
  })
