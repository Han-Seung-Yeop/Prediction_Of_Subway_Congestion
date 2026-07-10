import type { Line, Station, Direction, AppMode } from '../data/types'
import { IconTrain, IconCube, IconStation } from './icons'

export function ModeTabs({
  mode,
  onChange,
}: {
  mode: AppMode
  onChange: (m: AppMode) => void
}) {
  const items: Array<{ id: AppMode; label: string }> = [
    { id: 'route', label: '경로 찾기' },
    { id: 'explore', label: '역 조회' },
  ]
  return (
    <div className="flex gap-1 px-4 pb-2">
      {items.map(({ id, label }) => {
        const active = mode === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 rounded-xl py-2 text-[13px] font-bold transition-all ${
              active
                ? 'bg-ink-700 text-white shadow ring-1 ring-white/10'
                : 'bg-ink-850/60 text-slate-400 hover:bg-ink-800'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function TopBar() {
  return (
    <header className="flex items-center px-4 pt-3 pb-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/20">
          <IconTrain width={18} height={18} className="text-ink-950" />
        </span>
        <div className="leading-none">
          <div className="text-[15px] font-extrabold tracking-tight text-white">
            CROWD<span className="text-brand-400">CAST</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-slate-500">
            타기 전에 확인하는 칸별 혼잡도
          </div>
        </div>
      </div>
    </header>
  )
}

interface ArrivalBannerProps {
  line: Line
  station: Station
  direction: Direction
}

export function ArrivalBanner({ line, station, direction }: ArrivalBannerProps) {
  // 결정론적 도착 시간 목업
  const seconds = 30 + (station.name.charCodeAt(0) % 5) * 30
  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return (
    <div className="mx-4 flex items-center gap-3 rounded-xl bg-ink-900 px-3.5 py-2.5 ring-1 ring-white/5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-white"
        style={{ backgroundColor: line.color }}
      >
        {line.name}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-white">
          {direction.toward}
        </div>
        <div className="text-[11px] text-slate-500">{station.name} 승강장</div>
      </div>
      <div className="flex items-baseline gap-1 text-right">
        <span className="text-[11px] text-slate-500">약</span>
        <span className="text-lg font-extrabold tabular-nums text-brand-400">
          {m > 0 ? `${m}분 ` : ''}
          {s}초
        </span>
        <span className="text-[11px] text-slate-500">후</span>
      </div>
    </div>
  )
}

export type ViewMode = '3d' | 'station'

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (m: ViewMode) => void
}) {
  const items: Array<{ id: ViewMode; label: string; Icon: typeof IconCube }> = [
    { id: '3d', label: '3D 지도', Icon: IconCube },
    { id: 'station', label: '역 지도', Icon: IconStation },
  ]
  return (
    <div className="flex rounded-xl bg-ink-850 p-1 ring-1 ring-white/5">
      {items.map(({ id, label, Icon }) => {
        const active = mode === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all ${
              active ? 'bg-ink-700 text-white shadow' : 'text-slate-400'
            }`}
          >
            <Icon width={14} height={14} className={active ? 'text-brand-400' : ''} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
