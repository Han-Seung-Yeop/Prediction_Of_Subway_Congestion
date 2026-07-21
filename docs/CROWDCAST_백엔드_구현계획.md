# CROWDCAST 백엔드 구현 계획

> 작성일 2026-07-13 · 갱신 2026-07-21(§6 이벤트 예측 완료) · 상태: **핵심 파이프라인 완료 — §3·§5·§4(혼잡도·경로검색)·실시간 도착정보·§6 이벤트 예측(접근 A) 완료** · 대상 브랜치: `main`
>
> 이 문서는 향후 작업 세션에서 **이 파일만 읽고 바로 착수**할 수 있도록 쓴 실행 계획서다.
> 현재 프로젝트는 백엔드가 전혀 없는 순수 프론트엔드 프로토타입이며, 아래는
> 실 API·서버·예측 모델을 붙이기 위한 단계별 계획이다.
>
> **📌 확정된 방향(2026-07-13 조사 결과)**: 경로 탐색과 칸별 혼잡도를 **모두 SK/TMAP 대중교통 API
> 하나로 처리**한다. SK/TMAP은 지하철 경로검색(환승·소요시간)과 진입역 기준 칸별 혼잡도를 모두
> 제공하며 **같은 `appKey`** 를 쓴다. → 벤더·키 1개, 노선명/역명 규칙 일원화. ODsay는 경로 API로
> 쓰지 않고, 이미 붙어 있는 **노선도 위젯(역 선택 UI)만 선택적으로 유지**한다.
>
> **⚠️ 착수 전 필수**: 아래 "미결정 사항(Open Decisions)" 섹션의 항목은 임의로 정하지 말고
> 반드시 사용자에게 먼저 물어볼 것. (예: 프록시를 서버리스로 할지 상시 서버로 할지 등)
>
> **📝 기술 기록 규칙(2026-07-13 지시)**: §7의 단계를 **하나 완료할 때마다**, 실제 사용한 기술 스택·
> 구성 방법·의사결정을 [`CROWDCAST_백엔드_기술구현.md`](./CROWDCAST_백엔드_기술구현.md)에 차례로 정리한다.
> (이 계획서 = "무엇을 할지", 기술구현 기록 = "실제로 무엇을 어떻게 했는지".) 완료 항목은 이 계획서에도 체크한다.

---

## 0. 핵심 원칙 — 어댑터 뒤만 채운다

이 프로젝트의 UI는 **어댑터 인터페이스에만 의존**하도록 이미 설계돼 있다.
백엔드 작업은 "새 아키텍처 설계"가 아니라 **이미 뚫린 2개 인터페이스 뒤를 실제 구현으로 교체**하는 일이다.

| 인터페이스 | 파일 | 현재 구현 | 교체 대상 |
|---|---|---|---|
| `RouteProvider` | `src/services/routing.ts:8` | `mockRouteProvider` (그래프 Dijkstra) | **SK/TMAP 대중교통 경로검색 API** |
| `CongestionProvider` | `src/services/congestion.ts:28` | `mockCongestionProvider` (`predict.ts` 추정) | **SK/TMAP 진입역 기준 칸 혼잡도** + predict 폴백 |

UI(`src/views/RouteView.tsx`)는 이 인터페이스 타입만 바라보므로, **구현체를 갈아끼워도 화면 코드는 거의 안 바뀐다.**
단, 아래 §3(async 전환)은 UI에도 손이 필요하다.

---

## 1. 받아와야 하는 외부 API

**핵심: 경로 + 혼잡도를 SK/TMAP 대중교통 API 하나로 처리한다.** (`transit.tmapmobility.com`, SK Open API `appKey` 공용)

