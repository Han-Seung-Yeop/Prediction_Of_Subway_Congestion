import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { PredictionResult } from '../data/predict'
import { LEVEL_META, levelOf } from '../data/predict'
import { PERSON_GEO, mulberry32, linspace, shade, clamp, ORBIT_TUNING } from '../lib/three'
import type { CrowdLevel } from '../data/types'
import { mockAlightingProvider, type AlightStop } from '../services/alighting'

// ─── 실내 치수 (통로는 +Z 방향) ───
const HALF_W = 1.35
const LEN = 13
const H = 2.3
const SEAT_Y = 0.46
const SEATS_PER_CAR = 54

// 좌석 구간(z 범위) — 문 사이 롱시트
const SEAT_SEGMENTS: [number, number][] = [
  [1.0, 3.1],
  [4.5, 6.6],
  [8.0, 11.4],
]
// 문 위치(z)
const DOORS = [3.8, 7.3, 11.9]

// 하차 인원 하이라이트 색 (밝은 시안)
const ALIGHT_COLOR = '#38bdf8'

interface Slot {
  x: number
  z: number
  seated: boolean
}

function buildPeople(value: number, seed: number): Slot[] {
  const rand = mulberry32(seed)
  const seated: Slot[] = []
  for (const side of [-1, 1]) {
    for (const [z0, z1] of SEAT_SEGMENTS) {
      for (let z = z0; z <= z1; z += 0.62) {
        seated.push({ x: side * (HALF_W - 0.36), z, seated: true })
      }
    }
  }
  const standing: Slot[] = []
  for (const xc of [-0.55, 0.0, 0.55]) {
    for (let z = 2.4; z <= LEN - 1.2; z += 0.72) {
      standing.push({ x: xc + (rand() - 0.5) * 0.22, z: z + (rand() - 0.5) * 0.22, seated: false })
    }
  }
  for (let i = standing.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[standing[i], standing[j]] = [standing[j], standing[i]]
  }
  const seatedN = Math.round(seated.length * clamp(value / 62))
  const standN = Math.round(standing.length * clamp((value - 28) / 72))
  return [...seated.slice(0, seatedN), ...standing.slice(0, standN)]
}

/** 슬롯 배열을 InstancedMesh 행렬로 배치 */
function applyMatrices(mesh: THREE.InstancedMesh | null, slots: Slot[], seed: number) {
  if (!mesh) return
  const rand = mulberry32(seed + 7)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  slots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 1.0)
    if (s.seated) {
      pos.set(s.x, SEAT_Y, s.z)
      scl.set(1.95, 2.0, 1.95)
    } else {
      pos.set(s.x, 0, s.z)
      const h = 2.85 + rand() * 0.35
      scl.set(1.95, h, 1.95)
    }
    m.compose(pos, q, scl)
    mesh.setMatrixAt(i, m)
  })
  mesh.count = slots.length
  mesh.instanceMatrix.needsUpdate = true
}

/**
 * 승객을 "잔류(color)"와 "하차 예정(highlight)" 두 그룹으로 나눠 그린다.
 *   - 하차 대상은 문에서 가까운 승객부터 선택 (내리기 쉬운 위치)
 *   - 하차 그룹은 발광 세기를 펄스시켜 시선을 끈다
 */
