import { useEffect, useRef, useState } from 'react'

// 세로 휠(iOS 스타일) 시각 선택기 — 스크롤 스냅으로 가운데 값이 선택된다.
const ITEM_H = 36 // 각 행 높이(px)
const VISIBLE = 5 // 보이는 행 수(홀수). 가운데가 선택 위치
const PAD = ((VISIBLE - 1) / 2) * ITEM_H // 첫/끝 값도 가운데로 오도록 위·아래 여백

interface HourWheelProps {
  hour: number
  min?: number
  max?: number
  onChange: (h: number) => void
  onClose: () => void
}

export function HourWheel({ hour, min = 5, max = 23, onChange, onClose }: HourWheelProps) {
  const hours = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const settleRef = useRef<number | undefined>(undefined)
  const [active, setActive] = useState(hour)

  // 마운트 시 현재 시각으로 스크롤 위치 정렬
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = (hour - min) * ITEM_H
    // 열릴 때 한 번만 정렬 — 스크롤 중 hour 변경으로 위치가 튀지 않도록 의존성 비움
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function indexFromScroll() {
    const el = scrollRef.current
    if (!el) return hour - min
    const idx = Math.round(el.scrollTop / ITEM_H)
    return Math.max(0, Math.min(hours.length - 1, idx))
  }

  function handleScroll() {
    // 스크롤 중에는 가운데 값 하이라이트만 갱신(rAF 스로틀)
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined
        setActive(min + indexFromScroll())
      })
    }
    // 멈춘 뒤 확정 → 부모로 커밋
    window.clearTimeout(settleRef.current)
    settleRef.current = window.setTimeout(() => {
      onChange(min + indexFromScroll())
    }, 120)
  }

  function selectHour(h: number) {
    const el = scrollRef.current
    setActive(h)
    if (el) el.scrollTo({ top: (h - min) * ITEM_H, behavior: 'smooth' })
    onChange(h)
  }

  return (
    <>
      {/* 바깥 탭 → 닫기 */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />

      <div
        className="absolute right-0 top-full z-40 mt-1.5 w-28 overflow-hidden rounded-2xl bg-ink-900 p-1 shadow-2xl ring-1 ring-white/10"
        role="listbox"
        aria-label="출발 시각 선택"
      >
        <div className="relative">
          {/* 가운데 선택 밴드 */}
          <div
            className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-lg bg-brand-500/15 ring-1 ring-brand-500/40"
            style={{ height: ITEM_H }}
          />
          {/* 위·아래 페이드 */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-9 bg-gradient-to-b from-ink-900 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-ink-900 to-transparent" />

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="no-scrollbar snap-y snap-mandatory overflow-y-auto overscroll-contain"
            style={{ height: VISIBLE * ITEM_H, paddingTop: PAD, paddingBottom: PAD }}
          >
            {hours.map((h) => {
              const isActive = h === active
              return (
                <button
                  key={h}
                  onClick={() => selectHour(h)}
                  className={`flex w-full snap-center items-center justify-center tabular-nums transition-all ${
                    isActive
                      ? 'text-[16px] font-extrabold text-white'
                      : 'text-[14px] font-semibold text-slate-500'
                  }`}
                  style={{ height: ITEM_H }}
                >
                  {String(h).padStart(2, '0')}:00
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
