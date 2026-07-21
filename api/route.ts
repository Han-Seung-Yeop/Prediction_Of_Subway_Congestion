// Vercel 서버리스 함수 래퍼 — 경로검색 프록시.
//   코어 handleRoute 를 얇게 감싼다. 로컬 개발은 vite.config 개발 미들웨어가 동일 코어를 사용.

import { handleRoute } from '../server/core/handlers'

interface MinimalReq {
  query: Record<string, string | string[] | undefined>
}
interface MinimalRes {
  status(code: number): MinimalRes
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  const { startX, startY, endX, endY, count } = req.query
  // 경로는 시간에 따라 바뀌므로 짧게 캐시
  res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=120')
  const { status, body } = await handleRoute({
    startX: first(startX),
    startY: first(startY),
    endX: first(endX),
    endY: first(endY),
    count: first(count),
  })
  res.status(status).json(body)
}
