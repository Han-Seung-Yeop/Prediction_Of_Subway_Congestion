// 네이버 스포츠 스케줄(비공식 내부 JSON API) 저수준 클라이언트 — KBO 야구 + K리그 축구.
//   비공식 엔드포인트라 언제든 바뀔 수 있음 → 상위(handleEvents)에서 소스별로 독립 catch,
//   프론트는 실패 시 목업/타 소스로 폴백. Referer 헤더는 출처 표시(인증키 아님).
//   응답에 구장 필드가 없어, 홈팀→홈구장(좌표) 정적 매핑으로 위치를 부여한다(좌표→역 매핑은 프론트).

import type { EventRaw } from './eventTypes'

const NAVER_BASE = 'https://api-gw.sports.naver.com'
const REFERER = 'https://sports.news.naver.com/'

/** 홈팀명(네이버 표기) → 홈 경기장(좌표). 수도권 위주 + 주요 지방(지방은 프론트 거리컷으로 자동 제외됨) */
const HOME_VENUES: Record<string, { venue: string; lat: number; lng: number }> = {
  // KBO
  두산: { venue: '잠실야구장', lat: 37.5122, lng: 127.0719 },
  LG: { venue: '잠실야구장', lat: 37.5122, lng: 127.0719 },
  키움: { venue: '고척스카이돔', lat: 37.4982, lng: 126.8672 },
  KT: { venue: '수원KT위즈파크', lat: 37.2999, lng: 127.0097 },
  SSG: { venue: '인천SSG랜더스필드', lat: 37.437, lng: 126.6932 },
  KIA: { venue: '광주기아챔피언스필드', lat: 35.1682, lng: 126.8891 },
  삼성: { venue: '대구삼성라이온즈파크', lat: 35.841, lng: 128.6817 },
  롯데: { venue: '부산사직야구장', lat: 35.194, lng: 129.0615 },
  한화: { venue: '대전한화생명볼파크', lat: 36.317, lng: 127.429 },
  NC: { venue: '창원NC파크', lat: 35.2225, lng: 128.5823 },
  // K리그
  서울: { venue: '서울월드컵경기장', lat: 37.5683, lng: 126.8974 },
  서울E: { venue: '목동종합운동장', lat: 37.5347, lng: 126.8757 },
  수원FC: { venue: '수원종합운동장', lat: 37.3017, lng: 127.0069 },
  수원: { venue: '수원월드컵경기장', lat: 37.2867, lng: 127.0366 },
  인천: { venue: '인천축구전용경기장', lat: 37.472, lng: 126.6301 },
  안양: { venue: '안양종합운동장', lat: 37.4018, lng: 126.9447 },
  부천: { venue: '부천종합운동장', lat: 37.5052, lng: 126.792 },
  김포: { venue: '김포솔터축구장', lat: 37.615, lng: 126.716 },
  성남: { venue: '탄천종합운동장', lat: 37.4213, lng: 127.1265 },
  안산: { venue: '안산와스타디움', lat: 37.3389, lng: 126.8407 },
  천안: { venue: '천안종합운동장', lat: 36.8623, lng: 127.1585 },
}

interface RawGame {
  gameId?: string
  gameDateTime?: string
  homeTeamName?: string
  awayTeamName?: string
  statusCode?: string
  cancel?: boolean
}

function toEvent(g: RawGame, source: 'kbo' | 'kleague', league: string): EventRaw | null {
  if (g.cancel) return null
  const home = g.homeTeamName?.trim()
  const away = g.awayTeamName?.trim()
  const start = g.gameDateTime?.trim()
  if (!home || !away || !start) return null
  const v = HOME_VENUES[home]
  if (!v) return null // 구장 매핑 없는 팀은 위치 부여 불가 → 제외
  return {
    source,
    type: 'sports',
    title: `${home} vs ${away}`,
    category: league,
    venue: v.venue,
    lat: v.lat,
    lng: v.lng,
    start,
  }
}

async function fetchGames(
  date: string,
  upperCategoryId: string,
  categoryId: string,
): Promise<RawGame[]> {
  const url = new URL('/schedule/games', NAVER_BASE)
  url.searchParams.set('fromDate', date)
  url.searchParams.set('toDate', date)
  url.searchParams.set('upperCategoryId', upperCategoryId)
  url.searchParams.set('categoryId', categoryId)
  url.searchParams.set('size', '30')
  const res = await fetch(url, { headers: { Referer: REFERER, accept: 'application/json' } })
  if (!res.ok) throw new Error(`네이버 스포츠 응답 오류 ${res.status}`)
  const data = (await res.json()) as { result?: { games?: RawGame[] } }
  return Array.isArray(data.result?.games) ? data.result!.games! : []
}

/** 특정 날짜(YYYY-MM-DD)의 KBO + K리그 경기를 EventRaw 로. */
export async function fetchSportsEvents(date: string): Promise<EventRaw[]> {
  const [kbo, kleague] = await Promise.all([
    fetchGames(date, 'kbaseball', 'kbo'),
    fetchGames(date, 'kfootball', 'kleague'),
  ])
  const events: EventRaw[] = []
  for (const g of kbo) {
    const e = toEvent(g, 'kbo', 'KBO')
    if (e) events.push(e)
  }
  for (const g of kleague) {
    const e = toEvent(g, 'kleague', 'K리그')
    if (e) events.push(e)
  }
  return events
}
