// ─────────────────────────────────────────────────────────────
// 역 내부 층별 데이터 모델 (역삼역 2호선 예시)
//   Station3D 의 3D 좌표(y·depth·deck)와, 층 선택 시 뜨는
//   "위에서 본 평면도"에 필요한 지점 좌표(x·z)를 층별 단일 소스로 통합.
//   좌표계는 3D 씬과 동일: x ∈ [-7.5, 7.5], z ∈ [-depth/2, depth/2].
// ─────────────────────────────────────────────────────────────

export type FloorId = 'b1' | 'b2' | 'b3'

/** 평면도에 점으로 찍히는 개별 지점/시설 (탭하면 설명 표시) */
export interface FloorPoi {
  icon: string
  label: string
  /** 상세 설명 (한 줄) */
  desc: string
  /** 평면도 좌표 (3D 씬과 동일) */
  x: number
  z: number
  /** 마커 강조색 */
  color: string
  /** 엘리베이터·계단 등 층 연결 표시 (예: '⇅ B1–B3') */
  tag?: string
}

/** 지상 출구 계단/에스컬레이터 (대합실 층 상단 가장자리) */
export interface ExitInfo {
  num: number
  x: number
  /** combo = 계단+에스컬레이터 병설, stairs = 계단만 */
  type: 'stairs' | 'combo'
}

/** 한 층의 3D 배치 정보 + 평면도 콘텐츠 */
export interface FloorInfo {
  id: FloorId
  /** 데크 Y 위치 */
  y: number
  /** 데크 깊이(Z) */
  depth: number
  deckColor: string
  deckOpacity: number
  /** 층 코드 라벨 (예: 'B1') */
  code: string
  /** 층 성격 (예: '대합실') */
  role: string
  /** 한 줄 요약 (헤더용) */
  summary: string
  /** 평면도에 점으로 찍는 지점 목록 */
  pois: FloorPoi[]
  /** 지상 출구 계단열 (대합실 층만) */
  exits?: ExitInfo[]
  /** 개찰구 x (턴스타일 렌더용) */
  gateX?: number
  /** 승강장 층: 트랙 + 방면 라벨 렌더 */
  platform?: boolean
  /** 최단 대피경로 화살표 (from → to) */
  evac?: { fromX: number; fromZ: number; toX: number; toZ: number }
}

// 3D 좌표 상수 — Station3D 와 공유
export const CONCOURSE_DEPTH = 3.0
export const PLATFORM_DEPTH = 2.6

// 출구 번호 → x좌표 (안내도의 좌→우 클러스터 배치를 단순화)
// 8·1·7 묶음 / 6 단독 / 5·2 묶음 / 3·4 묶음(반대편)
export const EXITS: ExitInfo[] = [
  { num: 8, x: -5.9, type: 'combo' },
  { num: 1, x: -5.2, type: 'stairs' },
  { num: 7, x: -4.5, type: 'combo' },
  { num: 6, x: -2.3, type: 'stairs' },
  { num: 5, x: -0.6, type: 'combo' },
  { num: 2, x: 0.2, type: 'stairs' },
  { num: 3, x: 5.1, type: 'combo' },
  { num: 4, x: 5.8, type: 'stairs' },
]

// 마커 색상 팔레트
const COL = {
  elev: '#4d94ff',
  gate: '#9aa3b2',
  toilet: '#0ea5e9',
  ticket: '#64748b',
  info: '#2f6fed',
  meet: '#8b5cf6',
  here: '#ef4444',
  fire: '#ef4444',
  aed: '#22c55e',
  phone: '#f59e0b',
  relief: '#a855f7',
}

export const FLOORS: Record<FloorId, FloorInfo> = {
  b1: {
    id: 'b1',
    y: 2.2,
    depth: CONCOURSE_DEPTH,
    deckColor: '#c9d3e0',
    deckOpacity: 0.55,
    code: 'B1',
    role: '대합실',
    summary: '지상 출구와 개찰구가 있는 진출입 층',
    exits: EXITS,
    gateX: 2.5,
    pois: [
      { icon: '🛗', label: '엘리베이터', desc: 'B1↔B3 전 층 관통 · 휠체어·유모차', x: -1.45, z: -1.1, color: COL.elev, tag: '⇅ B1–B3' },
      { icon: '🎫', label: '개찰구', desc: '대합실 ↔ 유료구역 경계', x: 2.5, z: 0, color: COL.gate },
      { icon: '🚻', label: '화장실', desc: '개찰구 안쪽 대합실 벽면', x: -3.6, z: -1.15, color: COL.toilet },
      { icon: '💳', label: '발매기·카드충전', desc: '1회권·교통카드 충전기', x: 1.0, z: -1.15, color: COL.ticket },
    ],
  },
  b2: {
    id: 'b2',
    y: 0,
    depth: CONCOURSE_DEPTH,
    deckColor: '#aab6c9',
    deckOpacity: 0.55,
    code: 'B2',
    role: '대합실',
    summary: '안내·만남의 장소가 있는 중간 층',
    evac: { fromX: -0.1, fromZ: -0.3, toX: -2.3, toZ: -0.9 },
    pois: [
      { icon: '🛗', label: '엘리베이터', desc: 'B1↔B3 전 층 관통', x: -1.45, z: -1.1, color: COL.elev, tag: '⇅ B1–B3' },
      { icon: 'ℹ️', label: '고객안내센터', desc: '역무 문의·유실물·안내', x: -0.1, z: 0.9, color: COL.info },
      { icon: '⭐', label: '만남의 장소', desc: '약속 대기 지점', x: -2.3, z: -0.9, color: COL.meet },
      { icon: '📍', label: '현위치', desc: '안내도 기준 현재 위치 · 대피경로 시작점', x: -0.1, z: -0.3, color: COL.here },
    ],
  },
  b3: {
    id: 'b3',
    y: -2.2,
    depth: PLATFORM_DEPTH,
    deckColor: '#e3e6ea',
    deckOpacity: 0.92,
    code: 'B3',
    role: '승강장',
    summary: '실제 열차가 도착하는 승강장 층',
    platform: true,
    pois: [
      { icon: '🛗', label: '엘리베이터', desc: 'B1↔B3 전 층 관통', x: -1.45, z: -1.05, color: COL.elev, tag: '⇅ B1–B3' },
      { icon: '🧯', label: '소화전', desc: '승강장 벽면 소화 설비', x: -4.0, z: -1.0, color: COL.fire },
      { icon: '❤️', label: 'AED', desc: '자동제세동기 · 심정지 응급처치', x: -1.0, z: -1.0, color: COL.aed },
      { icon: '☎️', label: '비상전화', desc: '역무실 직통 비상 통화', x: 3.0, z: -1.0, color: COL.phone },
      { icon: '🎒', label: '구호물품함', desc: '방독면·응급 구호 물품', x: 4.3, z: -1.0, color: COL.relief },
    ],
  },
}

/** 위→아래 표시 순서 (B1 → B2 → B3) */
export const FLOOR_ORDER: FloorId[] = ['b1', 'b2', 'b3']

/** Station3D 하위 호환용 — 기존 FLOOR_Y 형태 */
export const FLOOR_Y: Record<FloorId, number> = {
  b1: FLOORS.b1.y,
  b2: FLOORS.b2.y,
  b3: FLOORS.b3.y,
}
