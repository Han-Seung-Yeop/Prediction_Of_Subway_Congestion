import type { Line, Station, Direction } from '../data/types'
import { IconClock } from './icons'

interface LineSelectorProps {
  lines: Line[]
  selected: string
  onSelect: (id: string) => void
}

export function LineSelector({ lines, selected, onSelect }: LineSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-1">
      {lines.map((line) => {
        const active = line.id === selected
        return (
          <button
            key={line.id}
            onClick={() => onSelect(line.id)}
            className={`flex items-center gap-2 shrink-0 rounded-full pl-1.5 pr-3.5 py-1.5 text-sm font-semibold transition-all ${
              active
                ? 'bg-ink-700 ring-1 ring-white/15 shadow-lg'
                : 'bg-ink-850/60 text-slate-400 hover:bg-ink-800'
            }`}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: line.color }}
            >
              {line.name}
            </span>
            <span className={active ? 'text-white' : ''}>{line.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface StationSelectorProps {
  stations: Station[]
  selected: string
  lineColor: string
  onSelect: (id: string) => void
}

export function StationSelector({
  stations,
  selected,
  lineColor,
  onSelect,
}: StationSelectorProps) {
  return (
    <div className="relative">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2">
        {stations.map((st) => {
          const active = st.id === selected
          return (
            <button
              key={st.id}
              onClick={() => onSelect(st.id)}
              className="group flex shrink-0 flex-col items-center gap-1.5 px-1"
            >
              <span
                className={`text-[13px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              >
                {st.name}
              </span>
              <span
                className="h-2.5 w-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: active ? lineColor : '#2b3548',
                  boxShadow: active ? `0 0 0 4px ${lineColor}33` : 'none',
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            </button>
          )
        })}
      </div>
      {/* 노선 라인 */}
      <div
        className="pointer-events-none absolute left-4 right-4 bottom-[13px] h-[3px] rounded-full opacity-40"
        style={{ backgroundColor: lineColor }}
      />
    </div>
  )
}

interface ControlsProps {
  directions: Direction[]
  direction: string
  onDirection: (id: string) => void
  hour: number
  onHour: (h: number) => void
}

export function Controls({
  directions,
  direction,
  onDirection,
  hour,
  onHour,
}: ControlsProps) {
  const hh = String(hour).padStart(2, '0')
  return (
    <div className="flex items-stretch gap-2 px-4">
      {/* 방향 토글 */}
      <div className="flex flex-1 rounded-xl bg-ink-850 p-1 ring-1 ring-white/5">
        {directions.map((d) => {
          const active = d.id === direction
          return (
            <button
              key={d.id}
              onClick={() => onDirection(d.id)}
              className={`flex-1 rounded-lg px-2 py-2 text-center transition-all ${
                active ? 'bg-ink-700 shadow' : ''
              }`}
            >
              <div
                className={`text-[13px] font-semibold ${
                  active ? 'text-white' : 'text-slate-400'
                }`}
              >
                {d.label}
              </div>
              <div className="text-[10px] text-slate-500">{d.toward}</div>
            </button>
          )
        })}
      </div>

      {/* 시간대 슬라이더 */}
      <div className="flex w-[128px] flex-col justify-center rounded-xl bg-ink-850 px-3 py-1.5 ring-1 ring-white/5">
        <div className="flex items-center gap-1.5 text-brand-400">
          <IconClock width={14} height={14} />
          <span className="text-[13px] font-bold tabular-nums text-white">
            {hh}:00
          </span>
          <span className="ml-auto text-[10px] text-slate-500">예측</span>
        </div>
        <input
          type="range"
          min={5}
          max={23}
          value={hour}
          onChange={(e) => onHour(Number(e.target.value))}
          className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-brand-500"
        />
      </div>
    </div>
  )
}
