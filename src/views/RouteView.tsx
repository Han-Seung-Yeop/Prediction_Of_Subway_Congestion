import { lazy, Suspense, useEffect, useState } from 'react'
import type { RoutePlan } from '../data/types'
import { DIRECTIONS, getLine, getStation, featuresForStation, findStationByExactName } from '../data/subway'
import { hasStationModel } from '../data/stationModels'
import { routeProvider, congestionProvider } from '../services'
import { type RouteCongestion } from '../services/congestion'
import { LEVEL_META, levelOf } from '../data/predict'
import { ArrivalBanner, ViewToggle, type ViewMode } from '../components/Chrome'
import { CongestionSummary, Legend } from '../components/Summary'
import { CarDetail } from '../components/CarDetail'
import { OdsaySubwayMap, type PickedStation } from '../components/route/OdsaySubwayMap'
import { RouteInput, RouteSummary } from '../components/route/RouteControls'

const ODSAY_API_KEY = import.meta.env.VITE_ODSAY_API_KEY

const Train3D = lazy(() =>
  import('../components/Train3D').then((m) => ({ default: m.Train3D })),
)
const CarInterior3D = lazy(() =>
  import('../components/CarInterior3D').then((m) => ({ default: m.CarInterior3D })),
)
const Station3D = lazy(() =>
  import('../components/Station3D').then((m) => ({ default: m.Station3D })),
)

function currentHour(): number {
  return Math.min(23, Math.max(5, new Date().getHours()))
}

