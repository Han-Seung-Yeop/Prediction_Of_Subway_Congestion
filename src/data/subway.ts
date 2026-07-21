import type {
  Line,
  Station,
  PlatformFeature,
  Direction,
  CrowdEvent,
  TransferLink,
} from './types'
import { normalizeStationName } from './stationNaming'
import { directoryStations, directoryLines } from './stationDirectory'

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
  { id: 's-gyeongbokgung', name: '경복궁', lineId: 'line3', order: 0, lat: 37.575844, lng: 126.973576 },
  { id: 's-anguk', name: '안국', lineId: 'line3', order: 1, lat: 37.576562, lng: 126.98547 },
  { id: 's-jongno3-l3', name: '종로3가', lineId: 'line3', order: 2, transfers: ['line1', 'line5'], lat: 37.571537, lng: 126.991837 },
  { id: 's-euljiro3-l3', name: '을지로3가', lineId: 'line3', order: 3, transfers: ['line2'], lat: 37.566299, lng: 126.992616 },
  { id: 's-chungmuro', name: '충무로', lineId: 'line3', order: 4, transfers: ['line4'], lat: 37.561382, lng: 126.994173 },
  { id: 's-dongguk', name: '동대입구', lineId: 'line3', order: 5, lat: 37.55906, lng: 127.005273 },
  // 2호선
  { id: 's-euljiro1', name: '을지로입구', lineId: 'line2', order: 0, lat: 37.565998, lng: 126.982569 },
  { id: 's-euljiro3-l2', name: '을지로3가', lineId: 'line2', order: 1, transfers: ['line3'], lat: 37.566292, lng: 126.990873 },
  { id: 's-euljiro4', name: '을지로4가', lineId: 'line2', order: 2, transfers: ['line5'], lat: 37.566611, lng: 126.997622 },
  { id: 's-ddp', name: '동대문역사문화공원', lineId: 'line2', order: 3, transfers: ['line4', 'line5'], lat: 37.565609, lng: 127.009083 },
  { id: 's-sindang', name: '신당', lineId: 'line2', order: 4, transfers: ['line6'], lat: 37.565675, lng: 127.019426 },
  { id: 's-sangwangsimni', name: '상왕십리', lineId: 'line2', order: 5, lat: 37.564444, lng: 127.029322 },
  { id: 's-wangsimni', name: '왕십리', lineId: 'line2', order: 6, transfers: ['line5', '수인분당선', '경의중앙선'], lat: 37.561289, lng: 127.037061 },
  { id: 's-hanyangdae', name: '한양대', lineId: 'line2', order: 7, lat: 37.555758, lng: 127.043659 },
  { id: 's-ttukseom', name: '뚝섬', lineId: 'line2', order: 8, lat: 37.54718, lng: 127.047413 },
  { id: 's-seongsu', name: '성수', lineId: 'line2', order: 9, lat: 37.544628, lng: 127.055983 },
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
  // id는 order 증감 토큰(up=order↑, down=order↓)이고 label은 서울 상/하행 관례.
  //   3호선은 order↑ 방향이 오금 방면인데 서울 관례상 오금 방면=하행, 대화 방면=상행이라
  //   label을 실선로에 맞춰 부여한다(서울 실시간 도착정보 updnLine 매칭용).
  line3: [
    { id: 'up', label: '하행', toward: '충무로·오금 방면' },
    { id: 'down', label: '상행', toward: '경복궁·대화 방면' },
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
// 리치(데모 15역·2노선) + 디렉터리(수도권 전 역) 병합 조회
//   리치가 우선 — 승강장 구조물·3D·방향 데이터를 가진 데모 역.
//   같은 (역명,노선)이 디렉터리에도 있으면 리치를 쓰고 디렉터리 항목은 버린다.
//   stationsByLine/buildAdjacency/ExploreView 는 여전히 STATIONS(리치)만 사용 → 무변경.
// ─────────────────────────────────────────────────────────────
const _richKeys = new Set(STATIONS.map((s) => `${normalizeStationName(s.name)}|${s.lineId}`))
const _extraStations = directoryStations.filter(
  (s) => !_richKeys.has(`${normalizeStationName(s.name)}|${s.lineId}`),
)
/** 리치 + 디렉터리 전체 (조회 전용) */
const ALL_STATIONS: Station[] = [...STATIONS, ..._extraStations]
const _stationById = new Map(ALL_STATIONS.map((s) => [s.id, s] as const))
// 노선: 디렉터리 먼저 넣고 리치를 나중에 덮어써 리치 색상/이름이 우선되게 한다.
const _lineById = new Map<string, Line>()
for (const l of directoryLines) _lineById.set(l.id, l)
for (const l of LINES) _lineById.set(l.id, l)

// ─────────────────────────────────────────────────────────────
// 조회 헬퍼
// ─────────────────────────────────────────────────────────────
export function stationsByLine(lineId: string): Station[] {
  return STATIONS.filter((s) => s.lineId === lineId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function getLine(lineId: string): Line {
  return _lineById.get(lineId) ?? LINES[0]
}

export function getStation(stationId: string): Station | undefined {
  return _stationById.get(stationId)
}

/**
 * SK 경로 응답의 (역명, 노선, 좌표) 를 우리 역 id 로 해석한다.
 *   같은 노선의 역명 매칭 우선 → 아무 노선 매칭 → 그래도 없으면 SK 값으로 임시 등록.
 *   임시 등록 덕에 디렉터리에 없는 표기(예: 부기명 차이)도 경로가 끊기지 않는다. (연결방식 A)
 */
export function resolveStationId(name: string, lineId: string, lat?: number, lng?: number): string {
  const target = normalizeStationName(name)
  const sameLine = ALL_STATIONS.find(
    (s) => s.lineId === lineId && normalizeStationName(s.name) === target,
  )
  if (sameLine) return sameLine.id
  const anyLine = ALL_STATIONS.find((s) => normalizeStationName(s.name) === target)
  if (anyLine) return anyLine.id
  const id = `x-${lineId}-${target}`
  if (!_stationById.has(id)) {
    const st: Station = { id, name, lineId, lat, lng }
    _stationById.set(id, st)
    ALL_STATIONS.push(st)
  }
  return id
}

/** SK 경로의 노선을 표시용으로 등록(색상 등). 이미 있으면 무시. */
export function registerLineIfAbsent(line: Line): void {
  if (!_lineById.has(line.id)) _lineById.set(line.id, line)
}

export function featuresForStation(stationId: string): PlatformFeature[] {
  return PLATFORM_FEATURES[stationId] ?? DEFAULT_FEATURES
}

export function eventsForStation(stationName: string): CrowdEvent[] {
  return EVENTS.filter((e) => e.stationName === stationName)
}

/** 역명 부분일치 검색 (경로 입력용) — 리치 + 디렉터리 전 역 대상 */
export function searchStations(query: string, limit = 8): Station[] {
  const q = normalizeStationName(query)
  if (!q) return []
  const starts: Station[] = []
  const contains: Station[] = []
  for (const s of ALL_STATIONS) {
    const n = normalizeStationName(s.name)
    if (n === q || n.startsWith(q)) starts.push(s)
    else if (n.includes(q)) contains.push(s)
  }
  return [...starts, ...contains].slice(0, limit)
}

/**
 * 외부(ODsay 노선도 SDK·SK/TMAP)에서 받은 역명을 내부 역과 매칭. 없으면 undefined(=미지원 역).
 *   완전일치 대신 정규화 후 비교하여 "성수"/"성수역"/"을지로 3가" 같은 표기 흔들림을 흡수한다.
 *   리치(데모 역)를 우선 반환한다(ALL_STATIONS 는 리치가 앞).
 */
export function findStationByExactName(name: string): Station | undefined {
  const target = normalizeStationName(name)
  return ALL_STATIONS.find((s) => normalizeStationName(s.name) === target)
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
