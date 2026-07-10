import type { PredictionResult } from '../data/predict'
import { LEVEL_META, levelOf } from '../data/predict'
import { IconCheck, IconTrendUp, IconTrain } from './icons'

interface SummaryProps {
  prediction: PredictionResult
  stationName: string
  onPickBest: () => void
}

export function CongestionSummary({ prediction, stationName, onPickBest }: SummaryProps) {
  const { average, best, eventBoost } = prediction
  const avgLevel = levelOf(average)
  const meta = LEVEL_META[avgLevel]
  const bestCar = prediction.cars.find((c) => c.car === best)!
  const bestMeta = LEVEL_META[bestCar.level]

  return (
    <div className="mx-4 animate-fade-up rounded-2xl bg-gradient-to-br from-ink-850 to-ink-900 p-4 ring-1 ring-white/5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <IconTrain width={13} height={13} />
            {stationName} · 다음 열차 예측
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-white">
              {average}
              <span className="text-lg text-slate-500">%</span>
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-slate-400">평균 혼잡도 · {meta.desc}</div>
        </div>

        {eventBoost > 0 && (
          <div className="flex flex-col items-end gap-1 rounded-xl bg-crowd-full/10 px-3 py-2 ring-1 ring-crowd-full/25">
            <div className="flex items-center gap-1 text-crowd-busy">
              <IconTrendUp width={14} height={14} />
              <span className="text-sm font-bold">+{eventBoost}%p</span>
            </div>
            <span className="text-[10px] font-medium text-crowd-busy/80">이벤트 영향</span>
          </div>
        )}
      </div>

      {/* 추천 칸 CTA */}
      <button
        onClick={onPickBest}
        className="mt-3.5 flex w-full items-center gap-3 rounded-xl bg-ink-800/80 p-3 text-left ring-1 ring-white/5 transition-colors hover:bg-ink-700/80"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ backgroundColor: bestMeta.color }}
        >
          <IconCheck width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-white">
            추천 탑승 칸 · {best}호칸
          </div>
          <div className="truncate text-[11px] text-slate-400">
            현재 가장 여유로워요 — 예측 {bestCar.value}% · {bestMeta.label}
          </div>
        </div>
        <span
          className="rounded-lg px-2.5 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: bestMeta.color }}
        >
          {bestCar.value}%
        </span>
      </button>
    </div>
  )
}

export function Legend() {
  const order: Array<keyof typeof LEVEL_META> = ['easy', 'mild', 'warn', 'busy', 'full']
  return (
    <div className="flex items-center justify-center gap-1 px-4">
      {order.map((k) => {
        const m = LEVEL_META[k]
        return (
          <div key={k} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: m.color }}
            />
            <span className="text-[10px] font-medium text-slate-400">{m.short}</span>
          </div>
        )
      })}
    </div>
  )
}
