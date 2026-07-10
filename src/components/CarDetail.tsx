import type { PredictionResult } from '../data/predict'
import { LEVEL_META } from '../data/predict'
import type { PlatformFeature } from '../data/types'
import { featureIcon, IconCube } from './icons'

interface CarDetailProps {
  prediction: PredictionResult
  features: PlatformFeature[]
  selectedCar: number | null
  onOpenInterior: (car: number) => void
}

export function CarDetail({ prediction, features, selectedCar, onOpenInterior }: CarDetailProps) {
  if (selectedCar == null) return null
  const car = prediction.cars.find((c) => c.car === selectedCar)
  if (!car) return null

  const meta = LEVEL_META[car.level]
  const carFeatures = features.filter((f) => f.car === selectedCar)
  const rank = [...prediction.cars]
    .sort((a, b) => a.value - b.value)
    .findIndex((c) => c.car === selectedCar) + 1

  return (
    <div
      key={selectedCar}
      className="mx-4 animate-slide-in rounded-2xl bg-ink-850 p-4 ring-1 ring-white/5"
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white"
          style={{ backgroundColor: meta.color }}
        >
          <span className="text-xl font-extrabold">{car.car}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">{selectedCar}호칸</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-slate-400">{meta.desc}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums text-white">
            {car.value}
            <span className="text-sm text-slate-500">%</span>
          </div>
          <div className="text-[10px] text-slate-500">여유도 {rank}위</div>
        </div>
      </div>

      {/* 혼잡도 게이지 */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${car.value}%`, backgroundColor: meta.color }}
        />
      </div>

      {/* 승강장 구조물 */}
      {carFeatures.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {carFeatures.map((f, i) => {
            const Icon = featureIcon(f.type)
            return (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 ring-1 ring-white/5"
              >
                <Icon width={13} height={13} className="text-brand-400" />
                {f.label}
              </span>
            )
          })}
          <span className="flex items-center rounded-lg bg-crowd-warn/10 px-2.5 py-1.5 text-[11px] font-medium text-crowd-warn">
            구조물 인접 · 혼잡 쏠림 주의
          </span>
        </div>
      )}

      {/* 내부 3D 보기 */}
      <button
        onClick={() => onOpenInterior(selectedCar)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500/15 py-2.5 text-[13px] font-bold text-brand-300 ring-1 ring-brand-500/30 transition-colors hover:bg-brand-500/25"
      >
        <IconCube width={16} height={16} />
        칸 내부 3D로 보기
      </button>
    </div>
  )
}
