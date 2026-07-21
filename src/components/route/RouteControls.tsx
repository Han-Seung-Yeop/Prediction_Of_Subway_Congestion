import { useState } from 'react'
import type { RoutePlan } from '../../data/types'
import { getStation, getLine } from '../../data/subway'
import { StationSearch } from './StationSearch'
import { HourWheel } from './HourWheel'
import { IconClock } from '../icons'

interface RouteInputProps {
  fromId: string | null
  toId: string | null
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onSwap: () => void
  useNow: boolean
  hour: number
  onUseNow: (v: boolean) => void
  onHour: (h: number) => void
  onFind: () => void
  canFind: boolean
  finding?: boolean
}

export function RouteInput({
  fromId,
  toId,
  onFrom,
  onTo,
  onSwap,
  useNow,
  hour,
  onUseNow,
  onHour,
  onFind,
  canFind,
  finding = false,
}: RouteInputProps) {
  const [wheelOpen, setWheelOpen] = useState(false)
  return (
    <div className="mx-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <StationSearch
            label="출발"
            accent="#22c55e"
            value={fromId}
            onSelect={onFrom}
            placeholder="출발역 검색"
          />
          <StationSearch
            label="도착"
            accent="#ef4444"
            value={toId}
            onSelect={onTo}
            placeholder="도착역 검색"
          />
        </div>
        <button
          onClick={onSwap}
          aria-label="출발·도착 교환"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-slate-300 ring-1 ring-white/5 hover:bg-ink-700"
        >
          ⇅
        </button>
      </div>

      {/* 출발 시각 */}
      <div className="flex items-center gap-2 rounded-xl bg-ink-850 px-3 py-1.5 ring-1 ring-white/5">
        <IconClock width={14} height={14} className="text-brand-400" />
        <span className="text-[12px] font-semibold text-slate-300">출발</span>
        <div className="ml-1 flex rounded-lg bg-ink-800 p-0.5">
          <button
            onClick={() => {
              onUseNow(true)
              setWheelOpen(false)
            }}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              useNow ? 'bg-ink-700 text-white shadow' : 'text-slate-400'
            }`}
          >
            지금
          </button>
          <button
            onClick={() => {
              onUseNow(false)
              setWheelOpen(true)
            }}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              !useNow ? 'bg-ink-700 text-white shadow' : 'text-slate-400'
            }`}
          >
            시간지정
          </button>
        </div>
        {!useNow && (
          <div className="relative ml-auto">
            <button
              onClick={() => setWheelOpen((o) => !o)}
              aria-label="출발 시각 선택"
              aria-expanded={wheelOpen}
              className="flex items-center gap-1 rounded-lg bg-ink-700 px-2 py-1 text-[13px] font-bold tabular-nums text-white ring-1 ring-white/10"
            >
              {String(hour).padStart(2, '0')}:00
              <span
                className={`text-[9px] text-slate-400 transition-transform ${
                  wheelOpen ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>
            {wheelOpen && (
              <HourWheel hour={hour} onChange={onHour} onClose={() => setWheelOpen(false)} />
            )}
          </div>
        )}
      </div>

      <button
        onClick={onFind}
        disabled={!canFind || finding}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 py-2.5 text-[14px] font-extrabold text-ink-950 shadow-lg shadow-brand-500/20 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {finding && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
        )}
        {finding ? '경로 찾는 중…' : '경로 찾기'}
      </button>
    </div>
  )
}

interface RouteSummaryProps {
  plan: RoutePlan
  selectedLeg: number
  onSelectLeg: (i: number) => void
}

export function RouteSummary({ plan, selectedLeg, onSelectLeg }: RouteSummaryProps) {
  return (
    <div className="mx-4 flex flex-col gap-2.5 rounded-2xl bg-ink-900/80 p-3 ring-1 ring-white/5">
      <div className="flex items-baseline gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] text-slate-500">총</span>
          <span className="text-2xl font-extrabold tabular-nums text-white">
            {plan.totalMinutes}
          </span>
          <span className="text-[12px] font-semibold text-slate-400">분</span>
        </div>
        <span className="text-[12px] text-slate-500">
          환승 <b className="text-slate-300">{plan.transferCount}</b>회 · 도보{' '}
          <b className="text-slate-300">{plan.walkMinutes}</b>분
        </span>
      </div>

      {/* 구간(leg) 선택 */}
      <div className="flex flex-col gap-1.5">
        {plan.legs.map((leg, i) => {
          const line = getLine(leg.lineId)
          const board = getStation(leg.boardStationId)!
          const alight = getStation(leg.alightStationId)!
          const active = i === selectedLeg
          return (
            <button
              key={i}
              onClick={() => onSelectLeg(i)}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 transition-colors ${
                active
                  ? 'bg-ink-800 ring-white/15'
                  : 'bg-ink-900/40 ring-white/5 hover:bg-ink-800/60'
              }`}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                style={{ backgroundColor: line.color }}
              >
                {line.name}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">
                  {board.name} → {alight.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {leg.numStations}개 역 · {leg.rideMinutes}분
                  {leg.transferWalkMinutes > 0 && ` · 환승 도보 ${leg.transferWalkMinutes}분`}
                </div>
              </div>
              {active && (
                <span className="shrink-0 text-[10px] font-bold text-brand-400">혼잡도 ▾</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
