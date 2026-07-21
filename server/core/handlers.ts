// 프레임워크 무관 요청 핸들러
//   입력: 평범한 쿼리 객체 / 출력: { status, body } 평범한 객체.
//   → 서버리스 함수(Vercel)·Vite 개발 미들웨어·상시 Node 서버(Express)가 모두 이 함수를
//     얇게 감싸기만 하면 된다. (구현계획 §4: 서버리스 우선 → 추후 Node 상향, 코어 재사용)

import { fetchCarCongestion, fetchTransitRoutes, SkError } from './skClient'
import { fetchStationArrivals, SeoulError } from './seoulClient'
import { fetchCultureEvents } from './seoulCultureClient'
import { fetchSportsEvents } from './naverSportsClient'
import type { EventRaw } from './eventTypes'

export interface HandlerResult {
  status: number
  body: unknown
}

function skStatus(code: string): number {
  return code === 'no-key' ? 503 : code === 'quota' ? 429 : 502
}

/** 서울 도착정보 오류코드 → HTTP 상태 (키 미설정/인증=503, 그 외 상류 오류=502) */
function seoulStatus(code: string): number {
  return code === 'no-key' || code === 'auth' ? 503 : 502
}

/** itinerary 에서 프론트 정규화에 불필요한 무거운 필드(passShape/steps)를 제거 */
function slimItinerary(it: unknown): unknown {
  const o = it as Record<string, unknown>
  const legs = Array.isArray(o.legs) ? o.legs : []
  return {
    totalTime: o.totalTime,
    totalWalkTime: o.totalWalkTime,
    transferCount: o.transferCount,
    totalDistance: o.totalDistance,
    fare: o.fare,
    legs: legs.map((leg) => {
      const l = leg as Record<string, unknown>
      const pass = l.passStopList as { stations?: unknown[] } | undefined
      const stations = Array.isArray(pass?.stations) ? pass!.stations : undefined
      return {
        mode: l.mode,
        sectionTime: l.sectionTime,
        distance: l.distance,
        route: l.route,
        routeColor: l.routeColor,
        start: l.start,
        end: l.end,
        passStopList: stations
          ? {
              stations: stations.map((s) => {
                const st = s as Record<string, unknown>
                return { stationName: st.stationName, lat: st.lat, lon: st.lon, index: st.index }
              }),
            }
          : undefined,
      }
    }),
  }
}

/** GET /api/congestion?routeNm=&stationNm=&dow=&hh= */
export async function handleCongestion(query: Record<string, string | undefined>): Promise<HandlerResult> {
  const routeNm = query.routeNm?.trim()
  const stationNm = query.stationNm?.trim()
  if (!routeNm || !stationNm) {
    return { status: 400, body: { error: 'routeNm, stationNm 파라미터가 필요합니다' } }
  }
  try {
    const cars = await fetchCarCongestion({
      routeNm,
      stationNm,
      dow: query.dow,
      hh: query.hh,
    })
    return { status: 200, body: { source: 'sk-realtime', routeNm, stationNm, cars } }
  } catch (e) {
    const code = e instanceof SkError ? e.code : 'network'
    // no-key(미설정)=503, 쿼터초과=429, 그 외 상류 오류=502. 프론트는 실패 시 추정치로 폴백한다.
    return { status: skStatus(code), body: { error: e instanceof Error ? e.message : String(e), code } }
  }
}

/** GET /api/route?startX=&startY=&endX=&endY=&count= */
export async function handleRoute(query: Record<string, string | undefined>): Promise<HandlerResult> {
  const { startX, startY, endX, endY } = query
  if (!startX || !startY || !endX || !endY) {
    return { status: 400, body: { error: 'startX, startY, endX, endY 좌표가 필요합니다' } }
  }
  try {
    const raw = await fetchTransitRoutes({
      startX,
      startY,
      endX,
      endY,
      count: query.count ? Number(query.count) : 5,
    })
    return { status: 200, body: { itineraries: raw.map(slimItinerary) } }
  } catch (e) {
    const code = e instanceof SkError ? e.code : 'network'
    return { status: skStatus(code), body: { error: e instanceof Error ? e.message : String(e), code } }
  }
}

/** GET /api/arrival?stationNm= */
export async function handleArrival(query: Record<string, string | undefined>): Promise<HandlerResult> {
  const stationNm = query.stationNm?.trim()
  if (!stationNm) {
    return { status: 400, body: { error: 'stationNm 파라미터가 필요합니다' } }
  }
  try {
    const arrivals = await fetchStationArrivals(stationNm)
    // 도착 예정 열차가 없어도(빈 배열) 200 — 프론트가 노선/방향 필터 후 없으면 목업으로 폴백한다.
    return { status: 200, body: { source: 'seoul-realtime', stationNm, arrivals } }
  } catch (e) {
    const code = e instanceof SeoulError ? e.code : 'network'
    return { status: seoulStatus(code), body: { error: e instanceof Error ? e.message : String(e), code } }
  }
}

/** KST 기준 오늘 날짜(YYYY-MM-DD) — 서버 타임존과 무관 */
function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * GET /api/events?date=YYYY-MM-DD
 *   서울 문화행사(공연/축제/전시) + 네이버 스포츠(KBO/K리그)를 합쳐 그 날짜의 이벤트를 반환.
 *   두 소스는 독립적으로 조회(allSettled) — 한쪽이 실패해도 다른 쪽은 반환한다.
 *   역 매핑·delta 산출은 프론트가 수행(좌표·역 디렉터리·룰이 프론트에 있음).
 */
export async function handleEvents(query: Record<string, string | undefined>): Promise<HandlerResult> {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date?.trim() ?? '') ? query.date!.trim() : todayKst()
  const [cultureR, sportsR] = await Promise.allSettled([
    fetchCultureEvents(date),
    fetchSportsEvents(date),
  ])
  const events: EventRaw[] = []
  const errors: Record<string, string> = {}
  if (cultureR.status === 'fulfilled') events.push(...cultureR.value)
  else errors.culture = cultureR.reason instanceof Error ? cultureR.reason.message : String(cultureR.reason)
  if (sportsR.status === 'fulfilled') events.push(...sportsR.value)
  else errors.sports = sportsR.reason instanceof Error ? sportsR.reason.message : String(sportsR.reason)

  // 두 소스 모두 실패면 502 (프론트는 목업으로 폴백)
  if (cultureR.status === 'rejected' && sportsR.status === 'rejected') {
    return { status: 502, body: { error: '이벤트 소스 조회 실패', errors } }
  }
  return { status: 200, body: { date, events, errors } }
}
