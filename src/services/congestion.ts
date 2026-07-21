// 칸별 혼잡도 어댑터 계층
//   UI 는 CongestionProvider 인터페이스에만 의존한다.
//   1차: mock(기존 predict.ts 추정 로직 재사용).
//   이후: SK Open API(진입역 기준 칸별 혼잡도)로 교체, 없으면 estimate 폴백.

import type { PredictionResult } from '../data/predict'
import { predictCongestion } from '../data/predict'
import { featuresForStation } from '../data/subway'

export interface RouteCongestion extends PredictionResult {
  /** 혼잡도 출처 배지 */
  source: 'sk-realtime' | 'estimate'
  /** 다음 동선(환승/하차)에 가장 가까운 칸 */
  optimalCar: number | null
  /** 그 칸의 안내 라벨 (예: "환승 통로 최근접") */
  optimalLabel: string | null
}

export interface BoardingInput {
  boardStationId: string
  alightStationId: string
  direction: 'up' | 'down'
  hour: number
  /** 이 구간이 여정의 마지막(하차)인지 */
  isFinalLeg: boolean
}

export interface CongestionProvider {
  forBoarding(input: BoardingInput): Promise<RouteCongestion>
}

/**
 * 하차역의 승강장 구조물 중 다음 동선에 맞는 최적 칸을 고른다.
 *   중간 구간: 환승 통로 > 계단 순
 *   마지막 구간: 출구 > 계단 순
 */
export function optimalCarForAlight(alightStationId: string, isFinalLeg: boolean) {
  const features = featuresForStation(alightStationId)
  const priority: Array<{ type: string; label: string }> = isFinalLeg
    ? [
        { type: 'exit', label: '출구 최근접' },
        { type: 'stairs', label: '계단 최근접' },
      ]
    : [
        { type: 'transfer', label: '환승 통로 최근접' },
        { type: 'stairs', label: '환승 계단 최근접' },
      ]
  for (const p of priority) {
    const f = features.find((ft) => ft.type === p.type)
    if (f) return { car: f.car, label: p.label }
  }
  return { car: null, label: null }
}

export const mockCongestionProvider: CongestionProvider = {
  async forBoarding({ boardStationId, alightStationId, hour, isFinalLeg }) {
    // 진입역(=타는 역) 기준 칸별 혼잡도 추정
    const pred = predictCongestion(boardStationId, hour)
    const optimal = optimalCarForAlight(alightStationId, isFinalLeg)
    return {
      ...pred,
      source: 'estimate',
      optimalCar: optimal.car,
      optimalLabel: optimal.label,
    }
  },
}
