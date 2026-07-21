// Vercel 서버리스 함수 래퍼 (프로덕션 경로)
//   코어 handleEvents 를 얇게 감싼다. 로컬 개발은 vite.config 의 개발 미들웨어가 동일 코어를 사용.

import { handleEvents } from '../server/core/handlers'

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
  const { date } = req.query
  // 이벤트 일정은 분~시간 단위로만 바뀜 → 중간 정도 CDN 캐시
  res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=1800')
  const { status, body } = await handleEvents({ date: first(date) })
  res.status(status).json(body)
}