function Passengers({
  value,
  seed,
  color,
  alightRatio,
}: {
  value: number
  seed: number
  color: string
  alightRatio: number
}) {
  const stayRef = useRef<THREE.InstancedMesh>(null)
  const goRef = useRef<THREE.InstancedMesh>(null)
  const goMat = useRef<THREE.MeshStandardMaterial>(null)

  const slots = useMemo(() => buildPeople(value, seed), [value, seed])

  const { stay, go } = useMemo(() => {
    const goN = Math.round(slots.length * clamp(alightRatio, 0, 1))
    if (goN <= 0) return { stay: slots, go: [] as Slot[] }
    const idx = slots.map((s, i) => ({
      i,
      d: Math.min(...DOORS.map((z) => Math.abs(z - s.z))),
    }))
    idx.sort((a, b) => a.d - b.d)
    const goSet = new Set(idx.slice(0, goN).map((o) => o.i))
    const stay: Slot[] = []
    const go: Slot[] = []
    slots.forEach((s, i) => (goSet.has(i) ? go : stay).push(s))
    return { stay, go }
  }, [slots, alightRatio])

  useLayoutEffect(() => applyMatrices(stayRef.current, stay, seed), [stay, seed])
  useLayoutEffect(() => applyMatrices(goRef.current, go, seed + 31), [go, seed])

  useFrame(({ clock }) => {
    if (goMat.current) {
      goMat.current.emissiveIntensity = 0.45 + Math.sin(clock.elapsedTime * 3.2) * 0.35
    }
  })

  const cap = Math.max(1, slots.length)
  return (
    <group>
      <instancedMesh ref={stayRef} args={[PERSON_GEO, undefined, cap]} castShadow>
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={goRef} args={[PERSON_GEO, undefined, cap]} castShadow>
        <meshStandardMaterial
          ref={goMat}
          color={ALIGHT_COLOR}
          emissive={ALIGHT_COLOR}
          emissiveIntensity={0.5}
          roughness={0.4}
          metalness={0.1}
        />
      </instancedMesh>
    </group>
  )
}

function Straps() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.TorusGeometry(0.07, 0.02, 6, 12), [])
  const positions = useMemo(() => {
    const zs = linspace(1.4, LEN - 1.2, 14)
    const arr: [number, number][] = []
    for (const x of [-0.8, 0.8]) for (const z of zs) arr.push([x, z])
    return arr
  }, [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    positions.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, 1.82, z), q, s)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [positions, geo])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, positions.length]}>
      <meshStandardMaterial color="#e8a06a" roughness={0.6} />
    </instancedMesh>
  )
}

