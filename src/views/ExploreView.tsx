import { lazy, Suspense, useMemo, useState } from 'react'
import {
  LINES,
  DIRECTIONS,
  getLine,
  getStation,
  stationsByLine,
  featuresForStation,
} from '../data/subway'
import { hasStationModel } from '../data/stationModels'
import { predictCongestion } from '../data/predict'
import { LineSelector, StationSelector, Controls } from '../components/Selectors'
import { ArrivalBanner, ViewToggle, type ViewMode } from '../components/Chrome'
import { CongestionSummary, Legend } from '../components/Summary'
import { CarDetail } from '../components/CarDetail'
import { EventForecast } from '../components/EventForecast'

// 3D 뷰는 three.js 번들이 커서 지연 로딩
const Train3D = lazy(() =>
  import('../components/Train3D').then((m) => ({ default: m.Train3D })),
)
const CarInterior3D = lazy(() =>
  import('../components/CarInterior3D').then((m) => ({ default: m.CarInterior3D })),
)
const Station3D = lazy(() =>
  import('../components/Station3D').then((m) => ({ default: m.Station3D })),
)

export function ExploreView() {
  const [lineId, setLineId] = useState('line2')
  const [stationId, setStationId] = useState('s-euljiro1')
  const [direction, setDirection] = useState('up')
  const [hour, setHour] = useState(18)
  const [selectedCar, setSelectedCar] = useState<number | null>(null)
  const [interiorCar, setInteriorCar] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('3d')

  function openInterior(car: number) {
    setSelectedCar(car)
    setInteriorCar(car)
  }

  const line = getLine(lineId)
  const stations = useMemo(() => stationsByLine(lineId), [lineId])
  const station = getStation(stationId) ?? stations[0]
  const directions = DIRECTIONS[lineId] ?? DIRECTIONS.line2
  const dir = directions.find((d) => d.id === direction) ?? directions[0]
  const features = featuresForStation(station.id)

  const prediction = useMemo(
    () => predictCongestion(station.id, hour),
    [station.id, hour],
  )

  function handleLine(id: string) {
    setLineId(id)
    const first = stationsByLine(id)[0]
    setStationId(first.id)
    setDirection((DIRECTIONS[id] ?? DIRECTIONS.line2)[0].id)
    setSelectedCar(null)
  }

  function handleStation(id: string) {
    setStationId(id)
    setSelectedCar(null)
  }

  function jumpTo(targetLine: string, stationName: string) {
    setLineId(targetLine)
    const target = stationsByLine(targetLine).find((s) => s.name === stationName)
    if (target) setStationId(target.id)
    setDirection((DIRECTIONS[targetLine] ?? DIRECTIONS.line2)[0].id)
    setSelectedCar(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div className="border-b border-white/5 pt-1">
        <LineSelector lines={LINES} selected={lineId} onSelect={handleLine} />
        <StationSelector
          stations={stations}
          selected={station.id}
          lineColor={line.color}
          onSelect={handleStation}
        />
      </div>

      <main className="flex flex-1 flex-col gap-4 pt-4 pb-8 safe-b">
        <Controls
          directions={directions}
          direction={direction}
          onDirection={setDirection}
          hour={hour}
          onHour={setHour}
        />

        <ArrivalBanner line={line} station={station} direction={dir} />

        <CongestionSummary
          prediction={prediction}
          stationName={station.name}
          onPickBest={() => openInterior(prediction.best)}
        />

        <section className="mx-4 overflow-hidden rounded-2xl bg-ink-900/80 ring-1 ring-white/5">
          <div className="flex items-center justify-between px-3 pt-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              {view === 'station'
                ? hasStationModel(station.id)
                  ? `역 내부 구조 (${station.name}역)`
                  : '역 내부 구조 (역삼역 예시)'
                : '열차 내부 혼잡 분포'}
            </div>
            <ViewToggle mode={view} onChange={setView} />
          </div>

          <div className="px-1 pt-1">
            {view === '3d' && (
              <Suspense fallback={<VizFallback label="3D 지도" />}>
                <Train3D
                  prediction={prediction}
                  selected={selectedCar}
                  onSelect={openInterior}
                />
              </Suspense>
            )}
            {view === 'station' && (
              <Suspense fallback={<VizFallback label="역 지도" tall />}>
                <Station3D stationId={station.id} />
              </Suspense>
            )}
          </div>

          {view !== 'station' && (
            <div className="border-t border-white/5 py-2.5">
              <Legend />
            </div>
          )}
        </section>

        <CarDetail
          prediction={prediction}
          features={features}
          selectedCar={selectedCar}
          onOpenInterior={openInterior}
        />

        {selectedCar == null && view !== 'station' && (
          <p className="mx-4 -mt-1 text-center text-[11px] text-slate-500">
            칸을 탭하면 내부를 3D로 들여다보고 상세 혼잡도를 볼 수 있어요
          </p>
        )}

        <div className="mt-1 h-px bg-white/5" />

        <EventForecast onJump={jumpTo} />

        <footer className="px-4 pt-2 text-center text-[10px] leading-relaxed text-slate-600">
          예측값은 역 단위 평균 혼잡도에 칸별 가중치 패턴과 이벤트 변수를 반영한
          추정치입니다. 실제와 다를 수 있어요.
          <br />
          <span className="text-slate-700">CROWDCAST · 프로토타입 데모</span>
        </footer>
      </main>

      {interiorCar != null && (
        <Suspense fallback={<ModalFallback />}>
          <CarInterior3D
            prediction={prediction}
            car={interiorCar}
            lineLabel={line.label}
            stationName={station.name}
            stationId={station.id}
            lineId={lineId}
            direction={direction === 'down' ? 'down' : 'up'}
            hour={hour}
            onSelectCar={openInterior}
            onClose={() => setInteriorCar(null)}
          />
        </Suspense>
      )}
    </>
  )
}

function VizFallback({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center ${tall ? 'h-[340px]' : 'h-[240px]'}`}
    >
      <span className="flex items-center gap-2 text-[12px] text-slate-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        {label} 불러오는 중…
      </span>
    </div>
  )
}

function ModalFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95">
      <span className="flex items-center gap-2 text-[13px] text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        칸 내부 불러오는 중…
      </span>
    </div>
  )
}
