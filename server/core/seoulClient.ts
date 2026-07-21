// 서울 열린데이터광장 — 지하철 실시간 도착정보(realtimeStationArrival) 저수준 클라이언트
//   - 인증키(SEOUL_OPENAPI_KEY)는 서버 환경변수에만 보관 → 프론트 번들에 절대 노출 안 됨
//   - 프레임워크 무관(순수 fetch). 서버리스 함수/Vite 개발 미들웨어/상시 Node 서버 어디서든 재사용.
//   - 한 역의 "모든 노선·양방향" 열차를 돌려준다. (노선/방향 필터링은 프론트 어댑터가 담당)
//   문서: http://swopenapi.seoul.go.kr/api/subway/{KEY}/json/realtimeStationArrival/{START}/{END}/{역명}

const SEOUL_BASE = 'http://swopenapi.seoul.go.kr'

export type SeoulErrorCode = 'no-key' | 'auth' | 'http' | 'shape' | 'network'

/** 서울 도착정보 호출 실패를 코드와 함께 표현 (핸들러에서 상태코드·폴백 판단에 사용) */
export class SeoulError extends Error {
  code: SeoulErrorCode
  status?: number
  constructor(message: string, code: SeoulErrorCode, status?: number) {
    super(message)
    this.name = 'SeoulError'
    this.code = code
    this.status = status
  }
}

function requireApiKey(): string {
  const key = process.env.SEOUL_OPENAPI_KEY
  if (!key) throw new SeoulError('SEOUL_OPENAPI_KEY 환경변수가 설정되지 않았습니다', 'no-key')
  return key
}

/** 프론트로 넘길 정규화된 도착 항목 (원본 필드 중 필요한 것만) */
export interface StationArrival {
  /** 노선 코드 ("1002"=2호선, "1003"=3호선 …) */
  subwayId: string
  /** "상행"/"하행" 또는 순환선 "내선"/"외선" */
  updnLine: string
  /** 열차 방면 라벨 (예: "성수행 - 신설동방면") */
  trainLineNm: string
  /** 종착역명 (예: "성수") */
  bstatnNm: string
  /** 도착 예정 잔여 시간(초). API가 0/미상이면 null */
  barvlDt: number | null
  /** 안내 문구 2 (예: "전역 도착", "2분 후 (왕십리)") */
  arvlMsg2: string
  /** 현재 위치 안내 (예: "왕십리") */
  arvlMsg3: string
  /** 도착 코드 (0:진입 1:도착 2:출발 3:전역출발 4:전역진입 5:전역도착 99:운행중) */
  arvlCd: string
}

interface RawArrival {
  subwayId?: string
  updnLine?: string
  trainLineNm?: string
  bstatnNm?: string
  barvlDt?: string
  arvlMsg2?: string
  arvlMsg3?: string
  arvlCd?: string
}

function toArrival(r: RawArrival): StationArrival {
  const dt = Number(r.barvlDt)
  return {
    subwayId: r.subwayId ?? '',
    updnLine: r.updnLine ?? '',
    trainLineNm: r.trainLineNm ?? '',
    bstatnNm: r.bstatnNm ?? '',
    barvlDt: Number.isFinite(dt) && dt > 0 ? dt : null,
    arvlMsg2: r.arvlMsg2 ?? '',
    arvlMsg3: r.arvlMsg3 ?? '',
    arvlCd: r.arvlCd ?? '',
  }
}

/**
 * 역명(한글, "역" 접미사 없이 예:"성수")으로 실시간 도착정보 조회.
 *   - 도착 열차가 없으면(INFO-200) 빈 배열 반환(오류 아님) → 프론트는 목업으로 폴백.
 *   - 인증키 오류(INFO-100/300류)는 auth 로 throw.
 */
export async function fetchStationArrivals(stationNm: string): Promise<StationArrival[]> {
  const apiKey = requireApiKey()
  const path = `/api/subway/${encodeURIComponent(apiKey)}/json/realtimeStationArrival/0/20/${encodeURIComponent(stationNm)}`

  let res: Response
  try {
    res = await fetch(`${SEOUL_BASE}${path}`, { headers: { accept: 'application/json' } })
  } catch (e) {
    throw new SeoulError(`서울 도착정보 네트워크 오류: ${String(e)}`, 'network')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new SeoulError(`서울 도착정보 응답 오류 ${res.status} ${detail}`.trim(), 'http', res.status)
  }

  const data = (await res.json()) as {
    realtimeArrivalList?: RawArrival[]
    errorMessage?: { code?: string; message?: string }
    code?: string
    message?: string
  }

  // 정상: realtimeArrivalList 배열 존재
  if (Array.isArray(data.realtimeArrivalList)) {
    return data.realtimeArrivalList.map(toArrival)
  }

  // 데이터 없음(INFO-200) → 빈 배열. 그 외 코드는 진단해서 분기.
  const code = data.errorMessage?.code ?? data.code ?? ''
  const message = data.errorMessage?.message ?? data.message ?? '알 수 없는 응답'
  if (code === 'INFO-200') return [] // 도착 예정 열차 없음(막차 이후 등)
  if (code === 'INFO-100' || code === 'INFO-300' || /인증/.test(message)) {
    throw new SeoulError(`서울 도착정보 인증 오류: ${code} ${message}`.trim(), 'auth')
  }
  throw new SeoulError(`서울 도착정보 응답 파싱 실패: ${code} ${message}`.trim(), 'shape')
}
