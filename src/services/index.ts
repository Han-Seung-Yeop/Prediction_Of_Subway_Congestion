// 서비스 구현체 팩토리 — UI 는 여기서 나오는 provider 만 바라본다.
//   VITE_USE_SK=1 이면 SK/TMAP 실연동 구현체, 아니면 mock.
//   (구현계획 §4: mock ↔ real 을 env 플래그로 토글)
//
//   경로(routeProvider): SK 경로검색은 역 좌표가 필요해 아직 mock 유지(좌표 추가 후 교체).
//   혼잡도(congestionProvider): SK 칸 혼잡도 연동됨. 실패 시 내부에서 추정치로 폴백.

import { mockRouteProvider, type RouteProvider } from './routing'
import { skRouteProvider } from './routingSk'
import { mockCongestionProvider, type CongestionProvider } from './congestion'
import { skCongestionProvider } from './congestionSk'
import { type ArrivalProvider } from './arrival'
import { seoulArrivalProvider } from './arrivalSeoul'
import { type EventProvider } from './events'
import { liveEventProvider } from './eventsLive'

// VITE_USE_SK 는 SK(경로·혼잡도) 전용 스위치 — SK 무료 쿼터가 매우 작아(혼잡도 2/일) 기본 off(mock).
const USE_SK = import.meta.env.VITE_USE_SK === '1' || import.meta.env.VITE_USE_SK === 'true'

// SK 경로검색(전 역, 좌표 기반). 실패/좌표없음 시 내부에서 mock 폴백.
export const routeProvider: RouteProvider = USE_SK ? skRouteProvider : mockRouteProvider

export const congestionProvider: CongestionProvider = USE_SK
  ? skCongestionProvider
  : mockCongestionProvider

// 서울 실시간 도착정보 — 항상 라이브(스위치 없음). 서울 열린데이터광장 쿼터가 넉넉해(≈1,000/일)
//   SK처럼 아낄 필요가 없다. 키 미설정·쿼터초과·빈응답·막차 이후엔 내부에서 mock 으로 폴백하므로,
//   VITE_USE_SK off(전체 mock 모드)여도 도착정보만은 실시간으로 뜬다.
export const arrivalProvider: ArrivalProvider = seoulArrivalProvider

// 이벤트 예보 — 항상 라이브(서울 문화행사=공식 + 네이버 스포츠=비공식). 이벤트는 매번 바뀌어
//   정적으론 낡으므로 라이브 고정. 실패·빈응답 시 내부에서 mock 으로 폴백.
export const eventProvider: EventProvider = liveEventProvider
