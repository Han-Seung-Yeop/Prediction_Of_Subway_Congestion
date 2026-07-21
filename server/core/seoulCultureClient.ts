// 서울 열린데이터광장 — 문화행사 정보(culturalEventInfo) 저수준 클라이언트
//   공연·콘서트·축제·전시 일정. 도착정보와 동일한 SEOUL_OPENAPI_KEY 사용(신규 키 불필요).
//   좌표(LAT/LOT)가 응답에 내장 → 프론트가 최근접 역으로 매핑.
//   문서형 URL: http://openapi.seoul.go.kr:8088/{KEY}/json/culturalEventInfo/{start}/{end}/{CODENAME}/{TITLE}/{DATE}

import { SeoulError } from './seoulClient'
import type { EventRaw } from './eventTypes'

const CULTURE_BASE = 'http://openapi.seoul.go.kr:8088'

function requireApiKey(): string {
  const key = process.env.SEOUL_OPENAPI_KEY
  if (!key) throw new SeoulError('SEOUL_OPENAPI_KEY 환경변수가 설정되지 않았습니다', 'no-key')
  return key
}

/** CODENAME(원본 분류) → 앱 대분류 */
function codenameToType(codename: string): EventRaw['type'] {
  const c = codename.replace(/\s/g, '')
  if (/축제/.test(c)) return 'festival'
  if (/(콘서트|클래식|국악|무용|오페라|뮤지컬|연극|대중음악|독주|독창|음악)/.test(c)) return 'concert'
  return 'festival' // 전시/미술·교육/체험·영화·기타 → 축제성(비공연) 취급
}

/** "2026-10-28 00:00:00.0" → "2026-10-28" */
function dateOnly(s: string | undefined): string | undefined {
  if (!s) return undefined
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s.trim())
  return m ? m[1] : undefined
}

/** "(수) 19:30" 등에서 첫 HH:MM 추출 */
function timeFromProTime(pro: string | undefined): string | undefined {
  if (!pro) return undefined
  const m = /(\d{1,2}):(\d{2})/.exec(pro)
  if (!m) return undefined
  const hh = m[1].padStart(2, '0')
  return `${hh}:${m[2]}`
}

interface RawCultureRow {
  CODENAME?: string
  TITLE?: string
  PLACE?: string
  STRTDATE?: string
  END_DATE?: string
  PRO_TIME?: string
  LAT?: string
  LOT?: string
  IS_FREE?: string
  MAIN_IMG?: string
}

function toEvent(r: RawCultureRow): EventRaw | null {
  const lat = Number(r.LAT)
  const lng = Number(r.LOT)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null
  const startDate = dateOnly(r.STRTDATE)
  if (!startDate) return null
  const time = timeFromProTime(r.PRO_TIME)
  return {
    source: 'culture',
    type: codenameToType(r.CODENAME ?? ''),
    title: (r.TITLE ?? '').trim(),
    category: (r.CODENAME ?? '').trim(),
    venue: (r.PLACE ?? '').trim(),
    lat,
    lng,
    start: time ? `${startDate}T${time}:00` : startDate,
    end: dateOnly(r.END_DATE),
    isFree: r.IS_FREE ? r.IS_FREE.trim() === '무료' : undefined,
    imageUrl: r.MAIN_IMG?.trim() || undefined,
  }
}

/**
 * 특정 날짜(YYYY-MM-DD)에 열리는 문화행사 조회.
 *   DATE 위치필터로 그 날짜에 활성인 행사만 받아 소량으로 처리.
 */
export async function fetchCultureEvents(date: string, max = 200): Promise<EventRaw[]> {
  const key = requireApiKey()
  const blank = encodeURIComponent(' ') // CODENAME/TITLE 자리는 공백으로 건너뜀
  const url = `${CULTURE_BASE}/${encodeURIComponent(key)}/json/culturalEventInfo/1/${max}/${blank}/${blank}/${encodeURIComponent(date)}`

  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (e) {
    throw new SeoulError(`문화행사 네트워크 오류: ${String(e)}`, 'network')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new SeoulError(`문화행사 응답 오류 ${res.status} ${detail}`.trim(), 'http', res.status)
  }
  const data = (await res.json()) as {
    culturalEventInfo?: { row?: RawCultureRow[]; RESULT?: { CODE?: string; MESSAGE?: string } }
    RESULT?: { CODE?: string; MESSAGE?: string }
  }
  const body = data.culturalEventInfo
  if (body && Array.isArray(body.row)) {
    return body.row.map(toEvent).filter((e): e is EventRaw => e !== null)
  }
  // 데이터 없음(INFO-200) → 빈 배열, 인증오류는 throw
  const code = body?.RESULT?.CODE ?? data.RESULT?.CODE ?? ''
  const message = body?.RESULT?.MESSAGE ?? data.RESULT?.MESSAGE ?? '알 수 없는 응답'
  if (code === 'INFO-200') return []
  if (/인증|KEY/i.test(message) || code.startsWith('ERROR-3')) {
    throw new SeoulError(`문화행사 인증 오류: ${code} ${message}`.trim(), 'auth')
  }
  throw new SeoulError(`문화행사 응답 파싱 실패: ${code} ${message}`.trim(), 'shape')
}
