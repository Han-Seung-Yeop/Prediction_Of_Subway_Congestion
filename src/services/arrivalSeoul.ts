// 서울 열린데이터광장 실시간 도착정보 구현체 — 프록시(/api/arrival) 호출 → ArrivalInfo 정규화.
//   서울 API는 한 역의 "모든 노선·양방향" 열차를 돌려주므로, 선택된 (노선, 방향)으로 걸러 가장 이른 열차를 고른다.
//   키 미설정/인증오류/빈응답/막차 이후 등 어떤 경우든 목업으로 폴백한다. → 배너가 절대 비지 않음.
//   (구현계획 §7-5, 폴백 방침: 항상 목업으로)

import { toSeoulStationNm, lineToSeoulSubwayId, directionMatchesUpdn } from '../data/stationNaming'
import { mockArrivalProvider, type ArrivalProvider, type ArrivalInfo } from './arrival'

/** /api/arrival 응답의 도착 항목 (server/core/seoulClient.ts StationArrival 과 대응) */
interface ArrivalItem {
  subwayId: string
  updnLine: string
  trainLineNm: string
  bstatnNm: string
  barvlDt: number | null
  arvlMsg2: string
  arvlMsg3: string
  arvlCd: string
}

interface ArrivalApiResponse {
  source: 'seoul-realtime'
  stationNm: string
  arrivals: ArrivalItem[]
}

/** 프록시에서 역 도착 목록을 받아온다. 실패 시 throw. */
async function fetchArrivals(stationNm: string): Promise<ArrivalItem[]> {
  const params = new URLSearchParams({ stationNm })
  const res = await fetch(`/api/arrival?${params.toString()}`)
  if (!res.ok) throw new Error(`arrival proxy ${res.status}`)
  const data = (await res.json()) as ArrivalApiResponse
  if (!Array.isArray(data.arrivals)) throw new Error('빈 도착 응답')
  return data.arrivals
}

/** 효과적 잔여 초 (null=진입/도착 중 → 0으로 취급, 가장 이른 것). */
const effectiveSeconds = (a: ArrivalItem): number => a.barvlDt ?? 0

export const seoulArrivalProvider: ArrivalProvider = {
  async next(query) {
    const { line, station, direction } = query
    try {
      const all = await fetchArrivals(toSeoulStationNm(station.name))

      // 1) 노선 필터 (subwayId). 코드를 못 구하면 노선 필터는 생략.
      const subwayId = lineToSeoulSubwayId(line)
      const byLine = subwayId ? all.filter((a) => a.subwayId === subwayId) : all

      // 2) 방향 필터 (updnLine ↔ direction.label). 일치가 없으면 노선 결과 전체로 완화.
      const byDir = byLine.filter((a) => directionMatchesUpdn(direction.label, a.updnLine))
      const candidates = byDir.length > 0 ? byDir : byLine

      if (candidates.length === 0) return mockArrivalProvider.next(query)

      // 3) 가장 이른 열차 선택
      const soonest = candidates.reduce((min, a) =>
        effectiveSeconds(a) < effectiveSeconds(min) ? a : min,
      )
      const info: ArrivalInfo = {
        seconds: soonest.barvlDt,
        message: soonest.arvlMsg2 || undefined,
        source: 'seoul-realtime',
      }
      return info
    } catch {
      // 키 미설정·인증·네트워크·상류 오류 → 추정치 폴백
      return mockArrivalProvider.next(query)
    }
  },
}
