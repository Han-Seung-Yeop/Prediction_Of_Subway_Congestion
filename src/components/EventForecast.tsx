import type { CrowdEvent } from '../data/types'
import { getLine } from '../data/subway'
import {
  IconMusic,
  IconBaseball,
  IconSoccer,
  IconTheater,
  IconExhibit,
  IconTicket,
  IconSpark,
  IconTrendUp,
  IconChevron,
} from './icons'

/** 이벤트 유형·세부분류로 내용에 맞는 아이콘 선택 */
function eventIcon(ev: CrowdEvent) {
  const c = (ev.category ?? '').replace(/\s/g, '')
  if (ev.type === 'sports') return /축구|K리그/.test(c) ? IconSoccer : IconBaseball
  if (/전시|미술/.test(c)) return IconExhibit
  if (/뮤지컬|연극/.test(c)) return IconTheater
  if (/축제/.test(c)) return IconSpark
  if (/콘서트|클래식|국악|대중음악|음악|무용|오페라|독주|독창/.test(c) || ev.type === 'concert')
    return IconMusic
  return IconTicket // 교육/체험·영화·기타
}

function severity(delta: number) {
  if (delta >= 40) return { color: '#ef4444', label: '혼잡 급증' }
  if (delta >= 25) return { color: '#fb923c', label: '혼잡 증가' }
  return { color: '#facc15', label: '혼잡 주의' }
}

interface EventForecastProps {
  events: CrowdEvent[]
  loading?: boolean
  onJump?: (lineId: string, stationName: string) => void
}

export function EventForecast({ events, loading, onJump }: EventForecastProps) {
  return (
    <section className="px-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-white">
          <IconSpark width={16} height={16} className="text-brand-400" />
          이벤트 혼잡 예보
        </h2>
        <span className="text-[11px] text-slate-500">공연·축제·경기 반영</span>
      </div>

      {loading && events.length === 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-ink-850 p-3 text-[12px] text-slate-500 ring-1 ring-white/5">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          오늘의 이벤트 불러오는 중…
        </div>
      )}
      {!loading && events.length === 0 && (
        <div className="rounded-2xl bg-ink-850 p-3 text-center text-[12px] text-slate-500 ring-1 ring-white/5">
          역 인근 예정 이벤트가 없어요
        </div>
      )}

      <div className="flex flex-col gap-2">
        {events.map((ev, i) => {
          const Icon = eventIcon(ev)
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
