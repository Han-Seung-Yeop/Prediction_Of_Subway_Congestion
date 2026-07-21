import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleCongestion, handleRoute, handleArrival, handleEvents } from './server/core/handlers'

// 개발 서버(/api/*)용 미들웨어 — 프로덕션 Vercel 함수(api/)와 동일한 코어(handlers)를 재사용.
//   서버 전용 키(SK_APP_KEY)는 process.env 로만 흐르며 클라이언트 번들에 포함되지 않는다.
function apiDevPlugin(): Plugin {
  return {
    name: 'crowdcast-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const isCongestion = req.url.startsWith('/api/congestion')
        const isRoute = req.url.startsWith('/api/route')
        const isArrival = req.url.startsWith('/api/arrival')
        const isEvents = req.url.startsWith('/api/events')
        if (!isCongestion && !isRoute && !isArrival && !isEvents) return next()
        try {
          const url = new URL(req.url, 'http://localhost')
          const query = Object.fromEntries(url.searchParams)
          const { status, body } = isCongestion
            ? await handleCongestion(query)
            : isArrival
              ? await handleArrival(query)
              : isEvents
                ? await handleEvents(query)
                : await handleRoute(query)
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: String(e), code: 'dev-middleware' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env / .env.local 의 서버 전용 변수를 process.env 로 주입 (Vite 는 기본적으로 안 넣음).
  //   VITE_ 접두사가 아닌 SK_APP_KEY 도 로드하기 위해 prefix '' 로 전체 로드.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.SK_APP_KEY) process.env.SK_APP_KEY = env.SK_APP_KEY
  if (env.SEOUL_OPENAPI_KEY) process.env.SEOUL_OPENAPI_KEY = env.SEOUL_OPENAPI_KEY

  return {
    plugins: [react(), apiDevPlugin()],
    server: {
      port: 5173,
      host: true,
    },
  }
})
