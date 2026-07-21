# CROWDCAST

**경로를 입력하면 칸별 혼잡도를 알려주는 지하철 3D 지도**

지하철 탑승 전, 출발역과 도착역만 정하면 앱이 경로를 찾고 그 경로 위 열차의 **칸별 혼잡도**와
**추천 탑승 칸**을 자동으로 보여주는 서비스입니다. 경로(입력) → 칸별 혼잡도(출력) 구조로,
ODsay 노선도 위젯과 3D 열차/역 히트맵으로 시각화합니다.

프론트엔드(React + 3D)와, **API 키를 숨기는 경량 프록시 백엔드**(Vercel 서버리스 함수 / Vite 개발
미들웨어)로 이루어져 있으며, 경로·혼잡도·실시간 도착정보·이벤트를 **실 API로 연동**합니다. 모든 실연동은
키 미설정·호출 실패·무료 쿼터 초과 시 **추정치(mock)로 자동 폴백**해 화면이 비지 않습니다.

## 주요 기능

두 개의 모드를 탭으로 전환합니다.

- **경로 찾기** — 출발역 → 도착역을 검색하거나 ODsay 노선도 위젯에서 역을 탭해 선택하면
  최소 시간·환승·도보를 종합한 경로를 계산하고, 각 탑승 구간의 진입역 기준 칸별 혼잡도를 보여줍니다.
  하차/환승 시 동선상 가장 유리한 칸도 함께 추천합니다.
- **역 조회** — 노선·역·방향·시간대를 직접 선택해 해당 역 칸별 혼잡도를 바로 확인합니다.
- **3D 열차 히트맵** — react-three-fiber로 10량 편성 열차 내부를 컷어웨이 형태로 렌더링, 칸별
  혼잡도를 색상(초록·노랑·빨강)으로 매핑
- **칸 내부 1인칭 3D 뷰** — 선택한 칸의 좌석/입석 배치와 여유 좌석 수를 1인칭 시점으로 확인
- **역 내부 3D 지도** — 안국·을지로3가·성수 3개 역은 실제 형상을 반영한 3D 모델(.glb)로 제공,
  그 외 역은 역삼역 구조를 예시로 대체 표시
- **실시간 도착 배너** — 서울 열린데이터광장 실시간 도착정보로 "다음 열차 N분 후"를 노선·방향에 맞춰 표시
- **이벤트 혼잡 예보** — 오늘의 공연·축제·전시(서울시 문화행사)와 야구·축구 경기(KBO·K리그)를 받아
  가장 가까운 역에 매핑하고, 그 시간대의 예상 혼잡 증가분(%p)을 안내 · 해당 역 혼잡도에도 반영

## 연동 API

경로·혼잡도·도착·이벤트를 모두 **프록시 뒤에서** 호출합니다. 서버 전용 키는 클라이언트 번들에 노출되지 않으며
(프론트는 `/api/*` 상대경로만 호출), 각 소스는 실패 시 개별적으로 mock 폴백합니다.

| 기능 | 소스 | 성격 | 폴백 |
|---|---|---|---|
| 경로 탐색 | SK/TMAP 대중교통(경로검색) | 실 API (`VITE_USE_SK`) | 목업 그래프 다익스트라 |
| 칸별 혼잡도 | SK/TMAP 대중교통(진입역 칸 혼잡도, 통계) | 실 API (`VITE_USE_SK`, 무료 2건/일) | 규칙 기반 추정치(`predict.ts`) |
| 실시간 도착 | 서울 열린데이터광장(realtimeStationArrival) | 실 API (항상 라이브) | 결정론적 목업 |
| 이벤트(공연·축제·전시) | 서울시 문화행사 API(culturalEventInfo) | 실 API · 공식 (항상 라이브) | 정적 목업 |
| 이벤트(야구·축구) | 네이버 스포츠 스케줄 JSON(KBO·K리그) | 실 API · **비공식** | 정적 목업 |
| 노선도 위젯 | ODsay Subway Map SDK | 실 API (프론트 직접) | — |

> 네이버 스포츠는 문서화되지 않은 내부 JSON API라 언제든 바뀔 수 있어, 캐시 + mock 폴백으로 방어합니다.

## 기술 스택

- **프론트**: Vite + React 18 + TypeScript, Tailwind CSS, react-three-fiber + drei (Three.js)
- **백엔드(프록시)**: 프레임워크 무관 코어(`server/core`) + Vercel 서버리스 함수(`api/*`) + Vite 개발 미들웨어
  (동일 코어를 개발/프로덕션이 공유). Node 18+ 전역 `fetch`.
