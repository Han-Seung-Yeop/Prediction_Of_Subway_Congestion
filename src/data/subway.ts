import type {
  Line,
  Station,
  PlatformFeature,
  Direction,
  CrowdEvent,
  TransferLink,
} from './types'

// ─────────────────────────────────────────────────────────────
// 노선 — 시연 구간(안국·을지로3가·성수)이 걸친 실제 2·3호선.
//   색상은 ODsay Subway Map SDK 데모의 실제 호선 색상 코드를 그대로 사용.
// ─────────────────────────────────────────────────────────────
export const LINES: Line[] = [
  { id: 'line2', name: '2', label: '2호선', color: '#35b12b' },
  { id: 'line3', name: '3', label: '3호선', color: '#fa5f2c' },
]

// ─────────────────────────────────────────────────────────────
// 역 — 시연 3역(안국·을지로3가·성수)을 포함한 실제 구간만.
//   3호선: 경복궁~동대입구, 2호선: 을지로입구~성수.
//   을지로3가는 실제로 2·3호선 환승역이라 노선별로 별도 역 엔티티를 두고
//   TRANSFER_LINKS 로 연결한다(진짜 환승 도보처럼 동작).
// ─────────────────────────────────────────────────────────────
export const STATIONS: Station[] = [
  // 3호선
  { id: 's-gyeongbokgung', name: '경복궁', lineId: 'line3', order: 0 },
  { id: 's-anguk', name: '안국', lineId: 'line3', order: 1 },
  { id: 's-jongno3-l3', name: '종로3가', lineId: 'line3', order: 2, transfers: ['line1', 'line5'] },
  { id: 's-euljiro3-l3', name: '을지로3가', lineId: 'line3', order: 3, transfers: ['line2'] },
  { id: 's-chungmuro', name: '충무로', lineId: 'line3', order: 4, transfers: ['line4'] },
  { id: 's-dongguk', name: '동대입구', lineId: 'line3', order: 5 },
  // 2호선
  { id: 's-euljiro1', name: '을지로입구', lineId: 'line2', order: 0 },
  { id: 's-euljiro3-l2', name: '을지로3가', lineId: 'line2', order: 1, transfers: ['line3'] },
  { id: 's-euljiro4', name: '을지로4가', lineId: 'line2', order: 2, transfers: ['line5'] },
  { id: 's-ddp', name: '동대문역사문화공원', lineId: 'line2', order: 3, transfers: ['line4', 'line5'] },
  { id: 's-sindang', name: '신당', lineId: 'line2', order: 4, transfers: ['line6'] },
  { id: 's-sangwangsimni', name: '상왕십리', lineId: 'line2', order: 5 },
  { id: 's-wangsimni', name: '왕십리', lineId: 'line2', order: 6, transfers: ['line5', '수인분당선', '경의중앙선'] },
  { id: 's-hanyangdae', name: '한양대', lineId: 'line2', order: 7 },
  { id: 's-ttukseom', name: '뚝섬', lineId: 'line2', order: 8 },
  { id: 's-seongsu', name: '성수', lineId: 'line2', order: 9 },
]

// ─────────────────────────────────────────────────────────────
// 환승 통로 — 을지로3가 실제 2↔3호선 환승만 목업 그래프에 필요.
// ─────────────────────────────────────────────────────────────
export const TRANSFER_LINKS: TransferLink[] = [
  { a: 's-euljiro3-l3', b: 's-euljiro3-l2', walk: 3 },
]

/** 열차 칸 수 (서울 지하철 대부분 10량 편성) */
export const CAR_COUNT = 10

// ─────────────────────────────────────────────────────────────
// 방향
// ─────────────────────────────────────────────────────────────
export const DIRECTIONS: Record<string, Direction[]> = {
  line2: [
    { id: 'up', label: '내선순환', toward: '성수·왕십리 방면' },
    { id: 'down', label: '외선순환', toward: '을지로입구·시청 방면' },
  ],
  line3: [
    { id: 'up', label: '상행', toward: '충무로·오금 방면' },
    { id: 'down', label: '하행', toward: '경복궁·대화 방면' },
  ],
}

// ─────────────────────────────────────────────────────────────
// 승강장 구조물 (칸 쏠림의 원인) — 역별 목업
// ─────────────────────────────────────────────────────────────
export const PLATFORM_FEATURES: Record<string, PlatformFeature[]> = {
  's-anguk': [
    { car: 2, type: 'exit', label: '1번 출구 (안국동)' },
    { car: 5, type: 'stairs', label: '중앙 계단' },
    { car: 8, type: 'exit', label: '6번 출구 (인사동)' },
  ],
  's-euljiro3-l3': [
    { car: 1, type: 'transfer', label: '2호선 환승' },
    { car: 4, type: 'stairs', label: '중앙 계단' },
    { car: 9, type: 'exit', label: '11번 출구' },
  ],
  's-euljiro3-l2': [
    { car: 2, type: 'transfer', label: '3호선 환승' },
    { car: 6, type: 'stairs', label: '중앙 계단' },
    { car: 10, type: 'exit', label: '1번 출구' },
  ],
  's-seongsu': [
    { car: 1, type: 'exit', label: '3번 출구 (성수동 카페거리)' },
    { car: 4, type: 'stairs', label: '중앙 계단' },
    { car: 7, type: 'exit', label: '4번 출구 (서울숲)' },
    { car: 9, type: 'stairs', label: '계단·에스컬레이터' },
  ],
}