| API | 용도 | 현재 상태 | 연결 지점 |
|---|---|---|---|
| **SK/TMAP 대중교통 API — 경로검색** | 출발→도착 지하철 경로·소요시간·환승 | ❌ 미연동 | `RouteProvider.findRoutes` |
| **SK/TMAP 대중교통 API — 진입역 기준 칸 혼잡도** | 진입역 기준 열차 칸별 혼잡도(%) | ❌ 미연동 | `CongestionProvider.forBoarding`, `source:'sk-realtime'` 배지 |
| **실시간 도착정보**(서울 열린데이터광장 / 서울교통공사) | "다음 열차 N분 후" 배너 | ❌ 목업 | `ArrivalBanner` (`src/components/Chrome.tsx`) |
| **KOPIS 공연 API + 스포츠 일정/관중** | 이벤트 혼잡 증가분 학습 데이터 | ❌ 미연동(3건 하드코딩) | 이벤트 예측 파이프라인(§6) |

**기연동(유지):** ODsay Subway Map SDK — 노선도 위젯·역 선택 UI (`src/components/route/OdsaySubwayMap.tsx`, 프론트 직접).
경로 API로는 쓰지 않으며, 역 선택 UI로만 선택적 유지. (경로/혼잡도 벤더가 SK/TMAP로 통일되어도 이 위젯은 독립적으로 사용 가능.)

### 1.1 SK/TMAP 칸 혼잡도 API — 조사로 검증된 스펙 (2026-07-13)

기획서가 우려했던 "칸 단위 실시간 데이터 비공개" 리스크는 **해소됨**. SK/TMAP은 칸별 혼잡도를 실제 제공한다. 두 종류:

| | ① 진입역 기준 칸 혼잡도 (**통계**) | ② 진입역 기준 실시간 열차/칸 혼잡도 |
|---|---|---|
| 성격 | 통계(`statStartDate`~`statEndDate`) | 실시간(서울교통공사 실시간 열차위치 + SKT T-WiFi 결합) |
| 갱신 | 10분 단위 | 실시간 |
| 이 앱 적합성 | **1차 타깃** — 앱이 "타기 전 예측"이라 통계가 더 맞음 | 후순위(더 복잡, 추후 얹기) |

- **①(통계) 요청:** `routeNm`("2호선") + `stationNm`("성수") + 선택 `dow`(MON~SUN)·`hh`(05~23)
- **①(통계) 응답:** `congestionCar` — 칸별 혼잡도 % 배열(160명=100%) → 앱의 `CarCongestion[]`로 거의 1:1 변환
- **인증:** 요청 헤더 `appKey`(HTTPS 필수) — 경로검색 API와 동일 키
- **커버리지:** 1~9호선 + 신분당선 + 공항철도 + 2호선 지선 → **시연 구간 2·3호선 전부 포함**
- **운행:** 05:30~23:50

> **✅ 발급 확인(2026-07-13)**: 칸 혼잡도는 **별도 상품이 아니라 `TMAP 대중교통` 상품의 기능**이다.
> SK Open API 대시보드에서 `TMAP 대중교통 기능`은 한 상품 안에 **경로(대중교통/요약정보)** +
> **통계성 열차 혼잡도(진입역 기준 열차/칸 혼잡도, 칸별 하차 비율)** 를 모두 포함한다.
> → 앱 하나(`crowdcast`)에 **`TMAP 대중교통` 한 상품만 활용신청**하면 경로+혼잡도가 **appKey 1개**로 다 된다.
> ⚠️ 지오비전 퍼즐의 `지하철 혼잡도`는 **다른 상품(장소·유동인구 계열)** — 신청하지 말 것.
> **무료(Free) 쿼터**: 경로 10건/일, 칸 혼잡도 2건/일(1호출=한 역 10칸 전부). → 캐시+fixture+추정 폴백으로 운용,
> 라이브 필요 시 혼잡도만 프리미엄 상향(키·코드 불변, 단 "Free 해지 후 익월 동일앱 유료전환" 절차).

