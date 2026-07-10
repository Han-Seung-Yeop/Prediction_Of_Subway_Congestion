---
name: frontend-saas
description: You Get The Job 프런트엔드(React+Vite+TS+Tailwind+shadcn/ui) 작업 시 사용. 라우팅, 인증, 디자인 토큰, 업로드 위저드, 진행률 화면, 리포트 페이지 등 프로젝트 도메인 규칙. Figma 변환 직후의 컴포넌트 정리·접근성 개선·번들 사이즈 통제 등을 다룬다.
---

# Frontend SaaS Skill

## 언제 사용하는가
- `frontend/` 하위 코드를 수정·신규 추가할 때
- Figma Dev Mode MCP 산출물을 도메인 컨벤션에 맞춰 다듬을 때
- 업로드/리포트/마이페이지 등 도메인 화면을 추가·수정할 때

## 입력
- `task`: 무엇을 만들거나 고치는지 (예: "리포트 페이지 회사 탭 추가")
- `(optional) figma_url`, `(optional) issue_id`

## 산출물
- 새/수정된 `.tsx` 파일들
- 필요한 경우 `packages/design-tokens/tokens/*.json` 수정 후 토큰 빌드
- Storybook 스토리(있는 경우)
- 변경 사항 요약 (PR 본문용)

## 절대 규칙

1. **디자인 토큰 우선**: 색·폰트·간격은 `packages/design-tokens/tokens/*.json` 원본과 Tailwind config 의 토큰만 사용. 임의 hex 금지.
2. **i18n 준비**: 모든 사용자에게 보이는 한국어 문자열은 `@/i18n` 의 `ko` 객체로만 읽는다. JSX 한글 리터럴과 i18next 사용은 Phase 2 전까지 금지.
3. **접근성**: shadcn 컴포넌트의 ARIA 를 보존. 새 인터랙션은 키보드로도 작동.
4. **번들 가드**: 페이지 단위 chunk ≤ 200KB gz. 큰 라이브러리는 dynamic import.
5. **PII 노출 금지**: 폼 input 자동완성 끄기 (`autoComplete="off"`), 콘솔 로그에 사용자 식별 정보 절대 안 찍음.

## 표준 도메인 페이지 구조

```
frontend/src/
├── components/
│   ├── ui/               # shadcn 원자
│   ├── main/             # 메인 화면 도메인 컴포넌트
│   └── upload/           # 업로드 위저드 (S2 이후)
├── pages/
│   ├── Home.tsx
│   ├── Main.tsx
│   └── NotFound.tsx
├── lib/
│   ├── supabase.ts       # Supabase 클라이언트 (anon)
│   ├── env.ts            # zod 기반 환경 변수 검증
│   └── utils.ts
├── styles/
│   ├── globals.css
│   └── tokens.css
└── i18n/index.ts         # @ygtj/i18n re-export
```

## 처리 절차

1. **문맥 파악**: 작업 대상 페이지/컴포넌트의 라우트와 데이터 의존을 먼저 그린다.
2. **디자인 동기화**:
   - Figma URL 이 있으면 Figma Dev Mode MCP 로 디자인 컨텍스트 확인 → 기존 구조에 맞는 컴포넌트 위치 선택
   - Tailwind 클래스가 토큰과 충돌하면 토큰을 먼저 수정
3. **데이터 hook 작성**:
   - TanStack Query 로 `useEvaluation(id)` 같은 훅 분리
   - Supabase Realtime 채널 구독이 필요하면 `src/lib/realtime.ts` 를 새로 만들고 한 곳에 통합
4. **상태 분리**: 현재는 zod 스키마 우선, `frontend-remediation` PR-3 에서 react-hook-form 과 `@hookform/resolvers` 를 추가한 뒤 S2 폼 상태를 RHF 로 분리. 글로벌은 Zustand (작게)
5. **테스트**:
   - 단위: vitest (컴포넌트 props 분기)
   - E2E: Playwright (`frontend/e2e/`) — addyosmani `browser-testing-with-devtools` 스킬 호출
6. **검증 게이트**:
   - `pnpm -C frontend typecheck` PASS
   - `pnpm -C frontend lint` PASS
   - Lighthouse mobile ≥ 90
   - axe-core critical = 0

## 업로드 위저드 표준 흐름

```
Step 1. 소스 선택 (PDF / Figma URL)
Step 2. 메타 입력 (회사 1~3, 직군, 학습 동의)
Step 3. PII 사전 스캔 결과 확인 → "제출"
↓
백엔드: Supabase Storage 업로드 → evaluate 시작 (AWS S3 전환은 Phase 2)
프런트: /progress/[id] 로 이동, Realtime 진행률 구독
```

## 진행률 화면 규약
- 단계명은 8개: `received | classifying | embedding | searching | evaluating | scoring | drafting | sent`
- 각 단계에 추정 남은 시간(서버 EMA) 표시
- 실패 시 단계 빨강 + "다시 시도" / "고객문의"

## 리포트 페이지 규약
- 회사별 탭, 기본 0번 탭은 종합 점수 가장 높은 회사
- 5 루브릭 레이더 차트 (recharts)
- 강점/약점/제안 카드 — 강점 3, 약점 3, 제안 ≥3
- 유사 합격 벤치마크 인용은 짧게(≤120자) + 저작권 표기 줄

## 금지 사항
- localStorage 에 평가 페이로드 캐싱 금지 (PII)
- 인라인 SVG 200KB 초과 금지 (분리)
- shadow DOM·iframe 우회로 토큰 무시 금지

## 참조
- addyosmani: `frontend-ui-engineering`, `code-simplification`, `performance-optimization`
- 우리: Figma Dev Mode MCP, `frontend/docs/coding-convention.md`
