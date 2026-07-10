// CROWDCAST 도메인 타입 정의

/** 혼잡도 5단계 */
export type CrowdLevel = 'easy' | 'mild' | 'warn' | 'busy' | 'full'

export interface Line {
  id: string
  /** 표기명 (예: "2", "9") */
  name: string
  /** 풀 라벨 (예: "2호선") */
  label: string
  color: string
  /** 순환선 여부 */
  loop?: boolean
}

export interface Station {
  id: string
  name: string
  lineId: string
  /** 이 역이 지나는 순서 index */
  order: number
  /** 환승 노선 id 목록 */
  transfers?: string[]
}

/** 승강장 구조물 위치 — 특정 칸 쏠림의 원인 */
export interface PlatformFeature {
  /** 1-based 칸 번호 */
  car: number
  type: 'stairs' | 'exit' | 'transfer' | 'elevator'
  label: string
}

/** 한 칸의 예측 혼잡도 */
export interface CarCongestion {
  /** 1-based 칸 번호 */
  car: number
  /** 0~100 예측 혼잡도 */
  value: number
  level: CrowdLevel
}

export interface Direction {
  id: 'up' | 'down'
  label: string
  /** 방면 종착역명 */
  toward: string
}

// ─────────────────────────────────────────────────────────────
// 경로 안내 (최단 경로 = 입력, 칸별 혼잡도 = 출력)
// ─────────────────────────────────────────────────────────────

/** 앱 모드 — 경로 찾기 / 역 직접 조회 */
export type AppMode = 'route' | 'explore'

/** 두 역을 잇는 환승 통로 (목업; 실 연동 시 ODsay/역코드로 대체) */
export interface TransferLink {
  a: string
  b: string
  /** 환승 도보 소요(분) */
  walk: number
}

/** 한 노선을 연속으로 타는 구간 */
export interface RouteLeg {
  lineId: string
  /** 타는 역(진입역) */
  boardStationId: string
  /** 내리는 역 */
  alightStationId: string
  direction: 'up' | 'down'
  /** 승차~하차 사이 전체 역 id (양끝 포함) */
  stationIds: string[]
  /** 정차 역 수(구간 수) */
  numStations: number
  rideMinutes: number
  /** 이 구간을 타기 위한 환승 도보(분). 첫 구간은 0 */
  transferWalkMinutes: number
}

/** 추천 경로 하나 */
export interface RoutePlan {
  id: string
  legs: RouteLeg[]
  /** 승차 + 환승 도보 총합(분) */
  totalMinutes: number
  transferCount: number
  walkMinutes: number
  /** 종합 랭킹 점수 (낮을수록 우선) */
  score: number
}

/** 이벤트 예측 (공연/스포츠) */
export interface CrowdEvent {
  id: string
  type: 'concert' | 'sports' | 'festival'
  title: string
  venue: string
  stationName: string
  lineId: string
  /** ISO 날짜/시각 */
  when: string
  /** 사람이 읽는 시간 라벨 */
  timeLabel: string
  /** 평소 대비 혼잡 증가분 (%p) */
  delta: number
}