> 조사 출처: `transit.tmapmobility.com/docs/puzzle/car`, `openapi.sk.com`(지하철 혼잡도, svcSeq=54),
> `transit.tmapmobility.com/sample/routes`(경로검색), SKT 뉴스룸.

> API 요청/응답 필드명은 연동 시점에 각 문서 기준으로 확정한다. 어댑터는 그 세부와 무관하게
> UI를 고정하기 위한 **내부 정규화 형태**(`RoutePlan`/`RouteLeg`/`RouteCongestion`)를 유지한다.

---

## 2. 구현해야 할 백엔드 구성요소

기획서(`docs/route-feature-plan.md` §6.3)가 **"프론트에서 API 직접 호출 지양, 경량 프록시 필수"**라고
명시했다. 실제로 `src/views/RouteView.tsx:14`의 `VITE_ODSAY_API_KEY`는 **빌드 시 클라이언트 번들에
그대로 노출**된다(보안 결함). 따라서 백엔드의 1차 존재 이유는 **API 키 은닉 프록시**다.

```
[브라우저]  →  [프록시/백엔드]  →  [SK/TMAP (경로+혼잡도) / 도착정보 API]
              (appKey 는 서버 환경변수에만 보관, 캐싱·정규화 수행)
```

구성요소:

1. **API 프록시/게이트웨이** — SK/TMAP·도착정보 키를 서버에 보관하고 대신 호출. 응답 정규화·캐싱 포함.
2. **경로 서비스** — SK/TMAP 경로검색 응답 → 내부 `RoutePlan`/`RouteLeg`로 변환 + 종합 랭킹(`w_time`/`w_transfer`/`w_walk`).
3. **혼잡도 서비스** — SK/TMAP 칸 혼잡도(①통계) 조회 → 없으면 `predict.ts` 로직으로 폴백(`source` 배지). 폴백 로직은 서버로 이전 검토.
4. **역 식별자 정규화** — 내부 id ↔ SK/TMAP의 한글 노선명/역명 (§5). 벤더 단일화로 부담 대폭 감소.
5. **이벤트 예측 파이프라인** — KOPIS·스포츠 수집 → delta 라벨링 → XGBoost/LightGBM 학습 → 서빙 API (§6).
6. **캐싱 계층** — 도착정보 초 단위, 혼잡도(통계) 시간/일 단위, 경로 분 단위, 이벤트 일 단위 TTL.

---

## 3. [선행 작업] 어댑터 async 전환 — 백엔드 없이 지금 가능

현재 어댑터는 **동기 반환**이라 실 네트워크 호출과 맞지 않는다. 실 API를 붙이기 전에 먼저 처리해야 한다.

```ts
// 현재 (routing.ts:9)
findRoutes(fromId, toId, departAt): RoutePlan[]
// 목표 (route-feature-plan.md §6.2 초안과 일치)
findRoutes(fromId, toId, departAt): Promise<RoutePlan[]>
```

**작업 범위:** ✅ **완료(2026-07-13)**
- [x] `RouteProvider.findRoutes` → `Promise<RoutePlan[]>` 로 시그니처 변경 (`src/services/routing.ts`)
- [x] `CongestionProvider.forBoarding` → `Promise<RouteCongestion>` 로 변경 (`src/services/congestion.ts`)
- [x] `mock*` 구현체는 `async`로 감싸기만 하면 됨(로직 유지)
- [x] `src/views/RouteView.tsx` 수정:
  - `find()` 를 async 로, 로딩(`finding`)/에러(`routeError`) state 추가
  - `congestion` 계산을 `useMemo`(동기) → `useEffect` + state 로 전환 (취소 플래그로 최신 요청만 반영)
- [x] 로딩 스피너 / 에러 UI 추가:
  - `RouteInput` 버튼에 `finding` 스피너("경로 찾는 중…")
  - 혼잡도 조회 중 스피너 카드 + 조회 실패 시 에러 문구(`congestionError`)
  - 경로 조회 실패 시 에러 문구(`routeError`)

