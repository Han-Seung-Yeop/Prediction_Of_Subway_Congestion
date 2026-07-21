// 도착정보 어댑터 인터페이스 + 목업 구현체.
//   UI(ArrivalBanner)는 이 ArrivalProvider 만 바라본다. 실연동(서울 도착정보)은 arrivalSeoul.ts.
//   (구현계획 §7-5: 실시간 도착정보로 ArrivalBanner 실데이터화)

import type { Line, Station, Direction } from '../data/types'

export interface ArrivalQuery {
  line: Line
  station: Station
  direction: Direction
}

/** 다음 열차 도착 정보 (UI 표시용 정규화 형태) */
export interface ArrivalInfo {
  /** 남은 시간(초). 미상이면 null */
  seconds: number | null
  /** 안내 문구 (예: "전역 도착"). 목업은 없음 */
  message?: string
  /** 데이터 출처 — 'mock' 이면 추정(배지 없음), 'seoul-realtime' 이면 실시간 배지 */
  source: 'seoul-realtime' | 'mock'
}

export interface ArrivalProvider {
  next(q: ArrivalQuery): Promise<ArrivalInfo>
}

/** 결정론적 목업 — 역명 기반으로 30~150초 사이 고정값(기존 배너 로직 이관). */
export const mockArrivalProvider: ArrivalProvider = {
  async next({ station }) {
    const seconds = 30 + (station.name.charCodeAt(0) % 5) * 30
    return { seconds, source: 'mock' }
  },
}
