// SK Open API (TMAP 대중교통) 저수준 클라이언트
//   - appKey 는 서버 환경변수(SK_APP_KEY)에만 보관 → 프론트 번들에 절대 노출 안 됨
//   - 프레임워크 무관(순수 fetch). 서버리스 함수/Vite 개발 미들웨어/상시 Node 서버 어디서든 재사용.
//   문서: https://apis.openapi.sk.com/transit/puzzle/subway/congestion/stat/car (칸 혼잡도, GET)
//        https://apis.openapi.sk.com/transit/routes (경로검색, POST) — 좌표 필요, 추후 연동

const SK_BASE = 'https://apis.openapi.sk.com'

export type SkErrorCode = 'no-key' | 'http' | 'quota' | 'shape' | 'network'

/** SK 호출 실패를 코드와 함께 표현 (핸들러에서 상태코드·폴백 판단에 사용) */
export class SkError extends Error {
  code: SkErrorCode
  status?: number
  constructor(message: string, code: SkErrorCode, status?: number) {
    super(message)
    this.name = 'SkError'
    this.code = code
    this.status = status
  }
}

function requireAppKey(): string {
  const key = process.env.SK_APP_KEY
  if (!key) throw new SkError('SK_APP_KEY 환경변수가 설정되지 않았습니다', 'no-key')
  return key
}

/** 응답 객체 어디에 있든 congestionCar 숫자 배열을 재귀로 찾아낸다(래퍼 구조 방어) */
function findCongestionCar(obj: unknown): number[] | null {
  if (obj == null || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const direct = rec['congestionCar']
  if (Array.isArray(direct) && direct.every((v) => typeof v === 'number')) {
    return direct as number[]
  }
  for (const v of Object.values(rec)) {
    const found = findCongestionCar(v)
    if (found) return found
  }
  return null
}

export interface CarCongestionQuery {
  /** 지하철 노선 명칭 (예: "2호선") */
  routeNm: string
  /** 지하철 역 명칭 (예: "성수") */
  stationNm: string
  /** 요청 요일 MON~SUN (선택) */
  dow?: string
  /** 검색 기준 시간 "05"~"23" (선택) */
  hh?: string
}

/**
 * 진입역 기준 칸 혼잡도(통계) 조회.
 *   응답 congestionCar: 칸별 혼잡도 % 배열(한 칸 160명 = 100%).
 */
export async function fetchCarCongestion(q: CarCongestionQuery): Promise<number[]> {
  const appKey = requireAppKey()
  const url = new URL('/transit/puzzle/subway/congestion/stat/car', SK_BASE)
  url.searchParams.set('routeNm', q.routeNm)
  url.searchParams.set('stationNm', q.stationNm)
  if (q.dow) url.searchParams.set('dow', q.dow)
  if (q.hh) url.searchParams.set('hh', q.hh)

  let res: Response
  try {
    res = await fetch(url, { headers: { appKey, accept: 'application/json' } })
  } catch (e) {
    throw new SkError(`SK 네트워크 오류: ${String(e)}`, 'network')
  }
  if (!res.ok) {
    // SK 에러 본문(예: {"error":{"code":"QUOTA_EXCEEDED",...}})을 읽어 진단에 포함
    const detail = await res.text().catch(() => '')
    const code: SkErrorCode = res.status === 429 ? 'quota' : 'http'
    throw new SkError(`SK 응답 오류 ${res.status} ${detail}`.trim(), code, res.status)
  }
  const data = (await res.json()) as unknown
  const cars = findCongestionCar(data)
  if (!cars) throw new SkError('응답에서 congestionCar 배열을 찾지 못함', 'shape')
  return cars
}

export interface RouteCoordQuery {
  /** 출발 경도/위도, 도착 경도/위도 (WGS84, 문자열) */
  startX: string
  startY: string
  endX: string
  endY: string
  /** 최대 경로 수 (1~10) */
  count?: number
}

/**
 * 대중교통 경로검색. 좌표(WGS84)를 받아 SK `POST /transit/routes` 호출.
 *   응답 `metaData.plan.itineraries[]` 를 그대로 반환(정규화는 프론트 어댑터가 담당).
 */
export async function fetchTransitRoutes(q: RouteCoordQuery): Promise<unknown[]> {
  const appKey = requireAppKey()
  const url = new URL('/transit/routes', SK_BASE)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { appKey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        startX: q.startX,
        startY: q.startY,
        endX: q.endX,
        endY: q.endY,
        count: q.count ?? 5,
        format: 'json',
        lang: 0,
      }),
    })
  } catch (e) {
    throw new SkError(`SK 네트워크 오류: ${String(e)}`, 'network')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const code: SkErrorCode = res.status === 429 ? 'quota' : 'http'
    throw new SkError(`SK 응답 오류 ${res.status} ${detail}`.trim(), code, res.status)
  }
  const data = (await res.json()) as { metaData?: { plan?: { itineraries?: unknown } } }
  const it = data?.metaData?.plan?.itineraries
  // 경로 없음이면 빈 배열(있는데 배열이면 그대로), 구조 자체가 없으면 오류
  if (Array.isArray(it)) return it
  throw new SkError('경로 응답에 itineraries 없음', 'shape')
}
