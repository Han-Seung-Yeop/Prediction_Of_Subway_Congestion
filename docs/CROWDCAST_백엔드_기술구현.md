# CROWDCAST 백엔드 기술 구현 기록

> 작성일 2026-07-13 · 상태: **누적 기록 중**
>
> 이 문서는 **백엔드를 한 단계씩 완료할 때마다** 실제로 사용한 기술 스택·라이브러리·구성
> 방법·의사결정을 **차례로 정리**하는 실행 기록서다. "무엇을 할지"는
> [`CROWDCAST_백엔드_구현계획.md`](./CROWDCAST_백엔드_구현계획.md)(계획), 이 문서는 **"실제로 무엇을 어떻게 했는지"**(결과)를 담는다.
>
> **작성 규칙**
> - 계획서 §7의 단계 하나를 **완료할 때마다** 이 문서에 항목을 추가한다.
> - 각 항목은 아래 §템플릿 형식(적용 기술 / 변경 파일 / 구성 방법 / 결정·근거 / 검증)을 따른다.
> - 아직 착수하지 않은 단계는 "예정" 자리표시자만 두고, 완료 시 채운다.

---

## 기술 스택 개요 (현재까지)

| 영역 | 채택 기술 | 비고 |
|---|---|---|
| 프론트엔드 | React 18 + TypeScript + Vite 5 | 기존 프로토타입 그대로 |
| 스타일 | Tailwind CSS | 기존 |
| 3D | three.js / react-three-fiber | 기존 |
| 어댑터 계약 | `Promise` 기반 async 인터페이스 | **§3에서 확정** |
| 프록시/서버 | **Vercel 서버리스 함수(Node)** + Vite 개발 미들웨어 | **§4 확정** — 프레임워크 무관 코어, 추후 Node 서버 상향 가능 |
| 경로·혼잡도 API | SK/TMAP 대중교통 API (공용 `appKey`, `TMAP 대중교통` 단일 상품) | **혼잡도 연동됨**, 경로는 좌표 후 |
| 캐싱 | `cache-control: s-maxage`(CDN/프록시) 1차 | 혼잡도 600s. 이벤트/경로는 추후 |
| 이벤트 예측 | Python + XGBoost/LightGBM (계획) | §6, 최후순위 |

---

## [§3] 어댑터 async 전환 + 로딩/에러 UI — ✅ 완료 (2026-07-13)

실 네트워크 호출(§4~)에 대비해 UI↔어댑터 계약을 **동기 → 비동기(`Promise`)** 로 전환했다.
백엔드 없이 프론트만으로 완결되는 선행 작업이며, 이후 실 구현체를 **UI 변경 없이 갈아끼우기 위한 전제 조건**이다.

**적용 기술 / 패턴**
- TypeScript `Promise<T>` 반환 인터페이스로 어댑터 계약 변경
- React `useEffect` + **취소 플래그(cleanup)** 패턴 — async 결과의 경쟁 상태(race) 방지, 최신 요청만 반영
- `async/await` + `try/catch/finally` 로 로딩·에러 상태 관리
- 기존 3D 로딩 스피너(Tailwind `animate-spin`) 패턴 재사용

**변경 파일**
| 파일 | 변경 |
|---|---|
| `src/services/routing.ts` | `RouteProvider.findRoutes` → `Promise<RoutePlan[]>`, `mockRouteProvider`를 `async`로 (로직 유지) |
| `src/services/congestion.ts` | `CongestionProvider.forBoarding` → `Promise<RouteCongestion>`, `mockCongestionProvider`를 `async`로 |
| `src/views/RouteView.tsx` | `find()` async화 + `finding`·`routeError` 상태 / 혼잡도를 `useMemo`→`useEffect`+취소플래그로 전환, `congestion`·`congestionError` 상태 / 로딩·에러 UI |
| `src/components/route/RouteControls.tsx` | `RouteInput`에 `finding` prop → 버튼 스피너("경로 찾는 중…") |

