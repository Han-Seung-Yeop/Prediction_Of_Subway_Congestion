import type { CrowdEvent } from '../data/types'
import { EVENTS, getLine } from '../data/subway'
import { IconMusic, IconBall, IconSpark, IconTrendUp, IconChevron } from './icons'

function eventIcon(type: CrowdEvent['type']) {
  if (type === 'concert') return IconMusic
  if (type === 'sports') return IconBall
  return IconSpark
}

function severity(delta: number) {
  if (delta >= 40) return { color: '#ef4444', label: '혼잡 급증' }
  if (delta >= 25) return { color: '#fb923c', label: '혼잡 증가' }
  return { color: '#facc15', label: '혼잡 주의' }
}

interface EventForecastProps {
  onJump?: (lineId: string, stationName: string) => void
}

export function EventForecast({ onJump }: EventForecastProps) {
  return (
    <section className="px-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-white">
          <IconSpark width={16} height={16} className="text-brand-400" />
          이벤트 혼잡 예보
        </h2>
        <span className="text-[11px] text-slate-500">공연·경기 반영</span>
      </div>

      <div className="flex flex-col gap-2">
        {EVENTS.map((ev, i) => {
          const Icon = eventIcon(ev.type)
          const sev = severity(ev.delta)
          const line = getLine(ev.lineId)
          return (
            <button
              key={ev.id}
              onClick={() => onJump?.(ev.lineId, ev.stationName)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group flex animate-fade-up items-center gap-3 rounded-2xl bg-ink-850 p-3 text-left ring-1 ring-white/5 transition-colors hover:bg-ink-800"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `${sev.color}1f`, color: sev.color }}
              >
                <Icon width={22} height={22} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: line.color }}
                  >
                    {line.name}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-white">
                    {ev.title}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">
                  {ev.stationName}역 · {ev.timeLabel}
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span
                  className="flex items-center gap-0.5 text-sm font-extrabold tabular-nums"
                  style={{ color: sev.color }}
                >
                  <IconTrendUp width={13} height={13} />+{ev.delta}
                  <span className="text-[10px]">%p</span>
                </span>
                <span className="text-[10px] font-medium" style={{ color: sev.color }}>
                  {sev.label}
                </span>
              </div>

              <IconChevron
                width={16}
                height={16}
                className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5"
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}