> 이 단계는 백엔드가 없어도 완결되며, 이후 모든 실 API 연동의 전제 조건이다. **가장 먼저 한다.**
> **→ 완료.** async 계약이 확정됐으므로 이후 실 구현체(§4)는 UI 변경 없이 갈아끼우기만 하면 된다.

---

## 4. 프록시/백엔드 뼈대

**미결정**: 서버리스 함수(Vercel/Cloudflare Functions) vs 상시 Node 서버(Express/Fastify) vs Vite dev 미들웨어.
→ 착수 전 사용자에게 질문할 것 (route-feature-plan.md §8 열린 이슈 #4).

정해진 뒤 공통 작업:
- [ ] 엔드포인트 설계 (예시)
  - `GET /api/route?from={code}&to={code}&departAt={iso}` → `RoutePlan[]`
  - `GET /api/congestion?station={code}&direction={up|down}&at={iso}` → `RouteCongestion`
  - `GET /api/arrival?station={code}&direction={up|down}` → 도착 예정
  - `GET /api/events?station={code}&date={iso}` → 이벤트 예측(§6)
- [ ] 서버 환경변수로 키 이전: `SK_APP_KEY`(경로+혼잡도 공용), `SEOUL_OPENAPI_KEY`(도착정보) (프론트 `VITE_` 접두사 제거)
- [ ] 프론트에 `src/services/routingSk.ts`, `congestionSk.ts` 추가 — 프록시 호출 구현체
- [ ] 구현체 스위칭: mock ↔ real 을 env 플래그로 토글 (`src/services/index.ts` 같은 팩토리)
- [ ] CORS·레이트리밋·에러 정규화

---

## 5. 역 식별자 정규화 (벤더 단일화로 대폭 경량화)

**중요:** SK/TMAP는 숫자 표준 역 코드가 아니라 **한글 노선명("2호선") + 한글 역명("성수")** 을 키로 쓴다.
경로검색과 칸 혼잡도가 **같은 벤더·같은 이름 규칙**이라, 기존에 우려한 "여러 코드 체계 매핑" 문제가 사라진다.
남는 일은 내부 id ↔ SK/TMAP 표기의 **이름 정규화**뿐이다.

| 출처 | 을지로3가 식별자 |
|---|---|
| 내부 목업 (`src/data/subway.ts`) | `s-euljiro3-l2` / `s-euljiro3-l3` (노선별 분리) — `name:"을지로3가"`, `label:"2호선/3호선"` 이미 보유 |
| SK/TMAP | `routeNm:"2호선"` + `stationNm:"을지로3가"` (한글) |

현재 `src/views/RouteView.tsx:53`은 ODsay 위젯 pick을 **역 이름 문자열 완전일치**(`findStationByExactName`)로
매칭 중 → 표기 흔들림("성수" vs "성수역")에 취약. SK 연동 시에도 동일한 정규화가 필요.

**작업:** ✅ **완료(2026-07-13)**
- [x] 내부 `Station.name`/`Line.label` ↔ SK 표기 정규화 규칙 정의 (접미사 "역" 제거, 괄호·공백 처리, "N호선" 통과)
- [x] 표기 정규화 유틸(`normalizeStationName`, `stationNameMatches`, `lineToRouteNm`) 추가 → `src/data/stationNaming.ts` + 시연 3역 검증(런타임 테스트 통과)
- [x] `findStationByExactName`을 정규화 비교로 보강 (완전일치 → 정규화 후 비교)
- [x] (선택) ODsay 위젯 pick도 이미 `findStationByExactName` 경유 → 동일 정규화 자동 적용

**미결정(보류)**: 정규화를 코드 유틸로만 둘지, 예외 케이스용 소형 매핑 테이블(정적 JSON)을 병행할지.
→ 현재는 **코드 유틸만** 채택. 시연 구간 확장 시점에 재검토(지선/신분당선 등은 `lineToRouteNm`에서 확장).

---

## 6. 이벤트 예측 파이프라인 (독립 · 최후순위)

기획안(`docs/CROWDCAST_기획안.md` §6)의 원래 핵심 차별점.

> **✅ 완료(2026-07-21) — 원안 ML 대신 접근 A(룰기반) 채택.** 원안(아래 ①~④, XGBoost)은 ③학습에 필요한
> **혼잡도 실측 이력(라벨)이 프로젝트에 없어 불가**. SK 칸혼잡도는 통계 스냅샷이라 시계열 대량수집 불가.
> → 사용자와 논의해 **룰기반 delta(ML·Python 없음)** 로 전환. 데이터가 쌓이면 delta 함수만 통계·ML로 승격 가능.

원안(참고, 미채택):
```
① 수집    KOPIS 공연 API + 스포츠 일정/관중 크롤링 → 이벤트 이력 데이터셋
② 라벨링  delta = (이벤트 당일 역 혼잡도) − (동일 요일 평균)
③ 학습    피처: 공연장 수용인원·이벤트 유형·요일·날씨 → XGBoost/LightGBM 회귀
④ 서빙    예정 이벤트의 혼잡 증가분(%p)을 /api/events 로 제공
```

**실제 구현(접근 A):** ✅
- [x] 소스 확정: **서울 문화행사 API**(공연/축제/전시, 기존 SEOUL 키·공식) + **네이버 스포츠 JSON**(KBO/K리그, 비공식 감수). KOPIS·크롤링·Python 불필요. (상세: 메모리 `event-data-sources`)
- [x] `server/core` 클라이언트 2종 + `handleEvents`(두 소스 allSettled 독립조회) + `api/events` + Vite 미들웨어
- [x] 프론트 `eventsLive`: 좌표→최근접 역(haversine, 1.5km 거리컷) + 룰 delta(야구42/축구38/공연30/축제28/전시12) + `EventForecast` 라이브화
- [x] `predictCongestion` 3번째 인자(eventBoostOverride) + ExploreView가 **이벤트 시각 ±2h** 윈도우로 boost 주입 → "그 시간대에 붐빔" 반영
- [x] 라이브 검증 + tsc/build + 키 누출 0

> 크롤링·별도 Python 서비스 없이 기존 프록시 패턴에 흡수됨(가장 무겁다던 예상과 달리 경량 완결).

---

## 7. 권장 실행 순서 (리스크 낮은 것부터)

1. ~~**[§3] 어댑터 async 전환 + 로딩/에러 UI**~~ — ✅ **완료(2026-07-13)**
2. ~~**[§5] 역 이름 정규화 유틸 확보**~~ — ✅ **완료(2026-07-13)**
3. ~~**[§4] SK/TMAP 칸 혼잡도(①통계) 연결 + 프록시 골격 + predict 폴백**~~ — ✅ **완료(2026-07-13)**. 혼잡도가 경로보다 먼저(경로는 좌표 필요, 혼잡도는 역명만이라 즉시 가능). 서버리스 골격(프레임워크 무관 코어)+Vite 개발 미들웨어+프론트 `congestionSk`+env 토글. **키 동작·"역"접미사 확인 완료**, 무료 쿼터 소진 시 추정치 폴백.
4. ~~**[§4] SK/TMAP 경로검색 API 연결**~~ — ✅ **완료(2026-07-14)**. Step1: 공공데이터 CSV→`stationDirectory.json`(수도권 795역) + 레지스트리 전 역 확장. Step2: `/api/route`+`routingSk`(좌표→SK→RoutePlan, 지하철 전용 우선, SK역명→id)+`routeProvider` 토글. 실 응답 검증 완료.
5. ~~**실시간 도착정보로 `ArrivalBanner` 실데이터화**~~ — ✅ **완료(2026-07-15)**. 서울 열린데이터광장 `realtimeStationArrival`을 §4와 동일 프록시 골격(`server/core/seoulClient`+`handleArrival`+`api/arrival`+Vite 미들웨어)으로 연동. 프론트 `arrivalSeoul`가 노선(subwayId)·방향(updnLine↔label)으로 필터해 최이른 열차 선택, 실패·빈응답·막차 이후엔 mock 폴백. **스위치 없이 항상 라이브**(서울 쿼터 ≈1,000/일로 넉넉 → SK 절약 스위치 `VITE_USE_SK`와 분리, 전체 mock 모드에서도 도착만 실시간). 라이브 200 실측(성수·을지로3가). 3호선 상/하행 label 뒤집힘도 바로잡음(up→"하행"/down→"상행", toward·id 불변, 라이브 검증 완료).
6. ~~**[§6] 이벤트 예측 파이프라인**~~ — ✅ **완료(2026-07-21, 접근 A 룰기반)**. 원안 ML은 학습 라벨(혼잡도 실측 이력) 부재로 불가 → 룰기반으로 전환. 소스: **서울 문화행사 API**(공연/축제/전시, 기존 SEOUL 키·공식) + **네이버 스포츠 JSON**(KBO/K리그, 비공식 감수). `server/core` 클라이언트 2종 + `handleEvents`(allSettled) + `api/events` + 프론트 `eventsLive`(좌표→최근접 역 haversine·1.5km 컷 + 룰 delta) + ExploreView 시간대 윈도우로 `predictCongestion` eventBoost 주입. 라이브 검증(잠실 야구→종합운동장 2호선 +42%p 등).

---

## 8. 변경 지점 요약 (파일 맵)

| 파일 | 변경 | 상태 |
|---|---|---|
| `src/services/routing.ts` | `findRoutes` → `Promise` 화 | ✅ |
| `src/services/routingSk.ts`(신규) | 프록시 호출 → `RoutePlan` 정규화(지하철 전용 우선) | ✅ |
| `src/data/stationDirectory.json/.ts`(신규) | 수도권 795역 좌표 디렉터리 + 로더 | ✅ |
| `server/core/skClient.ts` | `fetchTransitRoutes` 추가 | ✅ |
| `server/core/handlers.ts` | `handleRoute` 추가(슬림) | ✅ |
| `api/route.ts`(신규) | Vercel 경로 프록시 | ✅ |
| `src/services/congestion.ts` | `forBoarding` → `Promise` 화, `optimalCarForAlight` export | ✅ |
| `src/services/congestionSk.ts`(신규) | 프록시 호출 → `RouteCongestion` 정규화 + 폴백 | ✅ |
| `src/services/index.ts`(신규) | mock↔SK 팩토리(`VITE_USE_SK`, 경로+혼잡도) | ✅ |
| `src/data/stationNaming.ts`(신규) | `normalizeStationName`/`stationNameMatches`/`lineToRouteNm`/`toSkStationNm` | ✅ |
| `src/views/RouteView.tsx` | async 로딩/에러, 팩토리 provider 사용 | ✅ |
| `src/data/subway.ts` | `findStationByExactName` 정규화 비교 / (경로용) 좌표 추가 | 정규화 ✅ / 좌표 ⏳ |
| `server/core/skClient.ts`(신규) | SK 저수준 호출(칸 혼잡도), `appKey` 서버 보관 | ✅ |
| `server/core/handlers.ts`(신규) | 프레임워크 무관 핸들러(`handleCongestion`·`handleRoute`·`handleArrival`) | ✅ |
| `api/congestion.ts`(신규) | Vercel 서버리스 함수 래퍼 | ✅ |
| `server/core/seoulClient.ts`(신규) | 서울 실시간 도착정보 저수준 호출, `SeoulError` | ✅ |
| `api/arrival.ts`(신규) | Vercel 도착정보 래퍼(`s-maxage=15`) | ✅ |
| `src/services/arrival.ts`·`arrivalSeoul.ts`(신규) | `ArrivalProvider`+mock / 서울 필터·정규화·폴백 | ✅ |
| `src/components/Chrome.tsx` | `ArrivalBanner` provider 조회(실시간 배지) | ✅ |
| `vite.config.ts` | 개발 미들웨어(`/api/*`)로 동일 코어 서빙 + `SK_APP_KEY`·`SEOUL_OPENAPI_KEY` 로드 | ✅ |
| `server/core/eventTypes.ts`·`seoulCultureClient.ts`·`naverSportsClient.ts`(신규) | 이벤트 정규화 타입 + 문화행사/스포츠 클라이언트 | ✅ |
| `server/core/handlers.ts` | `handleEvents`(allSettled 2소스) 추가 | ✅ |
| `api/events.ts`(신규) | Vercel 이벤트 래퍼 | ✅ |
| `src/services/events.ts`·`eventsLive.ts`(신규) | `EventProvider`+mock / 최근접역·룰 delta 라이브 | ✅ |
| `src/components/EventForecast.tsx`·`src/views/ExploreView.tsx`·`src/data/predict.ts` | 라이브 이벤트 표시 + 시간대 eventBoost 주입 | ✅ |

---

## 9. 미결정 사항 (Open Decisions) — 착수 전 사용자에게 질문

route-feature-plan.md §8 열린 이슈 + 백엔드 추가분:

1. ~~**프록시 스택**~~ → **서버리스 우선 확정(2026-07-13)**. Vercel Functions(Node 런타임) 권장 — 프레임워크 무관 코어로 짜서 추후 상시 Node 서버(Express/Fastify)로 무리 없이 상향. (§4)
2. ~~**SK/TMAP 요금·신청**~~ → **해소(2026-07-13)**. 앱 `crowdcast` 생성 + `TMAP 대중교통`(Free) 활용신청 완료 = 경로+칸혼잡도 **appKey 1개**. 무료 쿼터 경로 10/일·칸혼잡도 2/일. 상세 §1.1 발급확인 노트.
3. **랭킹 가중치**: `w_time`/`w_transfer`/`w_walk` 기본값 + 사용자 조정 UI 노출 여부. (SK 경로검색 자체 정렬을 1차로 신뢰할지 여부 포함)
4. **혼잡도 실시간 vs 통계**: 1차는 ①통계로 확정. ②실시간을 언제/어떻게 얹을지 + 폴백 "추정" 배지 문구
5. ~~**이벤트 모델 데이터**~~ → **해소(2026-07-21)**. 혼잡도 실측 이력 부재로 ML 대신 **룰기반(접근 A)** 채택. 소스=서울 문화행사 API(공식·기존키) + 네이버 스포츠 JSON(비공식 감수). KOPIS는 문화행사 API가 상위호환이라 불필요. 상세: 메모리 `event-data-sources`.
6. **호스팅/배포**: 백엔드를 어디에 올릴지, 프론트와 같은 도메인 여부
7. **ODsay 노선도 위젯 존치**: 벤더가 SK/TMAP로 통일된 뒤에도 역 선택 UI로 계속 쓸지, 자체 UI로 교체할지

### 해소된 이슈 (조사로 확정, 재논의 불필요)
- ~~경로 벤더 선택~~ → **SK/TMAP 단일화 확정** (경로+혼잡도 한 벤더·한 키)
- ~~SK 칸별 데이터 실존 리스크~~ → **존재 확인**(§1.1), 통계 API를 1차 타깃으로
- ~~숫자 표준 역 코드 매핑~~ → **불필요**. SK가 한글 노선명/역명 사용 → 이름 정규화로 경량화(§5)

---

*본 계획은 미착수 상태다. §7 순서대로 진행하되, §9 항목은 임의 결정하지 말고 먼저 확인한다.*