function Interior({
  value,
  level,
  alightRatio,
}: {
  value: number
  level: CrowdLevel
  alightRatio: number
}) {
  const seatColor = '#e8a878'
  const wall = '#e9edf2'
  const metal = '#c2c8d0'
  const peopleColor = shade(LEVEL_META[level].color, -0.14)

  const pillarZs = useMemo(() => linspace(1.2, LEN - 1.0, 7), [])

  return (
    <group>
      {/* 바닥 */}
      <mesh position={[0, 0, LEN / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALF_W * 2, LEN]} />
        <meshStandardMaterial color="#d7dbe0" roughness={0.9} />
      </mesh>
      {/* 통로 러너 */}
      <mesh position={[0, 0.005, LEN / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, LEN]} />
        <meshStandardMaterial color="#eef1f4" roughness={0.85} />
      </mesh>

      {/* 천장 */}
      <mesh position={[0, H, LEN / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, LEN]} />
        <meshStandardMaterial color="#f3f5f8" roughness={0.8} />
      </mesh>
      {/* 중앙 공조 덕트 */}
      <mesh position={[0, H - 0.08, LEN / 2]}>
        <boxGeometry args={[0.55, 0.16, LEN]} />
        <meshStandardMaterial color="#e4e8ee" roughness={0.7} />
      </mesh>

      {/* 좌우 벽 + 창 + 좌석 */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* 벽 하단 */}
          <mesh position={[side * HALF_W, 0.5, LEN / 2]} rotation={[0, -side * Math.PI / 2, 0]}>
            <planeGeometry args={[LEN, 1.0]} />
            <meshStandardMaterial color={wall} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          {/* 벽 상단 */}
          <mesh position={[side * HALF_W, 1.95, LEN / 2]} rotation={[0, -side * Math.PI / 2, 0]}>
            <planeGeometry args={[LEN, 0.7]} />
            <meshStandardMaterial color={wall} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          {/* 창문 띠 (은은한 발광) */}
          <mesh position={[side * (HALF_W - 0.01), 1.45, LEN / 2]} rotation={[0, -side * Math.PI / 2, 0]}>
            <planeGeometry args={[LEN, 0.7]} />
            <meshStandardMaterial
              color="#eaf2fb"
              emissive="#cfe2f5"
              emissiveIntensity={0.55}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* 창틀 기둥 */}
          {pillarZs.map((z) => (
            <mesh key={z} position={[side * (HALF_W - 0.02), 1.45, z]}>
              <boxGeometry args={[0.05, 0.72, 0.08]} />
              <meshStandardMaterial color={metal} roughness={0.5} metalness={0.3} />
            </mesh>
          ))}

          {/* 롱시트 (구간별) */}
          {SEAT_SEGMENTS.map(([z0, z1], i) => {
            const len = z1 - z0
            const cz = (z0 + z1) / 2
            return (
              <group key={i}>
                {/* 방석 */}
                <mesh position={[side * (HALF_W - 0.28), SEAT_Y, cz]} castShadow>
                  <boxGeometry args={[0.5, 0.12, len]} />
                  <meshStandardMaterial color={seatColor} roughness={0.65} />
                </mesh>
                {/* 등받이 */}
                <mesh position={[side * (HALF_W - 0.05), SEAT_Y + 0.35, cz]}>
                  <boxGeometry args={[0.08, 0.7, len]} />
                  <meshStandardMaterial color={shade(seatColor, -0.06)} roughness={0.65} />
                </mesh>
              </group>
            )
          })}

          {/* 세로 손잡이 봉 (문 옆) */}
          {DOORS.map((z) => (
            <mesh key={z} position={[side * (HALF_W - 0.18), H / 2, z]}>
              <cylinderGeometry args={[0.03, 0.03, H, 10]} />
              <meshStandardMaterial color={metal} metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 천장 손잡이 봉 (양쪽) */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 1.95, LEN / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, LEN - 0.6, 10]} />
          <meshStandardMaterial color={metal} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <Straps />

      {/* 맞은편 끝 — 관통문 + 안내 디스플레이 */}
      <mesh position={[0, 1.1, LEN]}>
        <boxGeometry args={[HALF_W * 2, 2.2, 0.1]} />
        <meshStandardMaterial color="#dfe4ea" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, LEN - 0.06]}>
        <boxGeometry args={[0.9, 1.7, 0.06]} />
        <meshStandardMaterial color="#aeb6c0" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.5, LEN - 0.09]}>
        <boxGeometry args={[0.7, 0.5, 0.02]} />
        <meshStandardMaterial color="#c9e6ff" emissive="#bfe0ff" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>
      {/* 상단 LED 안내판 */}
      <mesh position={[0, 2.05, LEN - 0.12]}>
        <boxGeometry args={[1.5, 0.32, 0.06]} />
        <meshStandardMaterial color="#12151b" emissive="#0a0d12" emissiveIntensity={0.2} />
      </mesh>

      {/* 근처(카메라 뒤) 벽 살짝 */}
      <mesh position={[0, 1.1, -0.4]}>
        <boxGeometry args={[HALF_W * 2, 2.2, 0.1]} />
        <meshStandardMaterial color="#dfe4ea" roughness={0.7} side={THREE.BackSide} />
      </mesh>

      <Passengers value={value} color={peopleColor} seed={Math.round(value) * 13 + 1} alightRatio={alightRatio} />
    </group>
  )
}

const DENSITY_LABEL: Record<CrowdLevel, string> = {
  easy: '여유',
  mild: '보통',
  warn: '다소 높음',
  busy: '높음',
  full: '매우 높음',
}

interface CarInterior3DProps {
  prediction: PredictionResult
  car: number
  lineLabel: string
  stationName: string
  /** 진입역 id — 하차 예측 입력 */
  stationId: string
  lineId: string
  direction: 'up' | 'down'
  hour: number
  onSelectCar: (car: number) => void
  onClose: () => void
}

