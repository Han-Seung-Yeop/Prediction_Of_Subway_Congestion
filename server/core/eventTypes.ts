// 이벤트 소스 공통 정규화 타입 (서버 → 프론트)
//   서울 문화행사(공연/축제/전시) + 네이버 스포츠(야구/축구)를 한 형태로 통일.
//   역 매핑(좌표→최근접 역)·delta 산출은 프론트가 담당(프론트에 역 디렉터리·룰이 있음).

export interface EventRaw {
  /** 원천 소스 */
  source: 'culture' | 'kbo' | 'kleague'
  /** 앱 이벤트 대분류 (아이콘/기본 delta 결정용) */
  type: 'concert' | 'festival' | 'sports'
  /** 표시 제목 (예: "LG vs 두산", "M 클래식 축제") */
  title: string
  /** 원본 세부 분류 (문화행사 CODENAME "콘서트/전시/미술" 또는 리그명 "KBO"/"K리그") */
  category: string
  /** 장소명 (공연장/구장) */
  venue: string
  /** 위도(WGS84) */
  lat: number
  /** 경도(WGS84) */
  lng: number
  /** 시작 일시 (ISO, 가능하면 시각까지) */
  start: string
  /** 종료 일시 (ISO, 다일 행사면 존재) */
  end?: string
  /** 무료 여부 (문화행사) */
  isFree?: boolean
  /** 대표 이미지 URL (문화행사) */
  imageUrl?: string
}