/** 기본 승강장 구조물 (역별 데이터 없을 때) */
export const DEFAULT_FEATURES: PlatformFeature[] = [
  { car: 2, type: 'exit', label: '출구' },
  { car: 5, type: 'stairs', label: '중앙 계단' },
  { car: 8, type: 'stairs', label: '계단·환승' },
]

// ─────────────────────────────────────────────────────────────
// 이벤트 예측 (KOPIS 공연 + 스포츠 관중 기반 목업)
// ─────────────────────────────────────────────────────────────
export const EVENTS: CrowdEvent[] = [
  {
    id: 'ev-insadong',
    type: 'festival',
    title: '인사동 전통문화 축제',
    venue: '인사동 거리',
    stationName: '안국',
    lineId: 'line3',
    when: '2026-07-11T15:00:00',
    timeLabel: '내일 15:00 시작',
    delta: 30,
  },
  {
    id: 'ev-seoulforest',
    type: 'festival',
    title: '서울숲 여름밤 마켓',
    venue: '서울숲 공원',
    stationName: '성수',
    lineId: 'line2',
    when: '2026-07-10T18:00:00',
    timeLabel: '오늘 18:00 시작',
    delta: 38,
  },
]

// ─────────────────────────────────────────────────────────────
// 조회 헬퍼
// ─────────────────────────────────────────────────────────────
export function stationsByLine(lineId: string): Station[] {
  return STATIONS.filter((s) => s.lineId === lineId).sort((a, b) => a.order - b.order)
}

export function getLine(lineId: string): Line {
  return LINES.find((l) => l.id === lineId) ?? LINES[0]
}

export function getStation(stationId: string): Station | undefined {
  return STATIONS.find((s) => s.id === stationId)
}

export function featuresForStation(stationId: string): PlatformFeature[] {
  return PLATFORM_FEATURES[stationId] ?? DEFAULT_FEATURES
}

export function eventsForStation(stationName: string): CrowdEvent[] {
  return EVENTS.filter((e) => e.stationName === stationName)
}

/** 역명 부분일치 검색 (경로 입력용) */
export function searchStations(query: string, limit = 8): Station[] {
  const q = query.trim()
  if (!q) return []
  const starts: Station[] = []
  const contains: Station[] = []
  for (const s of STATIONS) {
    if (s.name === q || s.name.startsWith(q)) starts.push(s)
    else if (s.name.includes(q)) contains.push(s)
  }
  return [...starts, ...contains].slice(0, limit)
}

/** 외부(ODsay 노선도 SDK)에서 받은 역명을 내부 역과 정확히 매칭. 없으면 undefined(=미지원 역) */
export function findStationByExactName(name: string): Station | undefined {
  const clean = name.trim().replace(/역$/, '')
  return STATIONS.find((s) => s.name === clean)
}

// ─────────────────────────────────────────────────────────────
// 경로 탐색용 그래프 (동일 노선 인접 + 환승 통로)
// ─────────────────────────────────────────────────────────────

export interface GraphEdge {
  to: string
  /** 환승 통로면 walk(분), 아니면 승차(분) */
  minutes: number
  /** 환승 여부 */
  transfer: boolean
}

/** 한 정거장 이동 시간(분) — 목업 */
export const PER_HOP_MIN = 2.5

let _adjacency: Map<string, GraphEdge[]> | null = null

/** 인접 리스트 (동일 노선 연속 역 + 환승 링크). 최초 1회 구성 후 캐시 */
export function buildAdjacency(): Map<string, GraphEdge[]> {
  if (_adjacency) return _adjacency
  const adj = new Map<string, GraphEdge[]>()
  const push = (from: string, edge: GraphEdge) => {
    const list = adj.get(from) ?? []
    list.push(edge)
    adj.set(from, list)
  }

  // 동일 노선: order 연속 역끼리 양방향 연결
  for (const line of LINES) {
    const stns = stationsByLine(line.id)
    for (let i = 0; i < stns.length - 1; i++) {
      const a = stns[i]
      const b = stns[i + 1]
      push(a.id, { to: b.id, minutes: PER_HOP_MIN, transfer: false })
      push(b.id, { to: a.id, minutes: PER_HOP_MIN, transfer: false })
    }
  }

  // 환승 통로: 양방향
  for (const t of TRANSFER_LINKS) {
    push(t.a, { to: t.b, minutes: t.walk, transfer: true })
    push(t.b, { to: t.a, minutes: t.walk, transfer: true })
  }

  _adjacency = adj
  return adj
}