export function CarInterior3D({
  prediction,
  car,
  lineLabel,
  stationName,
  stationId,
  lineId,
  direction,
  hour,
  onSelectCar,
  onClose,
}: CarInterior3DProps) {
  const data = prediction.cars.find((c) => c.car === car) ?? prediction.cars[0]
  const meta = LEVEL_META[data.level]
  const occupied = Math.min(SEATS_PER_CAR, Math.round(SEATS_PER_CAR * clamp(data.value / 60)))
  const freeSeats = SEATS_PER_CAR - occupied

  // 진입역 기준 이 칸의 하차 타임라인 (다음 역부터)
  const alighting = useMemo(
    () =>
      mockAlightingProvider.forCar({
        boardStationId: stationId,
        lineId,
        direction,
        car,
        hour,
        carValue: data.value,
        lookahead: 3,
      }),
    [stationId, lineId, direction, car, hour, data.value],
  )
  const stops = alighting.stops

  // 타임라인에서 초점을 둔 정차역 (기본: 다음 역). 칸 바뀌면 리셋.
  const [focus, setFocus] = useState(0)
  useEffect(() => setFocus(0), [car])
  const focusIdx = stops.length ? Math.min(focus, stops.length - 1) : 0
  const focused: AlightStop | null = stops[focusIdx] ?? null
  const focusedRatio = focused ? focused.alightRatio : 0

  const sourceLabel = alighting.source === 'sk-realtime' ? 'SK 실시간' : '진입역 기준 추정'

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/70">
      <div className="flex h-full w-full max-w-[440px] flex-col bg-ink-950 animate-fade-up sm:my-4 sm:h-[calc(100vh-2rem)] sm:overflow-hidden sm:rounded-[28px] sm:ring-1 sm:ring-white/10">
      {/* 3D 캔버스 */}
      <div className="relative flex-1">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 1.62, 0.7], fov: 68 }}
          gl={{ antialias: true }}
          key={car}
        >
          <color attach="background" args={['#f4f6f8']} />
          <ambientLight intensity={0.95} />
          <hemisphereLight args={['#ffffff', '#cfd6de', 0.7]} />
          <directionalLight position={[2, 6, 4]} intensity={0.7} castShadow />
          <directionalLight position={[-2, 5, 8]} intensity={0.35} />
          <Interior value={data.value} level={data.level} alightRatio={focusedRatio} />
          <OrbitControls
            enablePan={false}
            target={[0, 1.05, 7]}
            minDistance={3}
            maxDistance={9}
            minPolarAngle={1.25}
            maxPolarAngle={1.62}
            minAzimuthAngle={Math.PI - 0.3}
            maxAzimuthAngle={Math.PI + 0.3}
            {...ORBIT_TUNING}
          />
        </Canvas>

        {/* 상단 바 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-4 pb-6 pt-4">
          <button
            onClick={onClose}
            className="pointer-events-auto flex items-center gap-2 text-white"
          >
            <span className="text-xl leading-none">←</span>
            <span className="text-[16px] font-bold">
              {car}호칸 · <span style={{ color: meta.color }}>{data.value}%</span>
            </span>
          </button>
          <span className="pointer-events-none rounded-lg bg-white/85 px-2.5 py-1 text-[11px] font-bold text-ink-900 shadow">
            3D 모델
          </span>
        </div>

        {/* 노선/역 캡션 */}
        <div className="pointer-events-none absolute left-4 top-14 text-[11px] font-medium text-ink-900/70">
          {lineLabel} · {stationName} 승강장
        </div>

        {/* 하단 통계 패널 (여유 좌석 · 입석 밀집도) */}
        <div className="pointer-events-none absolute inset-x-3 bottom-4">
          <div className="flex items-stretch gap-px overflow-hidden rounded-2xl bg-ink-900/85 backdrop-blur ring-1 ring-white/10">
            <div className="flex-1 px-4 py-2.5">
              <div className="text-[11px] text-slate-400">여유 좌석</div>
              <div className="mt-0.5 text-lg font-extrabold text-white">
                {freeSeats}
                <span className="ml-0.5 text-sm font-semibold text-slate-400">석</span>
              </div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 px-4 py-2.5">
              <div className="text-[11px] text-slate-400">입석 밀집도</div>
              <div className="mt-0.5 text-lg font-extrabold" style={{ color: meta.color }}>
                {DENSITY_LABEL[data.level]}
              </div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1 px-4 py-2.5">
              <div className="text-[11px] text-slate-400">현재 탑승</div>
              <div className="mt-0.5 text-lg font-extrabold text-white">
                {alighting.boardingHeadcount}
                <span className="ml-0.5 text-sm font-semibold text-slate-400">명</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 하차 예보 패널 */}
      <div className="bg-ink-950 px-3 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-white">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ALIGHT_COLOR }} />
            칸별 하차 예보
          </span>
          <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 ring-1 ring-white/5">
            {sourceLabel}
          </span>
        </div>

        {focused ? (
          <>
            {/* 초점 정차역 요약 */}
            <div className="rounded-2xl bg-ink-900 p-3 ring-1 ring-white/5">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-white">
                  {focusIdx === 0 ? '다음 역 · ' : ''}
                  {focused.stationName}
                  {focused.isTransfer && (
                    <span className="ml-1.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-300">
                      환승
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium text-slate-400">약 {focused.etaMinutes}분 뒤</span>
              </div>

              <div className="mt-2 flex items-end gap-3">
                <div>
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: ALIGHT_COLOR }}>
                    {focused.alightCount}
                  </span>
                  <span className="ml-0.5 text-sm font-semibold text-slate-400">명 하차</span>
                </div>
                <span className="mb-0.5 text-[12px] font-semibold text-slate-400">
                  이 칸의 {Math.round(focused.alightRatio * 100)}%
                </span>
                <span className="mb-0.5 ml-auto text-[12px] text-slate-400">
                  하차 후{' '}
                  <span
                    className="font-bold"
                    style={{ color: LEVEL_META[levelOf(focused.valueAfter)].color }}
                  >
                    {focused.valueAfter}%
                  </span>
                </span>
              </div>

              {/* 하차 비율 바 */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(focused.alightRatio * 100)}%`, backgroundColor: ALIGHT_COLOR }}
                />
              </div>
            </div>

            {/* 정차역 타임라인 */}
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {stops.map((s, i) => {
                const active = i === focusIdx
                return (
                  <button
                    key={s.stationId}
                    onClick={() => setFocus(i)}
                    className="flex shrink-0 flex-col items-start rounded-xl px-3 py-2 text-left transition-all"
                    style={{
                      background: active ? `${ALIGHT_COLOR}1f` : '#141a26',
                      boxShadow: active ? `inset 0 0 0 1.5px ${ALIGHT_COLOR}` : 'inset 0 0 0 1px #232d42',
                    }}
                  >
                    <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: active ? ALIGHT_COLOR : '#cbd5e1' }}>
                      {s.stationName}
                      {s.isTransfer && <span className="text-[9px] text-brand-300">환승</span>}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">약 {s.etaMinutes}분 · {s.alightCount}명↓</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-ink-900 p-4 text-center text-[12px] text-slate-500 ring-1 ring-white/5">
            이 방향의 다음 정차역 정보가 없어요
          </div>
        )}
      </div>

      {/* 칸 전환 칩 */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar bg-ink-950 px-3 py-3 safe-b">
        {prediction.cars.map((c) => {
          const cm = LEVEL_META[c.level]
          const active = c.car === car
          return (
            <button
              key={c.car}
              onClick={() => onSelectCar(c.car)}
              className="flex shrink-0 flex-col items-center rounded-xl px-3.5 py-2 transition-all"
              style={{
                background: active ? `${cm.color}26` : '#141a26',
                boxShadow: active ? `inset 0 0 0 1.5px ${cm.color}` : 'inset 0 0 0 1px #232d42',
              }}
            >
              <span
                className="text-[13px] font-bold"
                style={{ color: active ? cm.color : '#cbd5e1' }}
              >
                {c.car}호칸
              </span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: active ? cm.color : '#64748b' }}>
                {c.value}%
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
