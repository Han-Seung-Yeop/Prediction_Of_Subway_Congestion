// ─────────────────────────────────────────────────────────────
// 역별 3D 안내도 마커(엘리베이터·화장실·출구 등) 좌표 데이터.
//   Station3D.tsx 의 glb 뷰어 위에 얹는 Html 핀의 위치/내용을 역 id 별로
//   분리 관리한다. 좌표는 각 역 glb 의 실제 지오메트리 범위(half)에 맞춰
//   정규화(-1~1)로 저장 — 모델마다 half 가 달라 그대로 재사용 불가.
//   역삼역(예시 모델)은 기존 하드코딩 값을 FALLBACK 으로 그대로 옮김.
// ─────────────────────────────────────────────────────────────

export type MarkerKind = 'exit' | 'floor' | 'here' | 'facility' | 'poi'

export interface Marker {
  id: string
  kind: MarkerKind
  label: string
  n: [number, number, number] // 정규화 좌표(-1~1), half 를 곱해 실좌표로 변환
  color?: string
  icon?: string
}

export interface StationMarkerSet {
  half: { x: number; y: number; z: number }
  markers: Marker[]
}

// 역삼역 예시 glb POSITION accessor min/max 로 확인한 half.
const FALLBACK_HALF = { x: 0.95, y: 0.325, z: 0.347 }

const FALLBACK_MARKERS: Marker[] = [
  { id: 'b1', kind: 'floor', label: 'B1 · 대합실', n: [0.62, 0.95, 0.55] },
  { id: 'b2', kind: 'floor', label: 'B2 · 대합실', n: [0.46, -0.02, 0.62] },
  { id: 'b3', kind: 'floor', label: 'B3 · 승강장', n: [-0.5, -0.98, 0.7] },

  { id: 'e1', kind: 'exit', label: '1', n: [0.5, 1.05, -0.35] },
  { id: 'e2', kind: 'exit', label: '2', n: [0.74, 1.05, -0.1] },
  { id: 'e3', kind: 'exit', label: '3', n: [0.98, -0.1, -0.55] },
  { id: 'e4', kind: 'exit', label: '4', n: [0.7, -0.35, -0.35] },
  { id: 'e5', kind: 'exit', label: '5', n: [-0.02, 1.08, -0.2] },
  { id: 'e6', kind: 'exit', label: '6', n: [-0.3, 1.08, -0.05] },
  { id: 'e7', kind: 'exit', label: '7', n: [-0.6, 1.08, -0.2] },
  { id: 'e8', kind: 'exit', label: '8', n: [-0.86, 1.08, -0.05] },

  { id: 'meet', kind: 'poi', label: '만남의 장소', icon: '★', color: '#8b5cf6', n: [-0.32, 0.95, 0.35] },
  { id: 'info', kind: 'poi', label: '고객안내센터', icon: 'i', color: '#2f6fed', n: [-0.18, 0.12, 0.5] },
  { id: 'here', kind: 'here', label: '현위치', n: [0.14, 0.22, 0.4] },

  { id: 'wc1', kind: 'facility', label: '화장실', icon: '🚻', color: '#0ea5e9', n: [0.02, 0.98, 0.05] },
  { id: 'elev', kind: 'facility', label: '엘리베이터', icon: '🛗', color: '#f5c518', n: [0.58, 0.05, -0.5] },
  { id: 'aed', kind: 'facility', label: 'AED', icon: '❤', color: '#22c55e', n: [-0.22, -0.9, -0.3] },
  { id: 'sos', kind: 'facility', label: '비상전화', icon: '☎', color: '#f59e0b', n: [0.36, -0.9, -0.45] },
]

export const FALLBACK_MARKER_SET: StationMarkerSet = {
  half: FALLBACK_HALF,
  markers: FALLBACK_MARKERS,
}

