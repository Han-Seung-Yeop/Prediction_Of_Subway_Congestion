// Vercel 서버리스 함수 래퍼 (프로덕션 경로)
//   코어 handleCongestion 을 얇게 감싼다. 로컬 개발은 vite.config 의 개발 미들웨어가 동일 코어를 사용.
//   @vercel/node 타입 의존을 피하려 req/res 를 최소 형태로만 사용한다.

import { handleCongestion } from '../server/core/handlers'

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
  const { routeNm, stationNm, dow, hh } = req.query
  // 혼잡도(통계)는 값이 자주 안 바뀜 → CDN/프록시 캐시 힌트(§6 캐싱 계층 1차)
  res.setHeader('cache-control', 's-maxage=600, stale-while-revalidate=1800')
  const { status, body } = await handleCongestion({
    routeNm: first(routeNm),
    stationNm: first(stationNm),
    dow: first(dow),
    hh: first(hh),
  })
  res.status(status).json(body)
}
