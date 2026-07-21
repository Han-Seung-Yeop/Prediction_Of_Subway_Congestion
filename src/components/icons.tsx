import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconStairs = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20h4v-4h4v-4h4v-4h4" />
  </svg>
)

export const IconTransfer = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
)

export const IconExit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l4 4-4 4M14 12H4" />
  </svg>
)

export const IconElevator = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M12 3v18M9 9l-1.5 2h3zM15 15l1.5-2h-3z" />
  </svg>
)

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const IconMusic = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 18V5l10-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="16" cy="16" r="3" />
  </svg>
)

export const IconBall = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18M3 12a9 9 0 0 0 18 0" />
  </svg>
)

/** 야구 — 공 + 좌우 실밥(안쪽으로 휘는 seam) */
export const IconBaseball = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 4.8Q11.5 12 8 19.2" />
    <path d="M16 4.8Q12.5 12 16 19.2" />
  </svg>
)

/** 축구 — 공 + 중앙 오각형/스포크 */
export const IconSoccer = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.6l3 2.2-1.15 3.5h-3.7L9 9.8z" />
    <path d="M12 3.2v4.4M15 9.8l3.7-1.1M13.85 13.3l2.3 3.1M10.15 13.3l-2.3 3.1M9 9.8 5.3 8.7" />
  </svg>
)

/** 공연(뮤지컬·연극) — 무대 마스크 */
export const IconTheater = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 5h14v5a7 7 0 0 1-14 0z" />
    <path d="M9 8.5h.01M15 8.5h.01" />
    <path d="M9 12.4c1.5 1.3 4.5 1.3 6 0" />
  </svg>
)

/** 전시·미술 — 액자 그림 */
export const IconExhibit = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.4" />
    <path d="M21 15l-5-4.5L6 20" />
  </svg>
)

/** 기타 이벤트 — 티켓 */
export const IconTicket = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />
    <path d="M14 7.5v9" strokeDasharray="1.5 2" />
  </svg>
)

export const IconSpark = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
)

export const IconTrain = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="3" width="14" height="14" rx="3" />
    <path d="M5 11h14M9 3v8M15 3v8M8 21l-2 2M16 21l2 2" />
    <circle cx="9" cy="14" r="0.6" fill="currentColor" />
    <circle cx="15" cy="14" r="0.6" fill="currentColor" />
  </svg>
)

export const IconTrendUp = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </svg>
)

export const IconChevron = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const IconCube = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </svg>
)

export const IconStation = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="3" width="16" height="5" rx="1" />
    <rect x="4" y="10" width="16" height="5" rx="1" />
    <path d="M4 20h16M7 17v3M17 17v3" />
  </svg>
)

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const featureIcon = (type: string) => {
  switch (type) {
    case 'stairs':
      return IconStairs
    case 'transfer':
      return IconTransfer
    case 'exit':
      return IconExit
    case 'elevator':
      return IconElevator
    default:
      return IconExit
  }
}