**구성 방법 / 핵심 코드**
```ts
// 취소 플래그로 최신 혼잡도 요청만 반영 (RouteView.tsx)
useEffect(() => {
  if (!leg) { setCongestion(null); return }
  let cancelled = false
  mockCongestionProvider.forBoarding({ ... })
    .then((r) => { if (!cancelled) setCongestion(r) })
    .catch(() => { if (!cancelled) { setCongestion(null); setCongestionError(true) } })
  return () => { cancelled = true }
}, [leg, effectiveHour, isFinalLeg])
```

**결정 / 근거**
- mock 구현체는 `async` 키워드만 추가(내부 Dijkstra·predict 로직 무변경) → 리스크 최소화.
- 혼잡도는 leg/시각 변경 시 재조회되므로, 늦게 도착한 이전 응답이 화면을 덮어쓰지 않도록 취소 플래그 필수.
- 로딩/에러는 별도 컴포넌트 대신 기존 스피너·문구 스타일 재사용해 시각적 일관성 유지.

**검증**
- `npx tsc --noEmit` 통과 (타입 오류 0)
- `npm run build` 성공 (기존 three.js 청크 크기 경고만, 이번 변경과 무관)
- 유일 소비처가 `RouteView` 한 곳뿐임을 grep으로 확인 → 누락된 await 없음

---

## [§5] 역 이름 정규화 유틸 — ✅ 완료 (2026-07-13)

내부 목업 표기 ↔ 외부 벤더(SK/TMAP·ODsay) 표기의 흔들림("성수"/"성수역", "을지로3가"/"을지로 3가(2호선)")을
흡수하는 정규화 계층을 추가했다. SK/TMAP이 숫자 역코드가 아니라 한글 노선명+역명을 키로 쓰므로,
코드 매핑 없이 **이름 정규화만으로 매칭**이 성립한다.

**적용 기술 / 패턴**
- 순수 함수 정규화(부수효과·의존성 0) — `subway.ts`와 순환참조 방지 + 단독 트랜스파일 테스트 가능하게 설계
- 유니코드 `String.prototype.normalize('NFC')` 로 자모 결합 통일(macOS/Windows 입력 차이 대비)
- 정규식 파이프라인: 괄호 부가정보 제거 → 공백 제거 → 접미사 "역" 제거
- 비교는 정규화 결과끼리 `===` (별도 fuzzy 매칭 라이브러리 미사용 — 데모 범위엔 과함)

**변경 파일**
| 파일 | 변경 |
|---|---|
| `src/data/stationNaming.ts` (신규) | `normalizeStationName`, `stationNameMatches`, `lineToRouteNm` |
| `src/data/subway.ts` | `findStationByExactName`을 완전일치 → **정규화 후 비교**로 보강 (`stationNaming` import) |

**구성 방법 / 핵심 코드**
```ts
export function normalizeStationName(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .replace(/\([^)]*\)/g, '') // "(2호선)" 등 괄호 부가정보
    .replace(/\s+/g, '')       // 내부·양끝 공백
    .replace(/역$/, '')        // 접미사 "역"
}
// lineToRouteNm: 내부 label("2호선")이 이미 SK routeNm과 동일 → 그대로 통과.
//   지선/신분당선 확장 시 이 함수 한 곳에서 매핑 규칙 확장(호출부 불변).
```

**결정 / 근거**
- **코드 유틸만** 채택(예외 매핑 JSON 병행은 보류) — 계획서 §5 미결정 사항. 시연 3역 범위엔 규칙만으로 충분, 확장 시 재검토.
- `lineToRouteNm`은 지금은 사실상 통과 함수지만, 향후 지선(성수/신정지선) SK 표기 대응을 위한 **단일 확장 지점**으로 미리 분리.
- 접미사 "역" 제거는 표준 관행이며 시연 구간 역명 중 충돌 없음.

**검증**
- `npx tsc --noEmit` 통과 / `npm run build` 성공
- 단독 트랜스파일 후 node 런타임 테스트: "성수/성수역/을지로3가/을지로 3가/을지로3가(2호선)/안국역/공백" 7케이스 모두 기대값 일치, `stationNameMatches` 양/음성 케이스 정상

## [§4] 프록시 골격 + SK/TMAP 칸 혼잡도(통계) + predict 폴백 — ✅ 완료 (2026-07-13)

