import type { CarCongestion, CrowdLevel } from './types'
import { CAR_COUNT, featuresForStation, eventsForStation, getStation } from './subway'

// ─────────────────────────────────────────────────────────────
// 칸별 혼잡도 추정 로직
//   역 단위 평균 혼잡도 × 칸별 가중치 패턴 = 칸 단위 혼잡도 추정
//   + 이벤트 변수(공연·경기) 반영
// ─────────────────────────────────────────────────────────────

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

/** 시간대별 역 평균 혼잡도 (0~100) */
export function baseCongestionByHour(hour: number): number {
  // 출근 러시 7~9시, 퇴근 러시 18~20시 피크
  // 피크에서도 100 포화가 아니라 ~72 수준 — 칸별 편차가 드러나도록 여유를 둔다
  const morning = Math.exp(-Math.pow(hour - 8, 2) / 2.2) * 56
  const evening = Math.exp(-Math.pow(hour - 18.5, 2) / 3.0) * 52
  const midday = Math.exp(-Math.pow(hour - 13, 2) / 12) * 22
  const base = 16 + morning + evening + midday
  return Math.min(82, base)
}

export function levelOf(value: number): CrowdLevel {
  if (value < 30) return 'easy'
  if (value < 50) return 'mild'
  if (value < 70) return 'warn'
  if (value < 85) return 'busy'
  return 'full'
}

export const LEVEL_META: Record<
  CrowdLevel,
  { label: string; short: string; color: string; text: string; desc: string }
> = {
  easy: {
    label: '여유',
    short: '여유',
    color: '#22c55e',
    text: '#bbf7d0',
    desc: '앉거나 편하게 설 수 있어요',
  },
  mild: {
    label: '보통',
    short: '보통',
    color: '#a3e635',
    text: '#d9f99d',
    desc: '서서 가기 무난해요',
  },
  warn: {
    label: '주의',
    short: '주의',
    color: '#facc15',
    text: '#fef08a',
    desc: '다소 붐벼요',
  },
  busy: {
    label: '혼잡',
    short: '혼잡',
    color: '#fb923c',
    text: '#fed7aa',
    desc: '몸이 닿을 정도로 붐벼요',
  },
  full: {
    label: '매우혼잡',
    short: '매우',
    color: '#ef4444',
    text: '#fecaca',
    desc: '탑승이 매우 어려워요',
  },
}

/**
 * 칸별 가중치 패턴.
 * 계단·환승·출구가 가까운 칸일수록 사람이 몰려 가중치가 높다.
 */
function carWeights(stationId: string): number[] {
  const features = featuresForStation(stationId)
  const weights = new Array(CAR_COUNT).fill(1)

  for (const f of features) {
    const boost = f.type === 'transfer' ? 0.55 : f.type === 'stairs' ? 0.42 : 0.28
    // 해당 칸과 인접 칸에 가우시안 형태로 쏠림 반영
    for (let c = 1; c <= CAR_COUNT; c++) {
      const d = Math.abs(c - f.car)
      weights[c - 1] += boost * Math.exp(-(d * d) / 2.0)
    }
  }

  // 양 끝 칸은 통상 약간 여유
  weights[0] *= 0.9
  weights[CAR_COUNT - 1] *= 0.92

  // 평균 1.0 로 정규화
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length
  return weights.map((w) => w / avg)
}

export interface PredictionResult {
  cars: CarCongestion[]
  average: number
  eventBoost: number // 이벤트로 인한 추가 %p
  best: number // 가장 여유로운 칸 번호
  worst: number // 가장 붐비는 칸 번호
}

export function predictCongestion(
  stationId: string,
  hour: number,
): PredictionResult {
  const base = baseCongestionByHour(hour)
  const weights = carWeights(stationId)
  const station = getStation(stationId)

  // 이벤트 반영: 해당 역 이벤트 delta 중 최댓값을 반영
  const events = station ? eventsForStation(station.name) : []
  const eventBoost = events.reduce((m, e) => Math.max(m, e.delta), 0)

  const cars: CarCongestion[] = []
  for (let c = 1; c <= CAR_COUNT; c++) {
    const w = weights[c - 1]
    // 칸별 편차: 가중치 1.0 기준으로 ±편차 (곱셈 대신 가산 → 포화 방지, 비교성 유지)
    const deviation = (w - 1) * 26
    // 이벤트 영향: 붐비는 칸일수록 더 크게 반영하되 전체가 100으로 포화되지 않도록 조절
    const eventContrib = eventBoost * (0.45 + (w - 1) * 0.45)
    const noise = (seeded(hashString(stationId) + c * 7 + hour * 3) - 0.5) * 7
    let value = base + deviation + eventContrib + noise
    value = Math.max(6, Math.min(100, value))
    cars.push({ car: c, value: Math.round(value), level: levelOf(value) })
  }

  const average = Math.round(cars.reduce((a, b) => a + b.value, 0) / cars.length)
  const best = cars.reduce((min, c) => (c.value < min.value ? c : min)).car
  const worst = cars.reduce((max, c) => (c.value > max.value ? c : max)).car

  return { cars, average, eventBoost, best, worst }
}
