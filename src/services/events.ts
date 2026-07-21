// 이벤트 예보 어댑터 인터페이스 + 목업.
//   UI(EventForecast)는 이 EventProvider 만 바라본다. 실연동(서울 문화행사 + 네이버 스포츠)은 eventsLive.ts.
//   (구현계획 §6: 이벤트 → 최근접 역 → 그 시간대 eventBoost)

import type { CrowdEvent } from '../data/types'
import { EVENTS } from '../data/subway'

export interface EventProvider {
  /** 특정 날짜(YYYY-MM-DD)의 이벤트를 delta 높은 순으로 */
  forDate(date: string): Promise<CrowdEvent[]>
}

/** 목업 — 기존 하드코딩 이벤트 반환(실패 폴백용) */
export const mockEventProvider: EventProvider = {
  async forDate() {
    return EVENTS
  },
}
