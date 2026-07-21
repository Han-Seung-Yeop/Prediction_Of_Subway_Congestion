// 라이브 이벤트 구현체 — 프록시(/api/events) 호출 → CrowdEvent 정규화.
//   서버가 준 좌표를 최근접 역으로 매핑하고, 룰 기반 delta를 부여한다.
//   실패 시 목업으로 폴백. (서울 문화행사=공식, 네이버 스포츠=비공식 → 캐시+폴백으로 방어)

import type { CrowdEvent } from '../data/types'
import { directoryStations } from '../data/stationDirectory'
import { mockEventProvider, type EventProvider } from './events'

/** /api/events 응답 항목 (server/core/eventTypes.ts EventRaw 와 대응) */
interface EventApiItem {
  source: 'culture' | 'kbo' | 'kleague'
  type: 'concert' | 'festival' | 'sports'
  title: string
  category: string
  venue: string
  lat: number
  lng: number
  start: string
  end?: string
  isFree?: boolean
  imageUrl?: string
}

/** 이벤트가 역 혼잡에 영향을 준다고 볼 최대 거리(km). 넘으면 매핑 제외(지방 경기장 등 자동 배제) */
const MAX_STATION_KM = 1.5

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** 좌표에서 가장 가까운 역(디렉터리 전 역). 임계 거리 초과면 null */
function nearestStation(lat: number, lng: number): { name: string; lineId: string; km: number } | null {
  let best: { name: string; lineId: string; km: number } | null = null
  for (const s of directoryStations) {
    if (s.lat == null || s.lng == null) continue
    const km = haversineKm(lat, lng, s.lat, s.lng)
    if (!best || km < best.km) best = { name: s.name, lineId: s.lineId, km }
  }
  if (!best || best.km > MAX_STATION_KM) return null
  return best
}

/** 룰 기반 혼잡 증가분(%p) — 유형·분류로 산출(ML 아님, 접근 A) */
function deltaFor(item: EventApiItem): number {
  if (item.type === 'sports') return item.source === 'kbo' ? 42 : 38 // 야구/축구 관중 대량
  if (item.type === 'concert') return 30 // 공연·콘서트·뮤지컬·클래식
  if (/축제/.test(item.category)) return 28 // 축제
  return 12 // 전시/미술·교육/체험·기타
}

/** 시작/종료 → 사람이 읽는 라벨. 오늘 시작/내일/진행 중(다일)/날짜 */
function timeLabel(startISO: string, endDate: string | undefined, todayISO: string): string {
  const datePart = startISO.slice(0, 10)
  const timeMatch = /T(\d{2}):(\d{2})/.exec(startISO)
  const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : ''
  // 시작일이 지났지만 종료일이 오늘 이후면 진행 중(다일 전시 등)
  if (datePart < todayISO && endDate && endDate >= todayISO) {
    return time ? `진행 중 · ${time}` : '진행 중'
  }
  const dayMs = 86400000
  const diff = Math.round((Date.parse(datePart) - Date.parse(todayISO)) / dayMs)
  const dayLabel = diff === 0 ? '오늘' : diff === 1 ? '내일' : `${datePart.slice(5).replace('-', '/')}`
  return time ? `${dayLabel} ${time}` : dayLabel
}

function toCrowdEvent(item: EventApiItem, idx: number, todayISO: string): CrowdEvent | null {
  const near = nearestStation(item.lat, item.lng)
  if (!near) return null // 가까운 역이 없는(지방 등) 이벤트는 제외
  return {
    id: `live-${item.source}-${idx}-${item.start}`,
    type: item.type,
    category: item.category,
    title: item.title,
    venue: item.venue,
    stationName: near.name,
    lineId: near.lineId,
    when: item.start,
    timeLabel: timeLabel(item.start, item.end, todayISO),
    delta: deltaFor(item),
  }
}

export const liveEventProvider: EventProvider = {
  async forDate(date) {
    try {
      const res = await fetch(`/api/events?date=${encodeURIComponent(date)}`)
      if (!res.ok) throw new Error(`events proxy ${res.status}`)
      const data = (await res.json()) as { events?: EventApiItem[] }
      const items = Array.isArray(data.events) ? data.events : []
      const mapped = items
        .map((it, i) => toCrowdEvent(it, i, date))
        .filter((e): e is CrowdEvent => e !== null)
      mapped.sort((a, b) => b.delta - a.delta)
      return mapped.slice(0, 12)
    } catch {
      return mockEventProvider.forDate(date)
    }
  },
}