프록시 서버 골격을 세우고 **칸 혼잡도**를 실연동했다. (경로검색은 좌표가 필요해 다음 단계로 분리 —
혼잡도는 역명만으로 조회 가능해 먼저 진행.) 키는 서버 환경변수로만 흐르고, 실패 시 추정치로 폴백한다.

**적용 기술 / 패턴**
- **프레임워크 무관 코어 + 얇은 어댑터** 구조 — `handleCongestion(query) → {status, body}` 순수 함수를
  ①Vercel 서버리스 함수(`api/congestion.ts`)와 ②Vite 개발 미들웨어(`vite.config.ts`)가 각각 얇게 감쌈.
  → 지금은 서버리스, 추후 상시 Node 서버(Express)로 올릴 때 **코어 재사용**(사용자 결정: 서버리스 우선→Node 상향).
- **키 은닉**: `SK_APP_KEY`는 서버 `process.env`에만. 프론트는 상대경로 `/api/congestion`만 호출 →
  빌드 산출물(dist)에 appKey·SK 직접 URL **0회**(grep 검증).
- Node 18+ 전역 `fetch`(서버리스/Vite dev 공통). `@types/node` 추가.
- **Vite 개발 미들웨어**: `configureServer`의 `server.middlewares.use`로 `/api/*` 가로채기. Vite가 `.env`를
  `process.env`에 안 넣으므로 `loadEnv(mode,'','')`로 `SK_APP_KEY`를 `process.env`에 주입.
- **구현체 팩토리 토글**: `src/services/index.ts`에서 `VITE_USE_SK`로 mock↔SK 스위치. UI(`RouteView`)는
  `routeProvider`/`congestionProvider`만 바라봄.
- **graceful degradation**: `skCongestionProvider`가 프록시 실패(키 없음/쿼터초과/오류)를 catch →
  `mockCongestionProvider`(추정치, `source:'estimate'` 배지)로 폴백. 화면이 비지 않음.

**변경/신규 파일**
| 파일 | 내용 |
|---|---|
| `server/core/skClient.ts` | SK 저수준 GET 호출, `SkError`(코드: no-key/http/quota/shape/network), `congestionCar` 재귀 추출 |
| `server/core/handlers.ts` | `handleCongestion` — 프레임워크 무관, 상태코드 매핑(no-key=503/quota=429/기타=502) |
| `api/congestion.ts` | Vercel 함수 래퍼 + `cache-control: s-maxage=600` |
| `vite.config.ts` | 개발 미들웨어 + `SK_APP_KEY` 주입 |
| `src/services/congestionSk.ts` | 프록시 호출 → `RouteCongestion` 정규화, 실패 시 mock 폴백 |
| `src/services/index.ts` | mock↔SK 팩토리(`VITE_USE_SK`) |
| `src/services/congestion.ts` | `optimalCarForAlight` export(공유) |
| `src/data/stationNaming.ts` | `toSkStationNm`(접미사 "역" 부착) 추가 |
| `src/views/RouteView.tsx` | 팩토리 provider 사용 |
| `.env.example` | `SK_APP_KEY`/`VITE_USE_SK`/`VITE_ODSAY_API_KEY` 문서화 |

**API 스펙 (실측 확정)**
- `GET https://apis.openapi.sk.com/transit/puzzle/subway/congestion/stat/car?routeNm=&stationNm=&dow=&hh=`, 헤더 `appKey`
- 응답 `congestionCar`: 10칸 혼잡도 % 배열(한 칸 160명=100%) → `CarCongestion[]`로 변환(`levelOf`로 레벨 부여)
- **⚠️ 역명은 접미사 "역" 필수**: `stationNm=성수` → **400 Bad Request**, `stationNm=성수역` → 정상(쿼터 게이트 통과). `routeNm`은 "2호선".
- 무료 쿼터 **2건/일**(칸 혼잡도). 소진 시 **429 QUOTA_EXCEEDED** → 프론트 추정치 폴백.

**결정 / 근거**
- **혼잡도 먼저, 경로 나중**: 경로검색 API는 좌표(startX/Y·endX/Y) 입력이라 내부 역 좌표 데이터가 선행 필요.
  혼잡도는 역명만으로 되고 앱의 핵심 차별점이라 먼저 연동(§7 순서와 다름, 사유 기록).