// 안국역(3호선) glb POSITION accessor min/max 로 확인한 half:
//   x∈[-0.951,0.949] y∈[-0.457,0.454] z∈[-0.329,0.328] → 거의 원점 대칭.
// 좌표 기준: 공식 "역 이용 안내도 및 비상대피로"(public/안국역 내부노선도.jpg)
//   x = 경복궁(-) ↔ 종로3가(+) 축, B1(대합실,상단)·B2(대합실,중단)·B3(승강장,하단)을 y 로 구분.
//   출구·층 좌표는 감(pixel 비율)이 아니라 glb POSITION 버퍼를 직접 파싱해
//   실제 정점 좌표(계단 끝 최고점, 각 층 데크의 지배적 y)를 클러스터링해 구한 값이다
//   (스크립트는 임시 파일로 작성 후 삭제 — 필요 시 동일 방식으로 재현 가능).
//   실측 결과: 종로3가측은 계단 다리가 x=0.66(안쪽, 5·4번)/x=0.83(바깥쪽, 2·3번)
//   두 군데서 각각 z=±로 갈라져 정확히 4개의 첨점을 이룸. 경복궁측은 1번이 중앙의
//   높은 첨점(x=-0.75), 6번이 그보다 낮고 더 바깥쪽(x=-0.89)의 별도 돌출부 —
//   이 둘의 배정은 사용자가 라이브 화면에서 직접 확인해 확정한 값이다.
const ANGUK_HALF = { x: 0.9499, y: 0.4554, z: 0.3287 }

const ANGUK_MARKERS: Marker[] = [
  // 층 라벨 — 각 데크의 실측 y(정점 밀도 최고점)에 배치, x/z는 안전지대(계단·설비와 안 겹치는 자리)
  { id: 'b1', kind: 'floor', label: 'B1 · 대합실', n: [-0.632, 0.088, -0.243] },
  { id: 'b2', kind: 'floor', label: 'B2 · 대합실', n: [-0.632, -0.417, -0.243] },
  { id: 'b3', kind: 'floor', label: 'B3 · 승강장', n: [-0.632, -0.944, -0.243] },

  // 경복궁 방면(좌측) 출구 — 1번은 중앙의 높은 첨점(x=-0.75, 실측 최고점).
  { id: 'e1', kind: 'exit', label: '1', n: [-0.792, 0.79, -0.456] },
  // 6번은 그보다 낮고 더 바깥쪽(x=-0.89)에 별도로 튀어나온 돌출부 — 사용자가
  // 스크린샷으로 직접 확인해 1번이 아니라 6번 자리라고 확정.
  { id: 'e6', kind: 'exit', label: '6', n: [-0.937, 0.564, 0.578] },

  // 종로3가 방면(우측) 출구 — 실측 첨점 2곳 × z 분기 2곳 = 4개, 각 첨점 바로 위
  { id: 'e2', kind: 'exit', label: '2', n: [0.696, 1.041, -0.831] },
  { id: 'e5', kind: 'exit', label: '5', n: [0.696, 1.041, 0.824] },
  { id: 'e3', kind: 'exit', label: '3', n: [0.87, 0.94, -0.548] },
  { id: 'e4', kind: 'exit', label: '4', n: [0.87, 0.94, 0.548] },

  // 편의시설 — 모두 B2 데크 실측 y(-0.417)에 배치, 엘리베이터는 정점 스캔으로 찾은
  // 유일한 전층 관통 수직 샤프트(x=-0.38) 위치
  { id: 'elev', kind: 'facility', label: '엘리베이터', icon: '🛗', color: '#f5c518', n: [-0.4, -0.417, -0.198] },
  { id: 'info', kind: 'poi', label: '고객안내센터', icon: 'i', color: '#2f6fed', n: [-0.211, -0.417, 0.456] },
  { id: 'wc1', kind: 'facility', label: '화장실', icon: '🚻', color: '#0ea5e9', n: [0.79, -0.417, 0.243] },
]

// 을지로3가역 — public/markers.json 좌표를 그대로 사용(이미 Y-up 변환 + glb 로컬 좌표계와
//   일치). half=1 로 두면 norm() 이 항등 변환이 되어 원본 좌표를 그대로 배치할 수 있다.
//   (public/Euljiro.glb 는 Blender 에서 마커 좌표를 찍기 위해 저장한 동일 지오메트리 파일이라
//   렌더링에는 기존 Euljiro_3_ga_Station.glb 를 계속 사용해도 좌표가 그대로 들어맞는다.)
const EULJIRO_HALF = { x: 1, y: 1, z: 1 }

