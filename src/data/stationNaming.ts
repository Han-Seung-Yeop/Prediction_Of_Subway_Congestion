// 역·노선 이름 정규화 계층
//   내부 목업 표기 ↔ 외부 벤더(SK/TMAP 경로·혼잡도, ODsay 노선도 위젯) 표기의
//   흔들림("성수" vs "성수역", "을지로3가" vs "을지로 3가(2호선)")을 흡수한다.
//
//   SK/TMAP은 숫자 표준 역코드가 아니라 한글 노선명("2호선")+역명("성수")을 키로 쓰므로,
//   숫자 코드 매핑 대신 이 "이름 정규화"만으로 매칭이 성립한다. (구현계획 §5)
//
//   ⚠️ 의존성 없는 순수 모듈로 유지한다(subway.ts ↔ 순환참조 방지, 단독 테스트 가능).

/**
 * 역명 정규화.
 *   - NFC 정규화(자모 결합 통일)
 *   - 괄호 부가정보 제거: "성수(2호선)" → "성수"
 *   - 접미사 "역" 제거: "성수역" → "성수"
 *   - 모든 공백 제거: "을지로 3가" → "을지로3가"
 * 비교는 이 정규화 결과끼리 `===` 로 한다.
 */
export function normalizeStationName(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .replace(/\([^)]*\)/g, '') // 괄호 부가정보 "(2호선)" 등
    .replace(/\s+/g, '') // 내부·양끝 공백
    .replace(/역$/, '') // 접미사 "역"
}

/** 두 역명이 정규화 후 같은 역을 가리키는지 */
export function stationNameMatches(a: string, b: string): boolean {
  return normalizeStationName(a) === normalizeStationName(b)
}

/**
 * SK/TMAP 칸 혼잡도 API용 역명(`stationNm`).
 *   실측 결과 SK는 접미사 "역"을 **붙인** 형태를 요구한다("성수"→400, "성수역"→정상).
 *   정규화로 "역"을 한번 벗긴 뒤 정확히 한 번 다시 붙여 표기 흔들림을 흡수한다.
 */
export function toSkStationNm(name: string): string {
  return `${normalizeStationName(name)}역`
}

/**
 * 서울 열린데이터광장 실시간 도착정보 API용 역명(`statnNm`).
 *   SK 와 달리 접미사 "역" **없이** 순수 역명을 쓴다("성수", "을지로3가").
 */
export function toSeoulStationNm(name: string): string {
  return normalizeStationName(name)
}

/**
 * 내부 노선 → 서울 도착정보 노선 코드(`subwayId`).
 *   1~9호선은 "100N" 규칙("2"→"1002"). 그 외(경의중앙/신분당 등)는 확장 지점.
 *   매칭 불가면 null → 프론트는 노선 필터 없이(또는 목업으로) 처리한다.
 */
export function lineToSeoulSubwayId(line: { name: string; label: string }): string | null {
  const m = /^(\d)$/.exec(line.name.trim()) ?? /^(\d)호선$/.exec(line.label.trim())
  if (m) return `100${m[1]}`
  return null
}

/**
 * 내부 방향(`Direction`)이 서울 `updnLine`("상행"/"하행"/"내선"/"외선")과 같은 방향인지.
 *   내부 label 이 "상행"/"하행"/"내선순환"/"외선순환" 이라 `label` 이 `updnLine` 으로 시작하면 일치.
 *   (순환선 2호선: label "내선순환" ⊃ updnLine "내선")
 */
export function directionMatchesUpdn(label: string, updnLine: string): boolean {
  const a = label.normalize('NFC').replace(/\s+/g, '')
  const b = updnLine.normalize('NFC').replace(/\s+/g, '')
  if (!a || !b) return false
  return a.startsWith(b) || b.startsWith(a)
}

/**
 * 내부 노선 → SK/TMAP `routeNm`("2호선").
 *   현재 내부 `Line.label` 이 이미 SK 표기("2호선","3호선")와 일치하므로 그대로 통과시킨다.
 *   지선(2호선 성수지선/신정지선 등)·신분당선 등으로 구간이 확장되면
 *   이 함수 한 곳에서 매핑 규칙을 확장한다(호출부는 불변).
 */
export function lineToRouteNm(line: { name: string; label: string }): string {
  const label = line.label.trim()
  if (/호선$/.test(label)) return label // "2호선" 형태 그대로
  if (/^\d+$/.test(line.name)) return `${line.name}호선` // "2" → "2호선"
  return label
}