- **혼잡도 셰이핑은 프론트에서**: 프록시는 원시 `cars:number[]`만 반환하고, `optimalCar`(승강장 구조물 기반)
  등 도메인 셰이핑은 프론트 데이터(`featuresForStation`)를 쓰는 `congestionSk`에서 수행 → 서버로 subway 데이터
  중복 이전 회피(predict 폴백 서버 이전은 추후 재검토).
- 기본값 **mock(USE_SK 미설정)**: 무료 쿼터 2/일이 작아, 실데이터 확인 시에만 `VITE_USE_SK=1`.

**검증**
- `tsc -b` 통과 / `npm run build` 성공
- Vite dev + curl `/api/congestion` (프록시는 stationNm을 SK로 그대로 전달 → SK 형식 "성수역" 사용):
  - "성수"(역 없음) → SK 400 Bad Request
  - "성수역" → SK **429 QUOTA_EXCEEDED** = 키·인증 동작 확인(무료 2건/일 소진)
- **`congestionCar` 파싱 로직 fixture 실증(6/6 PASS)**: `fetch` 스텁으로 문서 스펙 응답을 주입해
  `fetchCarCongestion` 검증 — 최상위/`contents` 중첩/깊은 중첩에서 배열 추출 성공(`findCongestionCar` 재귀),
  배열 없음→`shape`, 429→`quota`, 400→`http` 코드 매핑 정상.
- 프론트 변환(`buildRouteCongestion`): 예시 `[20,23,21,20,19,19,17,15,16,11]` → 전 칸 `easy`, average 18, best 10번(11), worst 2번(23). (결정적·tsc 보장)
- dist grep: appKey 0회 / `apis.openapi.sk.com` 0회 (키 미노출 확인)

**남은 것(이 단계 범위 밖)**
- **라이브 200 응답**의 실제 wrapper 키 경로 확인은 **쿼터가 남아 있을 때** 최종 1회 확인(재귀 추출기라 wrapper가 어떤 형태든 대응하도록 이미 방어됨). 현재 429 지속(리셋 시점/타임존 미확인).
- 관찰: SK 게이트웨이가 파라미터 검증과 쿼터 체크 사이에서 **400↔429를 간헐적으로** 반환.
- `dow`(요일) 파라미터 전달(현재 `hh`만) — 필요 시 추가.
- (선택) 프록시 서버단에서도 "역" 접미사 보정할지 — 현재는 프론트 `toSkStationNm`가 담당.

## [§4] SK/TMAP 경로검색 — ✅ 완료 (2026-07-14)

경로검색 API는 좌표(startX/Y·endX/Y, WGS84) 입력이라, 전 역 확장을 위해 **역 좌표 디렉터리**를 먼저 구축했다.

**Step 1 — 전 역 레지스트리 확장 (✅ 2026-07-14)**
- **데이터 소스**: 공공데이터포털 「전국도시철도역사정보표준데이터」 CSV(사용자 다운로드, `public/전체_도시철도역사정보_*.csv`).
  UTF-8·좌표 WGS84(37.x/127.x, 변환 불필요)·따옴표 파서로 깨짐 0.
- **생성물**: `src/data/stationDirectory.json` — 수도권 795개 역-노선(고유 역명 702), 35노선.
  수도권 bbox(lat 36.6~38.35, lng 126.2~127.95)로 부산/대구/대전/광주 등 제외.
- **로더** `src/data/stationDirectory.ts`: 한글 노선명→lineId(`N호선`→`lineN`, 리치와 통일), 색상/라벨 파생, `directoryStations`/`directoryLines`.
- **병합** `src/data/subway.ts`: 리치(15역·2노선) 우선 + 디렉터리 폴백. `getStation`/`getLine`/`findStationByExactName`/`searchStations`를 전 역으로 확장. **`STATIONS`/`LINES`/`stationsByLine`/`buildAdjacency`는 리치 그대로** → ExploreView·mock 그래프·alighting 무회귀(블래스트 반경 최소화).
- 리치 15역에 좌표 추가. `Station.order`/`lat`/`lng` 옵셔널화. `tsconfig.app`에 `resolveJsonModule`.
- **검증**: esbuild 번들 런타임 테스트 13/13 PASS(성수→리치 s-seongsu·좌표, 강남→d-line2-강남·좌표·line2, 정규화 매칭, 검색, 환승역 리치우선, 9호선 라벨), `tsc -b`·`build` 통과.