- **아키텍처**: UI는 어댑터 인터페이스(`RouteProvider`/`CongestionProvider`/`ArrivalProvider`/`EventProvider`)만
  바라보고, `services/index.ts` 팩토리가 mock ↔ 실연동 구현체를 갈아끼웁니다.

## 개발 시작

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

프로젝트 루트에 `.env` 파일이 필요합니다. `.env.example` 참고.

```bash
# 서버 전용 (클라이언트 번들에 노출 안 됨)
SK_APP_KEY=<SK Open API appKey>          # SK/TMAP 경로검색 + 칸 혼잡도 (공용)
SEOUL_OPENAPI_KEY=<서울 열린데이터광장 인증키>  # 실시간 도착정보 + 문화행사 (공용)

# 프론트 노출
VITE_ODSAY_API_KEY=<ODsay API 키>        # 노선도 위젯

# 실데이터 스위치
VITE_USE_SK=1   # SK(경로·혼잡도) 실연동. 비우면 mock. (도착·이벤트는 스위치와 무관하게 항상 라이브)
```

> SK/TMAP 무료 쿼터가 작아(칸 혼잡도 2건/일) 소진 시 자동으로 추정치로 폴백합니다. 서울 열린데이터광장·
> 네이버는 쿼터가 넉넉해 항상 라이브로 동작합니다.

## 구조

```
server/core/            # 프레임워크 무관 프록시 코어 (키는 여기서만 사용)
├─ handlers.ts          # handleRoute / handleCongestion / handleArrival / handleEvents
├─ skClient.ts          # SK/TMAP 경로검색 + 칸 혼잡도
├─ seoulClient.ts       # 서울 실시간 도착정보
├─ seoulCultureClient.ts# 서울시 문화행사(공연·축제·전시)
├─ naverSportsClient.ts # 네이버 스포츠(KBO·K리그) + 홈팀→구장 좌표 매핑
└─ eventTypes.ts        # 이벤트 정규화 타입
api/                    # Vercel 서버리스 함수 (코어를 얇게 래핑) — route/congestion/arrival/events

src/
├─ data/
│  ├─ types.ts             # 도메인 타입 (노선·역·경로·혼잡도·이벤트)
│  ├─ subway.ts             # 리치 데모 역/노선 + 디렉터리 병합 조회 헬퍼
│  ├─ stationDirectory.ts   # 수도권 전 역 좌표 디렉터리(공공데이터 기반)
│  ├─ stationNaming.ts      # 역/노선 이름·방향 정규화 (SK·서울 표기 매칭)
│  ├─ predict.ts            # 역 평균 × 칸별 가중치 + 이벤트 델타 추정
│  └─ stationModels.ts      # 역 id → 3D 내부 모델(.glb) 매칭
├─ services/               # 어댑터 (UI가 바라보는 인터페이스) — mock ↔ 실연동 팩토리
│  ├─ index.ts             # provider 팩토리 (VITE_USE_SK 등)
│  ├─ routing.ts / routingSk.ts        # 경로: mock / SK
│  ├─ congestion.ts / congestionSk.ts  # 혼잡도: 추정 / SK
│  ├─ arrival.ts / arrivalSeoul.ts     # 도착: mock / 서울
│  ├─ events.ts / eventsLive.ts        # 이벤트: mock / 라이브(최근접 역·룰 delta)
│  └─ alighting.ts         # 하차/환승 동선 최적 칸 계산
├─ views/
│  ├─ RouteView.tsx        # 경로 찾기 모드
│  └─ ExploreView.tsx      # 역 조회 모드 (도착 배너·이벤트 예보 포함)
├─ components/             # Chrome(상단바·도착배너) · 3D(Train/CarInterior/Station) · EventForecast 등
└─ App.tsx                # 모드 라우팅 · 화면 조립
```

## 지원 범위

- **경로·도착·이벤트**: 수도권 전 역 좌표 디렉터리(약 795역)를 커버합니다.
- **리치 데모(3D·방향·승강장 구조물)**: 2·3호선 일부(경복궁~동대입구 / 을지로입구~성수, 15역)에 한정.
  역 조회 모드의 역 선택·3D는 이 데모 구간을 대상으로 합니다.
- **역 내부 3D 모델**: 안국·을지로3가·성수 3개 역만 실제 형상 반영, 나머지는 역삼역 예시로 대체.

자세한 기획/백엔드 구현 현황은 [`docs/`](./docs) 폴더를 참고하세요.

— CROWDCAST
