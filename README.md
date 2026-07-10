# CROWDCAST

**타기 전에 미리 확인하는 칸별 혼잡도 예측 + 3D 지하철 지도**

지하철 탑승 전, 어느 칸이 덜 붐빌지 미리·직관적으로 확인하는 서비스의 프론트엔드 프로토타입입니다.
역 단위 평균 혼잡도에 **칸별 가중치 패턴**과 **이벤트 변수(공연·경기)** 를 반영해 칸 단위 혼잡도를 추정하고,
**3D 열차 히트맵**으로 시각화합니다.

## 주요 기능

- **칸별 혼잡도 예측** — 노선·역·방향·시간대를 선택하면 10량 편성 각 칸의 예측 혼잡도를 표시
- **추천 탑승 칸** — 가장 여유로운 칸을 자동 추천
- **3D 지하철 지도** — react-three-fiber 로 열차 내부를 3D로 구현, 색상 히트맵(초록·노랑·빨강)으로 매핑
- **2D 칸 목록 뷰** — 칸별 막대 + 승강장 구조물(계단·환승·출구) 위치 표시
- **이벤트 혼잡 예보** — 공연·경기 종료 시간대 '평소 대비 혼잡 증가분(%p)' 안내

## 기술 스택

- Vite + React 18 + TypeScript
- Tailwind CSS
- react-three-fiber + drei (Three.js) — 3D 렌더링

## 개발 시작

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
src/
├─ data/
│  ├─ types.ts      # 도메인 타입 (노선·역·혼잡도·이벤트)
│  ├─ subway.ts     # 노선/역/승강장/이벤트 목업 데이터 + 조회 헬퍼
│  └─ predict.ts    # 칸별 혼잡도 추정 로직 (역 평균 × 칸별 가중치 + 이벤트 델타)
├─ components/
│  ├─ Chrome.tsx        # 상단바 · 도착 배너 · 3D/2D 뷰 토글
│  ├─ Selectors.tsx     # 노선 · 역 · 방향 · 시간대 선택
│  ├─ Summary.tsx       # 평균 혼잡도 요약 · 추천 칸 · 범례
│  ├─ CarStrip.tsx      # 2D 칸별 막대 뷰
│  ├─ CarDetail.tsx     # 선택 칸 상세 (구조물 정보 포함)
│  ├─ Train3D.tsx       # 3D 열차 히트맵 (react-three-fiber)
│  ├─ EventForecast.tsx # 이벤트 혼잡 예보 카드
│  └─ icons.tsx         # SVG 아이콘
└─ App.tsx           # 화면 조립 · 상태 관리
```

## 참고

예측값은 실측 칸 단위 데이터의 비공개 한계를 보완하기 위한 **추정치**입니다.
현재는 목업 데이터로 동작하며, 실제 서비스에서는 공공데이터포털 혼잡도 통계 + 실시간 도착정보 API,
KOPIS·스포츠 관중 데이터 기반 이벤트 예측 모델(XGBoost/LightGBM)과 연동됩니다.

— CROWDCAST · 프로토타입 데모