**Step 2 — /api/route + routingSk (✅ 2026-07-14)**: 전 역 경로검색 실연동.
- **SK 응답 실측 구조**: `metaData.plan.itineraries[]` → `{totalTime(초), totalWalkTime(초), transferCount, legs[]}`.
  `leg`: `mode`(WALK/SUBWAY/BUS)·`sectionTime`·`route`("수도권2호선", 접두어 있음→`lineIdForKorean`가 흡수)·`routeColor`(# 없는 hex)·`start/end{name,lat,lon}`·`passStopList.stations[]{stationName,lat,lon,index}`.
- **서버**: `skClient.fetchTransitRoutes`(POST, 좌표 body) + `handlers.handleRoute`(passShape/steps 제거로 슬림) + `api/route.ts`(Vercel) + Vite 개발 미들웨어(`/api/route`).
- **프론트** `routingSk.ts`: 좌표→프록시 호출 → **지하철 전용(버스 없는) itinerary 우선** → `RoutePlan` 정규화.
  WALK leg는 다음 지하철 leg의 환승 도보로 접고(선행 접근 도보 제외), SK 역명→`resolveStationId`(같은 노선 우선, 없으면 임시 등록), 노선색은 `registerLineIfAbsent`.
- **subway.ts**: `resolveStationId`(미등록 역 임시 등록으로 경로 안 끊김)·`registerLineIfAbsent` 추가.
- **팩토리**: `VITE_USE_SK` 로 `routeProvider`=SK↔mock. SK 실패/좌표없음 시 mock 폴백.
- **검증**:
  - 실 SK 200 응답(성수→강남) 캡처 → 정규화 런타임 12/12 PASS(1 leg·line2·성수→강남·정차 12·구간 11·승차 22분·총 28분·도보 5분·환승 0, 성수 리치 유지).
  - 라이브 프록시(dev→SK) 200: 3 itineraries = 2호선 직통 / 2호선→7호선→신분당선 환승 / 버스경로 → 앞 둘(subway-only)만 채택·버스 제외 확인.
  - `tsc -b`·`build` 통과, dist에 appKey·SK URL 0회.

**남은 것**: 방향(up/down)은 리치 order 없으면 'up' 기본(표시용, 혼잡도엔 영향 없음). 랭킹은 SK 정렬 신뢰(§9-3, 가중치 재정렬 미적용).

## [실시간 도착정보] ArrivalBanner 실데이터화 — ✅ 완료 (2026-07-15)

서울 열린데이터광장 **지하철 실시간 도착정보**(`realtimeStationArrival`)를 §4와 **동일한 프록시 골격**으로
연동해 `ArrivalBanner`를 실데이터화했다. 새 벤더·새 키지만 코어→핸들러→(Vercel 래퍼+Vite 미들웨어)→
프론트 서비스+폴백 구조를 그대로 재사용. 실패·빈응답·막차 이후 등 **어떤 경우든 목업으로 폴백**(사용자 방침).

**적용 기술 / 패턴**
- 기존 프레임워크 무관 코어 패턴 재사용: `handleArrival(query)→{status,body}` 순수 함수를
  ①Vercel 함수(`api/arrival.ts`)와 ②Vite 개발 미들웨어가 얇게 감쌈.
- **키 은닉**: `SEOUL_OPENAPI_KEY`는 서버 `process.env`에만. 프론트는 상대경로 `/api/arrival`만 호출.
- **벤더 필터링은 프론트에서**: 서울 API는 한 역의 **모든 노선·양방향** 열차를 반환 → `seoulArrivalProvider`가
  `(노선 subwayId, 방향 updnLine)`으로 걸러 **가장 이른 열차** 선택. 서버 코어는 원시 목록만 정규화 반환.
- **스위치 없이 항상 라이브(사용자 결정 2026-07-15)**: 서울 열린데이터광장 쿼터가 넉넉해(≈1,000/일)
  SK(혼잡도 2/일)처럼 아낄 이유가 없다 → `VITE_USE_SK`와 **분리**, `arrivalProvider`는 항상 `seoulArrivalProvider`.
  키 미설정·쿼터초과(429)·빈응답·막차 이후엔 내부에서 mock 폴백하므로 전체 mock 모드(USE_SK off)에서도 도착만 실시간.
  (초기엔 VITE_USE_SK 재사용안을 검토했으나, 쿼터 큰 서울을 SK 절약 스위치에 묶는 게 부적절해 철회.)
- **graceful degradation**: 키 미설정/인증오류/빈응답/막차 이후 → `mockArrivalProvider`(결정론적 30~150초).
  배너의 목업 계산 로직을 컴포넌트에서 서비스로 이관.

**변경/신규 파일**
| 파일 | 내용 |
|---|---|
| `server/core/seoulClient.ts` (신규) | 서울 저수준 GET, `SeoulError`(no-key/auth/http/shape/network), INFO-200(열차없음)→빈배열, INFO-100/300→auth |
| `server/core/handlers.ts` | `handleArrival` 추가 — 빈배열도 200(프론트가 필터 후 목업 폴백), 상태매핑(no-key/auth=503/기타=502) |
| `api/arrival.ts` (신규) | Vercel 래퍼 + `cache-control: s-maxage=15`(초 단위 갱신) |
| `vite.config.ts` | 개발 미들웨어에 `/api/arrival` 분기 + `SEOUL_OPENAPI_KEY` 주입 |
| `src/services/arrival.ts` (신규) | `ArrivalProvider`/`ArrivalInfo` 계약 + `mockArrivalProvider`(배너 목업 로직 이관) |
| `src/services/arrivalSeoul.ts` (신규) | 프록시 호출 → 노선·방향 필터 → 최이른 열차 → `ArrivalInfo`, 실패 시 mock 폴백 |
| `src/services/index.ts` | `arrivalProvider = seoulArrivalProvider` (항상 라이브, `VITE_USE_SK`와 무관) |
| `src/data/stationNaming.ts` | `toSeoulStationNm`(접미사 "역" 없이), `lineToSeoulSubwayId`("2"→"1002"), `directionMatchesUpdn` 추가 |
| `src/components/Chrome.tsx` | `ArrivalBanner`를 `useEffect`+취소플래그로 provider 조회, "실시간" 배지·안내문구·"곧 도착"·조회중 상태 |
| `.env.example` | `SEOUL_OPENAPI_KEY` (이미 문서화되어 있었음) |

**API 스펙 (실측 확정, 2026-07-15)**
- `GET http://swopenapi.seoul.go.kr/api/subway/{KEY}/json/realtimeStationArrival/0/20/{역명}` (역명은 "역" 접미사 **없이**, http)
- 성공: `{ errorMessage:{code:"INFO-000"}, realtimeArrivalList:[…] }`. 열차없음: `code:"INFO-200"`. 인증오류: `INFO-100/300`.
- 항목 필드: `subwayId`("1002"=2호선/"1003"=3호선), `updnLine`("상행/하행" 또는 순환선 "내선/외선"),
  `trainLineNm`("성수행 - 뚝섬방면"), `bstatnNm`(종착), `barvlDt`(잔여 초, 0/미상 흔함), `arvlMsg2`("전역 도착"/"2분 30초 후"), `arvlCd`(도착코드).

**결정 / 근거**
- **방향 매칭 = `direction.label` ↔ `updnLine`**: `toward`("성수·왕십리 방면")는 여러 역명이라 부정확 → 내부
  label("내선순환"/"외선순환"/"상행"/"하행")이 서울 `updnLine`("내선"/"외선"/"상행"/"하행")으로 **시작**하면 일치.
  순환선(2호선) 내/외선까지 한 규칙으로 흡수(`directionMatchesUpdn`).
- **방향 필터는 완화 가능**: 방향 일치가 0건이면 노선 결과 전체로 폴백해 배너가 최소한 그 노선 열차는 보여줌.
- 캐시 `s-maxage=15`: 도착은 초 단위 변동이라 짧게(§6 캐싱 계층 "도착정보 초 단위").

**검증**
- `tsc -p tsconfig.app.json`·`tsconfig.node.json` 통과, 서버 파일 개별 tsc 통과.
- **라이브 프록시(dev→서울) 200 실측**:
  - `성수`: 2호선 외선(전역 출발 80초·건대입구)·내선(2분 30초·한양대) 등 4건, `subwayId:1002` 정상.
  - `을지로3가`: 2호선 외선 + **3호선 상행**(구파발/대화행) 혼재 → subwayId(1002/1003)로 노선 분리 확인.
- Vite 모듈 그래프 정상 로드(순환참조·import 오류 0): `Chrome.tsx`/`arrivalSeoul.ts` transform OK.

**남은 것 / 주의**
- ✅ **3호선 상/하행 라벨 방향 바로잡음(2026-07-15)**: 내부 `id`는 order 증감 토큰(up=order↑=오금 방면)이라
  `toward`는 맞았으나 `label`이 뒤집혀 있었다(오금 방면에 "상행"). 서울 3호선 상행=대화 방면(라이브 `trainLineNm`
  대화행/구파발행으로 확정)이라 **label만 맞바꿈**(up→"하행", down→"상행"). `toward`·`id`·congestion 로직 불변.
  라이브 검증: 을지로3가에서 up(하행)→오금행, down(상행)→대화행 선택 = toward와 종착지 일치 확인.
- 폴링/자동 갱신은 미적용(선택된 역·방향 변경 시에만 재조회). 실시간 카운트다운 tick·주기 폴링은 추후.
- 도착코드(`arvlCd`)로 "출발"(2) 열차 제외 등 정밀 선별은 미적용 — 현재 최이른 잔여초로 단순 선택.

## [§6] 이벤트 예측 (접근 A: 룰기반) — ✅ 완료 (2026-07-21)

계획서 원안(KOPIS 수집→혼잡도 실측 라벨링→XGBoost)은 **학습 라벨(혼잡도 실측 이력)이 없어 불가** →
사용자와 논의해 **접근 A(룰기반 delta, ML·Python 없음)** 로 확정. 이벤트 일정을 받아 **최근접 역**에 매핑하고
**그 시간대에 eventBoost(%p)** 를 얹는다. SK/서울 도착정보와 **동일한 프록시 패턴** 재사용.

**데이터 소스 (라이브 검증 완료, 2026-07-21)** — 상세는 메모리 `event-data-sources` / KOPIS는 불필요해짐:
- **공연·콘서트·축제·전시** → 서울시 문화행사 API `culturalEventInfo` (**기존 SEOUL_OPENAPI_KEY 재사용**, 공식). JSON, `LAT`/`LOT` 좌표 내장, `DATE` 위치필터로 날짜별 소량 조회. CODENAME→type(concert/festival) 매핑.
- **야구 KBO / 축구 K리그** → 네이버 스포츠 내부 JSON(`api-gw.sports.naver.com/schedule/games`, **비공식**, `Referer` 헤더). `fromDate`/`toDate`·`upperCategoryId`(kbaseball/kfootball)·`categoryId`(kbo/kleague). 응답에 구장 없어 **홈팀→홈구장(좌표) 정적 매핑**.

**적용 기술 / 패턴**
- 프레임워크 무관 코어: `handleEvents(query)` 가 두 소스를 **`Promise.allSettled`로 독립 조회** → 한쪽 실패해도 다른 쪽 반환. 빈 결과도 200(프론트가 목업 폴백).
- **역 매핑·delta는 프론트에서**(congestionSk 선례와 동일): 서버는 좌표·메타만 정규화(`EventRaw`), 프론트가 좌표→최근접 역(디렉터리 795역 haversine, **1.5km 거리컷**으로 지방 경기장 자동 제외) + 룰 delta 산출.
- **항상 라이브(스위치 없음)**: 이벤트는 매번 바뀌어 정적이면 낡음 → `eventProvider=liveEventProvider` 고정, 실패 시 mock 폴백.
- **predict 연동(시간대 윈도우)**: `predictCongestion(stationId, hour, eventBoostOverride?)` 에 선택적 3번째 인자 추가(기존 2인자 호출은 정적 동작 유지). ExploreView가 **선택 역 + 이벤트 시각 ±2h** 조건으로 boost를 계산해 주입 → "그 시간대에 붐빔"이 칸 혼잡도에 반영.

**룰 delta(%p)**: 야구 42 / 축구 38 / 공연·콘서트 30 / 축제 28 / 전시·교육·기타 12. (수용인원 데이터 없어 유형·분류 기반. 데이터 쌓이면 이 함수만 통계·ML로 승격.)

**변경/신규 파일**
| 파일 | 내용 |
|---|---|
| `server/core/eventTypes.ts`(신규) | `EventRaw` 공통 정규화 타입 |
| `server/core/seoulCultureClient.ts`(신규) | 문화행사 조회+정규화(SEOUL 키 재사용, DATE 필터) |
| `server/core/naverSportsClient.ts`(신규) | KBO/K리그 조회+정규화 + 홈팀→구장 좌표 정적 매핑 |
| `server/core/handlers.ts` | `handleEvents`(allSettled, KST 오늘 기본) |
| `api/events.ts`(신규) | Vercel 래퍼(`s-maxage=300`) |
| `vite.config.ts` | `/api/events` 분기(SEOUL 키는 도착정보 때 이미 주입) |
| `src/services/events.ts`(신규) | `EventProvider`/`mockEventProvider`(정적 EVENTS 폴백) |
| `src/services/eventsLive.ts`(신규) | 프록시→최근접 역(haversine·거리컷)+룰 delta+timeLabel(진행중 처리) |
| `src/services/index.ts` | `eventProvider=liveEventProvider`(항상 라이브) |
| `src/data/predict.ts` | `predictCongestion` 3번째 인자 `eventBoostOverride?` |
| `src/components/EventForecast.tsx` | 정적 EVENTS import 제거 → `events`/`loading` prop, 로딩·빈상태 |
| `src/views/ExploreView.tsx` | 이벤트 fetch(useEffect+취소플래그) + 시간대 윈도우 eventBoost 계산 → predict 주입, EventForecast에 전달 |

**검증**
- 서버 라이브: `/api/events?date=2026-07-01` = 문화 34 + KBO 5(잠실·고척 등), `2026-07-18` = 문화 24 + KBO 5 + K리그 1(인천). 올스타 브레이크(7/15)엔 스포츠 0(정상, calendar gameCount는 잘못된 카테고리를 야구로 폴백시킨 착시라 games 엔드포인트로 확정).
- 프론트 변환(오늘=2026-07-21 라이브): 13건 → 역매핑 10건(거리컷 3건 제외). **LG vs NC→종합운동장(2호선) 0.21km +42%p**, 키움→구일역, 문화행사는 안국·시청 등 최근접 역 매핑, delta 정렬 정상.
- `tsc`(app/node) 통과, `npm run build` 성공, **dist에 서버 URL·키 0건**(프론트 `/api/*` 상대경로만), 모듈 그래프 정상 로드.

**남은 것 / 주의**
- 네이버는 **비공식** 엔드포인트(사용자 A안: 비공식 감수) → 캐시(`s-maxage`) + mock 폴백으로 방어. 스펙 변경 시 클라이언트만 손보면 됨.
- ExploreView `jumpTo`는 리치 데모역만 이동 가능 → 종합운동장 등 비데모 역 이벤트는 목록엔 뜨나 점프는 no-op(데모 스코프 한계, 데이터·표시는 정상).
- 스포츠 대부분 경기장은 데모 2·3호선 밖(잠실 야구=2호선만 직결). eventBoost는 이벤트가 데모역 인근일 때만 칸 혼잡도에 반영됨.
- 향후: 폴링/일 배치 캐시, 여러 날짜 예보(현재 오늘만), 수용인원 데이터로 delta 정교화.

---

## 항목 템플릿 (복사용)

```markdown
## [§N] 단계 이름 — ✅ 완료 (YYYY-MM-DD)

**적용 기술 / 패턴**
- …

**변경 파일**
| 파일 | 변경 |
|---|---|
| … | … |

**구성 방법 / 핵심 코드**
- …

**결정 / 근거**
- …

**검증**
- …
```