export function RouteView() {
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [useNow, setUseNow] = useState(true)
  const [hour, setHour] = useState(currentHour())
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [noRoute, setNoRoute] = useState(false)
  const [finding, setFinding] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [unsupportedStation, setUnsupportedStation] = useState<string | null>(null)
  const [selectedLeg, setSelectedLeg] = useState(0)
  const [view, setView] = useState<ViewMode>('3d')
  const [selectedCar, setSelectedCar] = useState<number | null>(null)
  const [interiorCar, setInteriorCar] = useState<number | null>(null)
  const [congestion, setCongestion] = useState<RouteCongestion | null>(null)
  const [congestionError, setCongestionError] = useState(false)

  const effectiveHour = useNow ? currentHour() : hour

  function openInterior(car: number) {
    setSelectedCar(car)
    setInteriorCar(car)
  }

  // ODsay 노선도 위젯에서 역을 골랐을 때 → 내부 목업 역과 이름으로 매칭
  //   시연 구간(안국·을지로3가·성수 인근) 밖의 역이면 안내만 하고 선택은 무시한다.
  function handleMapPick(picked: PickedStation, slot: 'from' | 'to') {
    const matched = findStationByExactName(picked.stationName)
    if (!matched) {
      setUnsupportedStation(picked.stationName)
      return
    }
    setUnsupportedStation(null)
    if (slot === 'from') setFromId(matched.id)
    else setToId(matched.id)
    setPlan(null)
    setNoRoute(false)
    setRouteError(false)
  }

  function swap() {
    setFromId(toId)
    setToId(fromId)
    setPlan(null)
    setNoRoute(false)
    setRouteError(false)
  }

  async function find() {
    if (!fromId || !toId) return
    setFinding(true)
    setRouteError(false)
    setNoRoute(false)
    try {
      const plans = await routeProvider.findRoutes(fromId, toId, new Date())
      if (plans.length === 0) {
        setPlan(null)
        setNoRoute(true)
        return
      }
      setPlan(plans[0])
      setSelectedLeg(0)
      setSelectedCar(null)
    } catch {
      setPlan(null)
      setRouteError(true)
    } finally {
      setFinding(false)
    }
  }

  const leg = plan?.legs[selectedLeg] ?? null
  const isFinalLeg = plan ? selectedLeg === plan.legs.length - 1 : false

  // 혼잡도 조회는 이제 async(실 API 대비) → 최신 요청만 반영하도록 취소 플래그 사용
  useEffect(() => {
    if (!leg) {
      setCongestion(null)
      setCongestionError(false)
      return
    }
    let cancelled = false
    setCongestionError(false)
    congestionProvider
      .forBoarding({
        boardStationId: leg.boardStationId,
        alightStationId: leg.alightStationId,
        direction: leg.direction,
        hour: effectiveHour,
        isFinalLeg,
      })
      .then((result) => {
        if (!cancelled) setCongestion(result)
      })
      .catch(() => {
        if (!cancelled) {
          setCongestion(null)
          setCongestionError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [leg, effectiveHour, isFinalLeg])

  const line = leg ? getLine(leg.lineId) : null
  const boardStation = leg ? getStation(leg.boardStationId)! : null
  const features = leg ? featuresForStation(leg.boardStationId) : []
  const dir = leg
    ? (DIRECTIONS[leg.lineId] ?? DIRECTIONS.line2).find((d) => d.id === leg.direction) ??
      (DIRECTIONS[leg.lineId] ?? DIRECTIONS.line2)[0]
    : null

  return (
    <main className="flex flex-1 flex-col gap-4 pt-4 pb-8 safe-b">
      <RouteInput
        fromId={fromId}
        toId={toId}
        onFrom={(id) => {
          setFromId(id)
          setPlan(null)
          setNoRoute(false)
        }}
        onTo={(id) => {
          setToId(id)
          setPlan(null)
          setNoRoute(false)
        }}
        onSwap={swap}
        useNow={useNow}
        hour={hour}
        onUseNow={setUseNow}
        onHour={(h) => {
          setHour(h)
          setUseNow(false)
        }}
        onFind={find}
        canFind={!!fromId && !!toId && fromId !== toId}
        finding={finding}
      />

      <OdsaySubwayMap
        apiKey={ODSAY_API_KEY}
        onPickStart={(s) => handleMapPick(s, 'from')}
        onPickEnd={(s) => handleMapPick(s, 'to')}
      />

      {unsupportedStation && (
        <p className="mx-4 rounded-xl bg-ink-900/80 px-3 py-2.5 text-center text-[12px] text-amber-400 ring-1 ring-white/5">
          <b>{unsupportedStation}</b>은(는) 아직 데모 지원 범위 밖의 역이에요. 안국·을지로3가·성수
          구간 인근 역으로 선택해 주세요.
        </p>
      )}

      {noRoute && (
        <p className="mx-4 rounded-xl bg-ink-900/80 px-3 py-2.5 text-center text-[12px] text-slate-400 ring-1 ring-white/5">
          두 역을 잇는 경로를 찾지 못했어요. 다른 역을 선택해 보세요.
        </p>
      )}

      {routeError && (
        <p className="mx-4 rounded-xl bg-ink-900/80 px-3 py-2.5 text-center text-[12px] text-rose-400 ring-1 ring-white/5">
          경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {!plan && !noRoute && !routeError && !finding && (
        <p className="mx-4 text-center text-[12px] text-slate-500">
          노선도에서 역을 탭하거나 검색해 <b className="text-slate-300">출발·도착</b>을
          정하고 <b className="text-brand-400">경로 찾기</b>를 눌러 보세요.
        </p>
      )}

      {plan && (
        <RouteSummary plan={plan} selectedLeg={selectedLeg} onSelectLeg={setSelectedLeg} />
      )}

      {plan && leg && !congestion && !congestionError && (
        <div className="mx-4 flex items-center justify-center gap-2 rounded-2xl bg-ink-900/80 py-8 text-[12px] text-slate-500 ring-1 ring-white/5">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          칸별 혼잡도 불러오는 중…
        </div>
      )}

      {plan && leg && congestionError && (
        <p className="mx-4 rounded-xl bg-ink-900/80 px-3 py-2.5 text-center text-[12px] text-rose-400 ring-1 ring-white/5">
          혼잡도를 불러오지 못했어요. 다른 구간을 선택하거나 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {plan && leg && congestion && line && boardStation && dir && (
        <>
          <div className="mx-4 flex items-center gap-2 text-[12px] text-slate-400">
            <span className="h-px flex-1 bg-white/5" />
            <span className="font-semibold text-slate-300">
              {boardStation.name} 승차 · 칸별 혼잡도
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                congestion.source === 'sk-realtime'
                  ? 'bg-brand-500/15 text-brand-300'
                  : 'bg-ink-800 text-slate-400'
              }`}
            >
              {congestion.source === 'sk-realtime' ? '실시간' : '추정치'}
            </span>
            <span className="h-px flex-1 bg-white/5" />
          </div>

          <ArrivalBanner line={line} station={boardStation} direction={dir} />

          <CongestionSummary
            prediction={congestion}
            stationName={boardStation.name}
            onPickBest={() => openInterior(congestion.best)}
          />

          {/* 추천 탑승·동선 최적 칸 */}
          <RecommendCard
            bestCar={congestion.best}
            optimalCar={congestion.optimalCar}
            optimalLabel={congestion.optimalLabel}
            bestValue={congestion.cars[congestion.best - 1]?.value ?? 0}
            optimalValue={
              congestion.optimalCar
                ? congestion.cars[congestion.optimalCar - 1]?.value ?? 0
                : 0
            }
            isFinalLeg={isFinalLeg}
            onPick={openInterior}
          />

          <section className="mx-4 overflow-hidden rounded-2xl bg-ink-900/80 ring-1 ring-white/5">
            <div className="flex items-center justify-between px-3 pt-3">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                {view === 'station'
                  ? boardStation && hasStationModel(boardStation.id)
                    ? `역 내부 구조 (${boardStation.name}역)`
                    : '역 내부 구조 (역삼역 예시)'
                  : '열차 내부 혼잡 분포'}
              </div>
              <ViewToggle mode={view} onChange={setView} />
            </div>

            <div className="px-1 pt-1">
              {view === '3d' && (
                <Suspense
                  fallback={
                    <div className="flex h-[240px] items-center justify-center">
                      <span className="flex items-center gap-2 text-[12px] text-slate-500">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        3D 지도 불러오는 중…
                      </span>
                    </div>
                  }
                >
                  <Train3D
                    prediction={congestion}
                    selected={selectedCar}
                    onSelect={openInterior}
                  />
                </Suspense>
              )}
              {view === 'station' && (
                <Suspense
                  fallback={
                    <div className="flex h-[340px] items-center justify-center">
                      <span className="flex items-center gap-2 text-[12px] text-slate-500">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        역 지도 불러오는 중…
                      </span>
                    </div>
                  }
                >
                  <Station3D stationId={boardStation.id} />
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
            prediction={congestion}
            features={features}
            selectedCar={selectedCar}
            onOpenInterior={openInterior}
          />

          <footer className="px-4 pt-2 text-center text-[10px] leading-relaxed text-slate-600">
            경로는 최소 시간·환승·도보를 종합해 추천한 목업 결과이며, 칸별 혼잡도는 진입역
            기준 추정치입니다. 실 연동 시 ODsay 경로 + SK 칸 혼잡도로 대체됩니다.
            <br />
            <span className="text-slate-700">CROWDCAST · 프로토타입 데모</span>
          </footer>
        </>
      )}

      {interiorCar != null && congestion && line && boardStation && leg && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95">
              <span className="flex items-center gap-2 text-[13px] text-slate-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                칸 내부 불러오는 중…
              </span>
            </div>
          }
        >
          <CarInterior3D
            prediction={congestion}
            car={interiorCar}
            lineLabel={line.label}
            stationName={boardStation.name}
            stationId={leg.boardStationId}
            lineId={leg.lineId}
            direction={leg.direction}
            hour={effectiveHour}
            onSelectCar={openInterior}
            onClose={() => setInteriorCar(null)}
          />
        </Suspense>
      )}
    </main>
  )
}

function RecommendCard({
  bestCar,
  optimalCar,
  optimalLabel,
  bestValue,
  optimalValue,
  isFinalLeg,
  onPick,
}: {
  bestCar: number
  optimalCar: number | null
  optimalLabel: string | null
  bestValue: number
  optimalValue: number
  isFinalLeg: boolean
  onPick: (car: number) => void
}) {
  const bestMeta = LEVEL_META[levelOf(bestValue)]
  const sameCar = optimalCar === bestCar
  return (
    <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-ink-900/80 p-3 ring-1 ring-white/5">
      <div className="flex gap-2">
        <button
          onClick={() => onPick(bestCar)}
          className="flex flex-1 flex-col items-start gap-0.5 rounded-xl bg-ink-850 px-3 py-2.5 text-left ring-1 ring-white/5"
        >
          <span className="text-[10px] font-semibold text-slate-500">가장 여유로운 칸</span>
          <span className="flex items-baseline gap-1">
            <b className="text-lg font-extrabold text-white">{bestCar}번</b>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: `${bestMeta.color}22`, color: bestMeta.color }}
            >
              {bestMeta.label}
            </span>
          </span>
        </button>

        {optimalCar && (
          <button
            onClick={() => onPick(optimalCar)}
            className="flex flex-1 flex-col items-start gap-0.5 rounded-xl bg-ink-850 px-3 py-2.5 text-left ring-1 ring-white/5"
          >
            <span className="text-[10px] font-semibold text-slate-500">
              {isFinalLeg ? '하차 동선 최적' : '환승 동선 최적'}
            </span>
            <span className="flex items-baseline gap-1">
              <b className="text-lg font-extrabold text-white">{optimalCar}번</b>
              <span className="text-[10px] text-slate-400">{optimalLabel}</span>
            </span>
          </button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        {!optimalCar ? (
          <>가장 여유로운 <b className="text-white">{bestCar}번 칸</b> 탑승을 추천해요.</>
        ) : sameCar ? (
          <>
            <b className="text-white">{bestCar}번 칸</b>이 여유롭고{' '}
            {isFinalLeg ? '출구' : '환승 통로'}에도 가장 가까워요. 여기 타면 돼요!
          </>
        ) : (
          <>
            여유로운 칸은 <b className="text-white">{bestCar}번</b>, {isFinalLeg ? '출구' : '환승'}에
            가까운 칸은 <b className="text-white">{optimalCar}번</b>
            {optimalValue > bestValue + 12 ? ' (조금 더 붐빔)' : ''}. 걷는 거리 vs 혼잡을
            골라 타세요.
          </>
        )}
      </p>
    </div>
  )
}
