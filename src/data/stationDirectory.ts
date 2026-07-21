// 수도권 전 역 디렉터리 — 공공데이터(전국도시철도역사정보표준데이터)에서 추출한
//   { 역명 · 노선명 · 위경도(WGS84) } 를 앱의 Station/Line 형태로 변환한다.
//   리치 데이터(승강장 구조물·3D·방향)를 가진 데모 15역과 별개이며, subway.ts 의
//   조회 함수(getStation/getLine/findStationByExactName/searchStations)가 리치를
//   우선 조회하고 없으면 이 디렉터리로 폴백한다. (구현계획 §5 전 역 확장)

import rawData from './stationDirectory.json'
import type { Line, Station } from './types'

interface DirEntry {
  name: string
  line: string
  lat: number
  lng: number
}
const raw = rawData as DirEntry[]

/** 한글 노선명 → 내부 lineId. "N호선"(1~9)은 기존 리치 규칙(lineN)과 통일 → 데모 노선과 연결 */
export function lineIdForKorean(koreanLine: string): string {
  const m = koreanLine.match(/([1-9])호선/)
  if (m) return `line${m[1]}`
  return 'line-' + koreanLine.replace(/\s+/g, '')
}

/** 알려진 노선 색상 (수도권 주요 노선). 없으면 기본 회색 */
const LINE_COLOR: Record<string, string> = {
  line1: '#0d3692',
  line2: '#35b12b',
  line3: '#fa5f2c',
  line4: '#00a2d1',
  line5: '#8b50a4',
  line6: '#c55c1d',
  line7: '#54640d',
  line8: '#f14ea2',
  line9: '#aa9872',
  'line-신분당선': '#d4003b',
  'line-경의중앙선': '#77c4a3',
  'line-분당선': '#f5a200',
  'line-수인선': '#f5a200',
  'line-경춘선': '#0c8e72',
  'line-인천국제공항선': '#0090d2',
  'line-우이신설선': '#b7c452',
  'line-신림선': '#6789ca',
}
const DEFAULT_COLOR = '#8a8f98'

function shortName(lineId: string, koreanLine: string): string {
  const m = lineId.match(/^line(\d)$/)
  if (m) return m[1]
  return koreanLine.replace(/\s+/g, '').replace(/선$/, '').slice(0, 2)
}

function displayLabel(lineId: string, koreanLine: string): string {
  const m = lineId.match(/^line(\d)$/)
  if (m) return `${m[1]}호선`
  return koreanLine.replace(/\s+/g, '')
}

const _stations: Station[] = []
const _lines = new Map<string, Line>()
const _seen = new Set<string>()

for (const e of raw) {
  const lineId = lineIdForKorean(e.line)
  if (!_lines.has(lineId)) {
    _lines.set(lineId, {
      id: lineId,
      name: shortName(lineId, e.line),
      label: displayLabel(lineId, e.line),
      color: LINE_COLOR[lineId] ?? DEFAULT_COLOR,
    })
  }
  const id = `d-${lineId}-${e.name}`
  if (_seen.has(id)) continue // 노선명 변형(9호선 등)으로 같은 역이 겹치면 첫 항목만
  _seen.add(id)
  _stations.push({ id, name: e.name, lineId, lat: e.lat, lng: e.lng })
}

/** 디렉터리 전 역 (좌표 포함, order/구조물 없음) */
export const directoryStations: Station[] = _stations
/** 디렉터리에서 파생한 노선 메타 */
export const directoryLines: Line[] = [..._lines.values()]
