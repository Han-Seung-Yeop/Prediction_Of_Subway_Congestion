// ODsay Subway Map SDK(odsay.maps.Subway) 전역 타입 선언.
// https://api.odsay.com/v1/api/subway/sdk.js 가 window.odsay 를 채워 넣는다.
// 공식 문서에 타입 정의가 없어, ODsay LAB 공개 데모(lab.odsay.com/guide/subwayMapDemo)의
// 실제 소스에서 확인된 필드/메서드만 반영했다. 확인되지 않은 상세 스펙은 unknown 으로 둔다.
export type {
  OdsaySubwayStationData,
  OdsaySubwayPathData,
  OdsaySubwayMapInstance,
  OdsaySearchStationResponse,
  OdsayMarkerType,
}

interface OdsaySubwayStationData {
  stationID: string | number
  stationName: string
  lineID?: string | number
  exOBJ?: { station?: Array<{ stationID: string | number; [key: string]: unknown }> }
  [key: string]: unknown
}

interface OdsaySubwayPathError {
  message: string
  [key: string]: unknown
}

interface OdsaySubwayPathData {
  error?: OdsaySubwayPathError[]
  path?: Array<{ pathType: number; [key: string]: unknown }>
  [key: string]: unknown
}

interface OdsaySearchStationResponse {
  result?: {
    totalCount: number
    station: OdsaySubwayStationData[]
  }
}

type OdsayMarkerType = 's' | 'e' | 'm'

interface OdsaySubwayMapInstance {
  addEvent(name: 'start_changed' | 'end_changed' | 'middle_changed', handler: (data: OdsaySubwayStationData) => void): void
  addEvent(name: 'path_changed', handler: (data: OdsaySubwayPathData) => void): void
  addEvent(name: 'path_init' | 'line_init', handler: () => void): void
  addEvent(name: 'detail_clicked', handler: (data: { result: OdsaySubwayStationData }) => void): void
  /** setCID/setLang 로 새 지도 svg 로드가 끝나면 발생 — 원본 sdk core.js 의 _triggerEvent("ready", ...) 확인 */
  addEvent(name: 'ready', handler: (data: { CID: number; lang: number }) => void): void
  addEvent(name: string, handler: (data?: unknown) => void): void
  setCID(cityCode: number): void
  getCID(): number
  setLang(langCode: number): void
  zoomIn(): void
  zoomOut(): void
  /** 확대 배율 1~4 단계로 직접 지정 (원본 sdk core.js 의 setLevel 확인) */
  setLevel(level: 1 | 2 | 3 | 4): void
  /** 특정 역을 화면 중앙으로 이동. zoomIn:true 면 현재 배율이 4 미만일 때 4로 확대 (원본 sdk core.js 의 setCenter 확인) */
  setCenter(stationID: string | number, options?: { zoomIn?: boolean }): void
  searchStation(query: string): Promise<OdsaySearchStationResponse>
  addMarker(type: OdsayMarkerType, stationID: string | number): void
  removeMarker(type: OdsayMarkerType): void
  addContextMenu(stationID: string | number, options?: Record<string, unknown>): void
  removeContextMenu(): void
  lineHighlight(subPath: unknown): void
  lineHighlightByType(lineType: number): void
  removeLine(): void
  setSubwayPathSearchOption(mode: number, day: number, time: string): Promise<void>
}

declare global {
  interface Window {
    odsay?: {
      maps: {
        Subway: new (container: HTMLElement) => OdsaySubwayMapInstance
      }
    }
  }
}
