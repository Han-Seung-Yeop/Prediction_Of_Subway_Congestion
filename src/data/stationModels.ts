// ─────────────────────────────────────────────────────────────
// 역 id → 역 내부노선 glb 매칭 (시연 3역만).
//   Station3D 와 뷰(RouteView/ExploreView)가 three.js 없이도 같이 참조할 수
//   있도록 별도 파일로 분리. 을지로3가는 2·3호선 역 엔티티가 갈려 있어 둘 다 매핑.
// ─────────────────────────────────────────────────────────────

export interface StationModel {
  url: string
  label: string
}

export const FALLBACK_STATION_MODEL: StationModel = {
  url: '/Meshy_AI_역삼역_내부노선_0708063828_generate.glb',
  label: '역삼역',
}

export const STATION_MODELS: Record<string, StationModel> = {
  's-anguk': { url: '/Anguk_Station.glb', label: '안국역' },
  's-euljiro3-l3': { url: '/Euljiro_3_ga_Station.glb', label: '을지로3가역' },
  's-euljiro3-l2': { url: '/Euljiro_3_ga_Station.glb', label: '을지로3가역' },
  's-seongsu': { url: '/Seongsu.glb', label: '성수역' },
}

/** 해당 역의 실제 glb 모델이 있는지 (없으면 Station3D 가 역삼역 예시로 대체) */
export function hasStationModel(stationId: string | null | undefined): boolean {
  return !!stationId && stationId in STATION_MODELS
}