const EULJIRO_MARKERS: Marker[] = [
  { id: '1번', kind: 'exit', label: '1', n: [-0.1655, 0.2094, 0.8271] },
  { id: '2번', kind: 'exit', label: '2', n: [-0.1573, 0.2902, 0.569] },
  { id: '3번', kind: 'exit', label: '3', n: [-0.1376, 0.2372, -0.5064] },
  { id: '4번', kind: 'exit', label: '4', n: [-0.9644, 0.2677, -0.5849] },
  { id: '5번', kind: 'exit', label: '5', n: [-0.9498, 0.2634, -0.801] },
  { id: '6번', kind: 'exit', label: '6', n: [-0.1459, 0.2405, -0.8099] },
  { id: '7번', kind: 'exit', label: '7', n: [0.1515, 0.2526, -0.827] },
  { id: '8번', kind: 'exit', label: '8', n: [0.9394, 0.2619, -0.7961] },
  { id: '9번', kind: 'exit', label: '9', n: [0.9508, 0.2762, -0.5877] },
  { id: '10번', kind: 'exit', label: '10', n: [0.1443, 0.2372, -0.5065] },
  { id: '11번', kind: 'exit', label: '11', n: [0.1591, 0.2953, 0.5718] },
  { id: '12번', kind: 'exit', label: '12', n: [0.1575, 0.2042, 0.818] },

  { id: 'elevator1', kind: 'facility', label: '엘리베이터', icon: '🛗', color: '#f5c518', n: [0.0865, 0.3878, -0.6961] },
  { id: 'elevator2', kind: 'facility', label: '엘리베이터', icon: '🛗', color: '#f5c518', n: [0.1217, 0.1713, 0.0497] },
  { id: 'elevator3', kind: 'facility', label: '엘리베이터', icon: '🛗', color: '#f5c518', n: [-0.1384, 0.1764, 0.0479] },

  { id: 'toliet1', kind: 'facility', label: '화장실', icon: '🚻', color: '#0ea5e9', n: [-0.1165, 0.1255, -0.0303] },
  { id: 'toliet2', kind: 'facility', label: '화장실', icon: '🚻', color: '#0ea5e9', n: [-0.1449, -0.132, -0.7411] },

  { id: 'turnstile1', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [-0.1126, 0.1241, 0.5271] },
  { id: 'turnstile2', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [0.0987, 0.1301, 0.5454] },
  { id: 'turnstile3', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [-0.0945, 0.1177, 0.0568] },
  { id: 'turnstile4', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [0.0808, 0.1236, 0.0397] },
  { id: 'turnstile5', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [-0.5389, 0.123, -0.6413] },
  { id: 'turnstile6', kind: 'facility', label: '개찰구', icon: '🎫', color: '#64748b', n: [0.5397, 0.1223, -0.6337] },

  { id: 'csc1', kind: 'poi', label: '고객안내센터', icon: 'i', color: '#2f6fed', n: [0.1127, 0.116, 0.3799] },
  { id: 'csc2', kind: 'poi', label: '고객안내센터', icon: 'i', color: '#2f6fed', n: [-0.2401, 0.1188, -0.7279] },
]

export const STATION_MARKER_SETS: Record<string, StationMarkerSet> = {
  's-anguk': { half: ANGUK_HALF, markers: ANGUK_MARKERS },
  's-euljiro3-l3': { half: EULJIRO_HALF, markers: EULJIRO_MARKERS },
  's-euljiro3-l2': { half: EULJIRO_HALF, markers: EULJIRO_MARKERS },
}

export function getMarkerSet(stationId: string | null | undefined): StationMarkerSet {
  if (stationId && STATION_MARKER_SETS[stationId]) return STATION_MARKER_SETS[stationId]
  return FALLBACK_MARKER_SET
}
