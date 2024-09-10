import { vitePlugin as remix, cloudflareDevProxyVitePlugin as remixCloudflareDevProxy } from '@remix-run/dev'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { sessionWrapper } from './app/session.server'

export default defineConfig({
  plugins: [
    remixCloudflareDevProxy({
      getLoadContext: async ({ context, request }) => {
        const env = context.cloudflare.env as Env
        const sessionStorage = sessionWrapper({
          kv: env.KV,
          sessionSecret: env.SESSION_SECRET,
        })
        const session = await sessionStorage.getSession(request.headers.get('cookie'))
        return {
          ...context,
          cloudflare: {
            ...context.cloudflare,
            env,
            cf: context.cloudflare.cf as IncomingRequestCfProperties,
          },
          session,
        }
      },
    }),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
})
