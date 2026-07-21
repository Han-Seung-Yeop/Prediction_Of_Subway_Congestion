// SK/TMAP 대중교통 경로검색 구현체 — 프록시(/api/route) 호출 → RoutePlan 정규화.
//   - 지하철 전용(버스 없는) 경로를 우선한다(앱이 칸별 혼잡도 중심).
//   - SK leg 의 역명/노선명을 우리 역 id/lineId 로 해석(resolveStationId, 없으면 임시 등록).
//   - 좌표 없음/오류 시 mock 라우팅으로 폴백. (구현계획 §4 경로검색)

import type { RouteLeg, RoutePlan } from '../data/types'
import { getStation, resolveStationId, registerLineIfAbsent } from '../data/subway'
import { lineIdForKorean } from '../data/stationDirectory'
import { mockRouteProvider, type RouteProvider } from './routing'

interface SkPassStation {
  stationName: string
  lat: string
  lon: string
  index?: number
}
interface SkLeg {
  mode: string
  sectionTime: number
  distance?: number
  route?: string
  routeColor?: string
  start: { name: string; lat: number; lon: number }
  end: { name: string; lat: number; lon: number }
  passStopList?: { stations: SkPassStation[] }
}
interface SkItinerary {
  totalTime: number
  totalWalkTime: number
  transferCount: number
  legs: SkLeg[]
}

const toMin = (sec: number) => Math.round(sec / 60)

/** 지하철 구간만으로 이뤄진 경로(도보 제외) — 버스 없는 경로를 우선하기 위한 판별 */
function isSubwayOnly(it: SkItinerary): boolean {
  return (
    it.legs.every((l) => l.mode === 'WALK' || l.mode === 'SUBWAY') &&
    it.legs.some((l) => l.mode === 'SUBWAY')
  )
}

function lineShort(lineId: string, route: string): string {
  const m = lineId.match(/^line(\d)$/)
  if (m) return m[1]
  return route.replace(/\s+/g, '').replace(/^수도권/, '').replace(/선$/, '').slice(0, 2)
}
function lineLabel(lineId: string, route: string): string {
  const m = lineId.match(/^line(\d)$/)
  if (m) return `${m[1]}호선`
  return route.replace(/\s+/g, '').replace(/^수도권/, '')
}

async function fetchItineraries(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<SkItinerary[]> {
  const params = new URLSearchParams({
    startX: String(from.lng),
    startY: String(from.lat),
    endX: String(to.lng),
    endY: String(to.lat),
    count: '5',
  })
  const res = await fetch(`/api/route?${params.toString()}`)
  if (!res.ok) throw new Error(`route proxy ${res.status}`)
  const data = (await res.json()) as { itineraries?: SkItinerary[] }
  return data.itineraries ?? []
}

/** SK itinerary → 내부 RoutePlan (지하철 leg 만, WALK 는 다음 leg 의 환승 도보로 접음) */
function normalizeItinerary(it: SkItinerary): RoutePlan | null {
  const legs: RouteLeg[] = []
  let pendingWalk = 0
  let seenSubway = false

  for (const leg of it.legs) {
    if (leg.mode === 'WALK') {
      if (seenSubway) pendingWalk += toMin(leg.sectionTime) // 선행 접근 도보는 leg 에 안 붙임
      continue
    }
    if (leg.mode !== 'SUBWAY') continue

    const route = leg.route ?? ''
    const lineId = lineIdForKorean(route)
    if (leg.routeColor) {
      registerLineIfAbsent({
        id: lineId,
        name: lineShort(lineId, route),
        label: lineLabel(lineId, route),
        color: `#${leg.routeColor}`,
      })
    }

    const boardId = resolveStationId(leg.start.name, lineId, leg.start.lat, leg.start.lon)
    const alightId = resolveStationId(leg.end.name, lineId, leg.end.lat, leg.end.lon)
    const stations = leg.passStopList?.stations ?? []
    const stationIds = stations.length
      ? stations.map((s) => resolveStationId(s.stationName, lineId, +s.lat, +s.lon))
      : [boardId, alightId]

    const bo = getStation(boardId)?.order
    const ao = getStation(alightId)?.order
    const direction: 'up' | 'down' = bo != null && ao != null ? (ao > bo ? 'up' : 'down') : 'up'

    legs.push({
      lineId,
      boardStationId: boardId,
      alightStationId: alightId,
      direction,
      stationIds,
      numStations: Math.max(1, stationIds.length - 1),
      rideMinutes: toMin(leg.sectionTime),
      transferWalkMinutes: pendingWalk,
    })
    pendingWalk = 0
    seenSubway = true
  }

  if (legs.length === 0) return null
  return {
    id: legs.map((l) => l.boardStationId).join('>'),
    legs,
    totalMinutes: toMin(it.totalTime),
    transferCount: legs.length - 1,
    walkMinutes: toMin(it.totalWalkTime),
    score: it.totalTime, // SK 정렬을 1차로 신뢰
  }
}

export const skRouteProvider: RouteProvider = {
  async findRoutes(fromId, toId, departAt) {
    const from = getStation(fromId)
    const to = getStation(toId)
    if (from?.lat == null || from?.lng == null || to?.lat == null || to?.lng == null) {
      return mockRouteProvider.findRoutes(fromId, toId, departAt) // 좌표 없으면 폴백
    }
    try {
      const its = await fetchItineraries(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng },
      )
      const subwayOnly = its.filter(isSubwayOnly)
      const plans = subwayOnly
        .slice(0, 3)
        .map(normalizeItinerary)
        .filter((p): p is RoutePlan => p !== null)
      return plans
    } catch {
      return mockRouteProvider.findRoutes(fromId, toId, departAt)
    }
  },
}
