// SK/TMAP 칸 혼잡도(통계) 구현체 — 프록시(/api/congestion) 호출 → RouteCongestion 정규화.
//   프록시가 키 미설정/한도초과/오류면 mock(추정치)으로 폴백한다. → 화면이 절대 비지 않음.
//   (구현계획 §4-4: SK 칸 혼잡도 + predict 폴백)

import type { CarCongestion } from '../data/types'
import { levelOf } from '../data/predict'
import { getStation, getLine } from '../data/subway'
import { lineToRouteNm, toSkStationNm } from '../data/stationNaming'
import {
  mockCongestionProvider,
  optimalCarForAlight,
  type CongestionProvider,
  type RouteCongestion,
} from './congestion'

interface CongestionApiResponse {
  source: 'sk-realtime'
  cars: number[]
}

/** 프록시에서 칸별 혼잡도 % 배열을 받아온다. 실패 시 throw. */
async function fetchCongestionCars(routeNm: string, stationNm: string, hour: number): Promise<number[]> {
  const params = new URLSearchParams({
    routeNm,
    stationNm,
    hh: String(hour).padStart(2, '0'),
  })
  const res = await fetch(`/api/congestion?${params.toString()}`)
  if (!res.ok) throw new Error(`congestion proxy ${res.status}`)
  const data = (await res.json()) as CongestionApiResponse
  if (!Array.isArray(data.cars) || data.cars.length === 0) {
    throw new Error('빈 혼잡도 응답')
  }
  return data.cars
}

/** SK 칸별 % 배열 → 앱 RouteCongestion 으로 변환 */
function buildRouteCongestion(
  values: number[],
  alightStationId: string,
  isFinalLeg: boolean,
): RouteCongestion {
  const cars: CarCongestion[] = values.map((v, i) => {
    const value = Math.max(0, Math.min(100, Math.round(v)))
    return { car: i + 1, value, level: levelOf(value) }
  })
  const average = Math.round(cars.reduce((a, c) => a + c.value, 0) / cars.length)
  const best = cars.reduce((min, c) => (c.value < min.value ? c : min)).car
  const worst = cars.reduce((max, c) => (c.value > max.value ? c : max)).car
  const optimal = optimalCarForAlight(alightStationId, isFinalLeg)
  return {
    cars,
    average,
    eventBoost: 0, // 실측/통계값엔 합성 이벤트 가산을 얹지 않는다
    best,
    worst,
    source: 'sk-realtime',
    optimalCar: optimal.car,
    optimalLabel: optimal.label,
  }
}

export const skCongestionProvider: CongestionProvider = {
  async forBoarding(input) {
    const { boardStationId, alightStationId, hour, isFinalLeg } = input
    const station = getStation(boardStationId)
    if (!station) return mockCongestionProvider.forBoarding(input)
    const routeNm = lineToRouteNm(getLine(station.lineId))
    const stationNm = toSkStationNm(station.name)
    try {
      const values = await fetchCongestionCars(routeNm, stationNm, hour)
      return buildRouteCongestion(values, alightStationId, isFinalLeg)
    } catch {
      // 키 미설정·한도초과·상류 오류 → 추정치 폴백 (source:'estimate' 배지)
      return mockCongestionProvider.forBoarding(input)
    }
  },
}
