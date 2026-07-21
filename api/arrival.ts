// Vercel 서버리스 함수 래퍼 (프로덕션 경로)
//   코어 handleArrival 을 얇게 감싼다. 로컬 개발은 vite.config 의 개발 미들웨어가 동일 코어를 사용.
//   @vercel/node 타입 의존을 피하려 req/res 를 최소 형태로만 사용한다.

import { handleArrival } from '../server/core/handlers'

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
  const { stationNm } = req.query
  // 도착정보는 초 단위로 바뀜 → 아주 짧은 CDN 캐시만 (§6 캐싱 계층: 도착정보 초 단위)
  res.setHeader('cache-control', 's-maxage=15, stale-while-revalidate=30')
  const { status, body } = await handleArrival({ stationNm: first(stationNm) })
  res.status(status).json(body)
}
