// 칸별 하차(下車) 예측 어댑터 계층
//   "진입역 기준 칸별 하차 비율"(SK Open API가 제공하는 형태)을
//   다음 역·타임라인으로 풀어, 각 정차역에서 이 칸에서 몇 명(몇 %)이
//   내리는지와 하차 후 남는 혼잡도를 계산한다.
//
//   UI 는 AlightingProvider 인터페이스에만 의존한다.
//   1차: mock(구조물/환승 기반 결정론적 추정).
//   이후: SK Open API(진입역 기준 칸별 하차 비율)로 교체, 없으면 estimate 폴백.
//   → congestion.ts 의 CongestionProvider 와 동일한 교체 전략.

import { CAR_COUNT, PER_HOP_MIN, stationsByLine, featuresForStation } from '../data/subway'
import type { Station } from '../data/types'

/** 혼잡도(0~100) → 한 칸의 대략적 탑승 인원. 100% ≈ 만원(약 160명) */
const CAR_HEADCOUNT_AT_FULL = 160

export function headcountFromValue(value: number): number {
  return Math.round((value / 100) * CAR_HEADCOUNT_AT_FULL)
}

export function valueFromHeadcount(headcount: number): number {
  return Math.max(4, Math.round((headcount / CAR_HEADCOUNT_AT_FULL) * 100))
}

/** 한 정차역에서 이 칸의 하차 예측 */
export interface AlightStop {
  stationId: string
  stationName: string
  /** 진입역에서 이 역까지 소요(분) — "몇 분 뒤" */
  etaMinutes: number
  /** 이 역 도착 직전 이 칸의 승객 수 */
  headcountBefore: number
  /** 이 역에서 이 칸에서 내리는 인원 */
  alightCount: number
  /** 직전 승객 대비 하차 비율(0~1) */
  alightRatio: number
  /** 하차 후 남는 승객 수 */
  headcountAfter: number
  /** 하차 후 이 칸 혼잡도(0~100) */
  valueAfter: number
  /** 환승역(하차 급증 지점) 여부 */
  isTransfer: boolean
}

export interface CarAlighting {
  car: number
  /** 진입역 기준 이 칸 탑승 인원 */
  boardingHeadcount: number
  /** 다음 역부터 순서대로 */
  stops: AlightStop[]
  /** 예측 출처 배지 */
  source: 'sk-realtime' | 'estimate'
}

export interface AlightingInput {
  /** 타는 역(진입역) */
  boardStationId: string
  lineId: string
  direction: 'up' | 'down'
  /** 1-based 칸 번호 */
  car: number
  hour: number
  /** 진입역 기준 이 칸 현재 혼잡도(0~100) */
  carValue: number
  /** 미리 볼 정차역 수 (다음 역 포함) */
  lookahead?: number
}

export interface AlightingProvider {
  forCar(input: AlightingInput): CarAlighting
}

/** 결정론적 유사난수 (같은 입력 → 같은 결과) */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 진입역에서 진행 방향으로 다음 정차역들을 반환.
 *   관례: up = order 증가, down = order 감소. (목업 좌표계 기준)
 *   순환선(2호선)은 끝에서 wrap.
 */
function downstreamStations(boardStationId: string, lineId: string, direction: 'up' | 'down', count: number): Station[] {
  const line = stationsByLine(lineId)
  if (line.length === 0) return []
  const idx = line.findIndex((s) => s.id === boardStationId)
  if (idx < 0) return []
  const loop = line.length > 2 // 목업에선 2호선만 loop지만, wrap 자체는 안전
  const step = direction === 'up' ? 1 : -1
  const out: Station[] = []
  let i = idx
  for (let k = 0; k < count; k++) {
    i += step
    if (i < 0 || i >= line.length) {
      if (!loop) break
      i = (i + line.length) % line.length
    }
    if (line[i].id === boardStationId) break // 한 바퀴 돌아 제자리면 중단
    out.push(line[i])
  }
  return out
}

/** 한 역에서의 기본 하차 비율(직전 승객 대비 0~1) 추정 */
function baseAlightRatio(boardStationId: string, stop: Station, car: number, hour: number, isTransfer: boolean): number {
  // 환승역/종점 근처일수록, 이 칸에 환승·출구 구조물이 붙어 있을수록 하차↑
  const noise = seeded(hashString(boardStationId + '>' + stop.id) + car * 7 + hour * 3)
  let ratio = 0.14 + noise * 0.16 // 평시 14~30%
  if (isTransfer) ratio += 0.22 // 환승역 급증
  // 이 칸 바로 앞에 출구/환승 구조물이 있으면 이 칸 하차가 더 몰림
  const feats = featuresForStation(stop.id)
  if (feats.some((f) => (f.type === 'transfer' || f.type === 'exit') && Math.abs(f.car - car) <= 1)) {
    ratio += 0.1
  }
  return Math.max(0.05, Math.min(0.7, ratio))
}

export const mockAlightingProvider: AlightingProvider = {
  forCar({ boardStationId, lineId, direction, car, hour, carValue, lookahead = 3 }) {
    const boardingHeadcount = headcountFromValue(carValue)
    const stops: AlightStop[] = []
    const downstream = downstreamStations(boardStationId, lineId, direction, lookahead)

    let occ = boardingHeadcount
    let eta = 0
    for (const st of downstream) {
      eta += PER_HOP_MIN
      const isTransfer = Boolean(st.transfers && st.transfers.length > 0)
      const ratio = baseAlightRatio(boardStationId, st, car, hour, isTransfer)
      const before = occ
      const alightCount = Math.min(before, Math.round(before * ratio))
      const after = before - alightCount
      stops.push({
        stationId: st.id,
        stationName: st.name,
        etaMinutes: Math.round(eta),
        headcountBefore: before,
        alightCount,
        alightRatio: before > 0 ? alightCount / before : 0,
        headcountAfter: after,
        valueAfter: valueFromHeadcount(after),
        isTransfer,
      })
      occ = after
    }

    return { car, boardingHeadcount, stops, source: 'estimate' }
  },
}

/** CAR_COUNT 재노출 (호출부 편의) */
export { CAR_COUNT }
