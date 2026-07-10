# CROWDCAST

**경로를 입력하면 칸별 혼잡도를 알려주는 지하철 3D 지도**

지하철 탑승 전, 출발역과 도착역만 정하면 앱이 경로를 찾고 그 경로 위 열차의 **칸별 혼잡도**와
**추천 탑승 칸**을 자동으로 보여주는 서비스의 프론트엔드 프로토타입입니다.
경로(입력) → 칸별 혼잡도(출력) 구조로, ODsay Subway Map SDK 노선도 위젯과 3D 열차/역 히트맵으로
시각화합니다.

## 주요 기능

두 개의 모드를 탭으로 전환합니다.

- **경로 찾기** — 출발역 → 도착역을 검색하거나 ODsay 노선도 위젯에서 역을 탭해 선택하면
  최소 시간·환승·도보를 종합한 경로를 계산하고, 각 탑승 구간의 진입역 기준 칸별 혼잡도를 보여줍니다.
  하차/환승 시 동선상 가장 유리한 칸도 함께 추천합니다.
- **역 조회** — 노선·역·방향·시간대를 직접 선택해 해당 역 칸별 혼잡도를 바로 확인하는 기존 방식입니다.
- **3D 열차 히트맵** — react-three-fiber로 10량 편성 열차 내부를 컷어웨이 형태로 렌더링, 칸별
  혼잡도를 색상(초록·노랑·빨강)으로 매핑
- **칸 내부 1인칭 3D 뷰** — 선택한 칸의 좌석/입석 배치와 여유 좌석 수를 1인칭 시점으로 확인
- **역 내부 3D 지도** — 안국·을지로3가·성수 3개 역은 실제 형상을 반영한 3D 모델(.glb)로 제공,
  그 외 역은 역삼역 구조를 예시로 대체 표시
- **이벤트 혼잡 예보** — 공연·경기 종료 시간대 혼잡 증가분(%p) 안내

## 기술 스택

- Vite + React 18 + TypeScript
- Tailwind CSS
- react-three-fiber + drei (Three.js) — 3D 렌더링
- ODsay Subway Map SDK — 노선도 위젯 · 역 검색/픽

## 개발 시작

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

프로젝트 루트에 `.env` 파일이 필요합니다 (ODsay 노선도 위젯용 키).

```bash
VITE_ODSAY_API_KEY=<발급받은 ODsay API 키>
```

## 구조

```
src/
├─ data/
│  ├─ types.ts          # 도메인 타입 (노선·역·경로·혼잡도·이벤트)
│  ├─ subway.ts          # 노선/역/승강장/환승/이벤트 데이터 + 조회 헬퍼
│  ├─ predict.ts         # 역 단위 칸별 혼잡도 추정 로직 (역 평균 × 칸별 가중치 + 이벤트 델타)
│  ├─ stationModels.ts   # 역 id → 3D 내부 모델(.glb) 매칭
│  └─ stationFloors.ts   # 역 내부 층별 구조 데이터
├─ services/
│  ├─ routing.ts         # 경로 탐색 어댑터 (RouteProvider) — 현재 mock(그래프 다익스트라)
│  ├─ congestion.ts      # 칸별 혼잡도 어댑터 (CongestionProvider) — 현재 predict.ts 기반 추정치
│  └─ alighting.ts       # 하차/환승 동선 최적 칸 계산
├─ views/
│  ├─ RouteView.tsx      # 경로 찾기 모드 (ODsay 노선도 + 경로 결과 + 칸별 혼잡도)
│  └─ ExploreView.tsx    # 역 조회 모드 (노선/역/방향/시간대 직접 선택)
├─ components/
│  ├─ Chrome.tsx             # 상단바 · 모드 탭 · 도착 배너 · 뷰 토글
│  ├─ Selectors.tsx          # 노선 · 역 · 방향 · 시간대 선택 (역 조회 모드)
│  ├─ Summary.tsx             # 평균 혼잡도 요약 · 추천 칸 · 범례
│  ├─ CarDetail.tsx           # 선택 칸 상세 (구조물 정보 포함)
│  ├─ Train3D.tsx             # 3D 열차 히트맵
│  ├─ CarInterior3D.tsx       # 칸 내부 1인칭 3D 뷰 (모달)
│  ├─ Station3D.tsx           # 역 내부 3D 구조도
│  ├─ EventForecast.tsx       # 이벤트 혼잡 예보 카드
│  ├─ icons.tsx                # SVG 아이콘
│  └─ route/
│     ├─ OdsaySubwayMap.tsx   # ODsay Subway Map SDK 위젯 래퍼
│     ├─ RouteControls.tsx    # 출발/도착 입력 · 경로 요약
│     ├─ StationSearch.tsx    # 역명 검색
│     └─ HourWheel.tsx        # 출발 시각 선택
└─ App.tsx                # 모드 라우팅 · 화면 조립
```

## 참고

현재 지원 구간은 2·3호선의 일부(안국·을지로3가·성수 인근)로 제한되어 있으며, 데이터는 아래와 같이
목업/실연동이 혼재되어 있습니다.

- **경로 탐색**: 목업 그래프 기반 다익스트라 계산 (`services/routing.ts`), 이후 ODsay 대중교통 API로 교체 예정
- **노선도 위젯**: ODsay Subway Map SDK로 실연동 완료 (역 검색/탭 선택)
- **칸별 혼잡도**: 실측 데이터 부재로 규칙 기반 **추정치**(`data/predict.ts`)만 제공, 이후 SK Open API
  (진입역 기준 실시간 칸별 혼잡도)로 교체 예정
- **역 내부 3D 모델**: 안국·을지로3가·성수 3개 역만 실제 형상 반영, 나머지는 역삼역 예시로 대체

자세한 기획/구현 현황은 [`docs/`](./docs) 폴더를 참고하세요.

— CROWDCAST · 프로토타입 데모
