import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Html, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import type { PredictionResult } from '../data/predict'
import { LEVEL_META } from '../data/predict'
import { PERSON_GEO, mulberry32, linspace, shade, ORBIT_TUNING } from '../lib/three'

// ─────────────────────────────────────────────────────────────
// 치수 (열차는 X축을 따라 늘어선다)
// ─────────────────────────────────────────────────────────────
const CAR_W = 2.6
const CAR_GAP = 0.2
const CAR_H = 1.18
const CAR_D = 1.42
const SPAN = CAR_W + CAR_GAP
const SEATS_TOTAL = 12

// ── 혼잡도(0~100) → 탑승 인원 ──
function peopleCount(value: number) {
  return Math.max(2, Math.round(2 + (value / 100) * 30))
}

interface Slot {
  x: number
  z: number
  seated: boolean
}

/** 좌석 우선 → 입석 순으로 채운 승객 좌표 목록 */
function buildSlots(count: number, seed: number): Slot[] {
  const rand = mulberry32(seed)
  const seatXs = linspace(-CAR_W * 0.4, CAR_W * 0.4, SEATS_TOTAL / 2)

  const seated: Slot[] = []
  for (const x of seatXs) seated.push({ x, z: -CAR_D / 2 + 0.24, seated: true })
  for (const x of seatXs) seated.push({ x, z: CAR_D / 2 - 0.26, seated: true })

  const standCols = Math.max(3, Math.ceil(count / 2.4))
  const standXs = linspace(-CAR_W * 0.44, CAR_W * 0.44, standCols)
  const zRows = [-0.22, 0.0, 0.22]
  const standing: Slot[] = []
  for (const z of zRows)
    for (const x of standXs)
      standing.push({
        x: x + (rand() - 0.5) * 0.13,
        z: z + (rand() - 0.5) * 0.09,
        seated: false,
      })
  // 입석은 섞어서 자연스럽게 채움
  for (let i = standing.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[standing[i], standing[j]] = [standing[j], standing[i]]
  }

  const nSeated = Math.min(count, seated.length)
  const nStanding = Math.min(count - nSeated, standing.length)
  return [...seated.slice(0, nSeated), ...standing.slice(0, nStanding)]
}

// ─────────────────────────────────────────────────────────────
// 승객 (칸별 InstancedMesh)
// ─────────────────────────────────────────────────────────────
function People({ count, color, seed }: { count: number; color: string; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const slots = useMemo(() => buildSlots(count, seed), [count, seed])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = mulberry32(seed + 99)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    slots.forEach((s, i) => {
      const yRot = (rand() - 0.5) * 0.8
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yRot)
      if (s.seated) {
        pos.set(s.x, 0.17, s.z)
        scl.set(1, 0.62, 1)
      } else {
        pos.set(s.x, 0, s.z)
        const h = 0.92 + rand() * 0.16
        scl.set(1, h, 1)
      }
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.count = slots.length
    mesh.instanceMatrix.needsUpdate = true
  }, [slots, seed])

  return (
    <instancedMesh
      ref={ref}
      args={[PERSON_GEO, undefined, Math.max(1, slots.length)]}
      castShadow
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.12}
        roughness={0.55}
        metalness={0.05}
      />
    </instancedMesh>
  )
}

// ── 천장 손잡이 스트랩 ──
const STRAP_GEO = new THREE.TorusGeometry(0.05, 0.014, 6, 12)
function Straps() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const xs = useMemo(() => linspace(-CAR_W * 0.4, CAR_W * 0.4, 7), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    let i = 0
    for (const z of [-0.26, 0.26]) {
      for (const x of xs) {
        m.compose(new THREE.Vector3(x, CAR_H - 0.2, z), q, s)
        mesh.setMatrixAt(i++, m)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [xs])
  return (
    <instancedMesh ref={ref} args={[STRAP_GEO, undefined, xs.length * 2]}>
      <meshStandardMaterial color="#cbd3e0" roughness={0.6} />
    </instancedMesh>
  )
}

// ─────────────────────────────────────────────────────────────
// 컷어웨이 열차 칸
// ─────────────────────────────────────────────────────────────
interface CarProps {
  index: number
  total: number
  value: number
  color: string
  level: string
  selected: boolean
  isBest: boolean
  onSelect: () => void
}

function Car({ index, total, value, color, level, selected, isBest, onSelect }: CarProps) {
  const group = useRef<THREE.Group>(null)
  const down = useRef<{ x: number; y: number; t: number } | null>(null)
  const x = (index - (total - 1) / 2) * SPAN

  // 드래그(회전)와 탭을 구분 — 탭일 때만 선택/열림
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() }
  }
  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    const dist = Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y)
    if (dist < 8 && performance.now() - d.t < 450) {
      e.stopPropagation()
      onSelect()
    }
  }

  const shell = color
  const roofColor = shade(color, -0.12)
  const benchColor = shade(color, -0.05)
  const bodyPeople = shade(color, -0.22)
  const count = peopleCount(value)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const targetY = selected ? 0.25 : 0
    g.position.y += (targetY - g.position.y) * Math.min(1, delta * 8)
  })

  return (
    <group ref={group} position={[x, 0, 0]} onPointerDown={handleDown} onPointerUp={handleUp}>
      {/* 바닥 */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[CAR_W, 0.06, CAR_D]} />
        <meshStandardMaterial color="#c8ccd4" roughness={0.85} />
      </mesh>

      {/* 지붕 (둥근) */}
      <RoundedBox
        args={[CAR_W, 0.14, CAR_D]}
        radius={0.07}
        smoothness={4}
        position={[0, CAR_H + 0.02, 0]}
      >
        <meshStandardMaterial color={roofColor} roughness={0.5} metalness={0.15} />
      </RoundedBox>

      {/* 뒤쪽 벽 (창 + 문) */}
      <mesh position={[0, CAR_H / 2, -CAR_D / 2]}>
        <boxGeometry args={[CAR_W, CAR_H, 0.06]} />
        <meshStandardMaterial color={shell} transparent opacity={0.55} roughness={0.4} />
      </mesh>
      {/* 창문 띠 */}
      <mesh position={[0, CAR_H * 0.66, -CAR_D / 2 + 0.035]}>
        <boxGeometry args={[CAR_W * 0.82, 0.34, 0.02]} />
        <meshStandardMaterial color="#dbe9f5" transparent opacity={0.32} roughness={0.1} metalness={0.1} />
      </mesh>
      {/* 문 두 짝 */}
      {[-CAR_W * 0.26, CAR_W * 0.26].map((dx) => (
        <mesh key={dx} position={[dx, CAR_H * 0.44, -CAR_D / 2 + 0.033]}>
          <boxGeometry args={[0.5, CAR_H * 0.8, 0.015]} />
          <meshStandardMaterial color={shade(color, 0.12)} transparent opacity={0.4} roughness={0.3} />
        </mesh>
      ))}

      {/* 앞쪽(카메라측) 낮은 벽 — 개방된 컷어웨이 */}
      <mesh position={[0, 0.19, CAR_D / 2]}>
        <boxGeometry args={[CAR_W, 0.38, 0.06]} />
        <meshStandardMaterial color={shell} roughness={0.45} metalness={0.1} />
      </mesh>

      {/* 좌우 끝 벽 */}
      {[-CAR_W / 2, CAR_W / 2].map((ex) => (
        <mesh key={ex} position={[ex, CAR_H / 2, 0]}>
          <boxGeometry args={[0.06, CAR_H, CAR_D]} />
          <meshStandardMaterial color={shell} transparent opacity={0.7} roughness={0.45} />
        </mesh>
      ))}

      {/* 롱시트 벤치 (양쪽) */}
      {[-CAR_D / 2 + 0.2, CAR_D / 2 - 0.2].map((bz) => (
        <mesh key={bz} position={[0, 0.16, bz]}>
          <boxGeometry args={[CAR_W * 0.82, 0.14, 0.24]} />
          <meshStandardMaterial color={benchColor} roughness={0.6} />
        </mesh>
      ))}

      {/* 천장 손잡이 봉 */}
      {[-0.26, 0.26].map((bz) => (
        <mesh key={bz} position={[0, CAR_H - 0.14, bz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, CAR_W * 0.88, 8]} />
          <meshStandardMaterial color="#b8c0cc" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <Straps />

      {/* 승객 */}
      <People count={count} color={bodyPeople} seed={index * 131 + Math.round(value)} />

      {/* 최여유 칸 표식 */}
      {isBest && (
        <mesh position={[0, CAR_H + 0.4, 0]}>
          <coneGeometry args={[0.12, 0.22, 4]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.7} />
        </mesh>
      )}

      {/* 말풍선 % 라벨 */}
      <Html
        position={[0, CAR_H + 0.7, 0]}
        center
        distanceFactor={11}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: selected ? '#fff' : '#9fb0c9', marginBottom: 2 }}>
            {index + 1}호칸
          </span>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: 15,
                fontWeight: 800,
                color: '#fff',
                background: color,
                borderRadius: 10,
                padding: '3px 10px',
                boxShadow: selected ? `0 0 16px ${color}` : `0 2px 8px rgba(0,0,0,.35)`,
                transform: selected ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform .2s',
              }}
            >
              {value}%
            </span>
            {/* 말풍선 꼬리 */}
            <span
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -5,
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `7px solid ${color}`,
              }}
            />
          </div>
          <span style={{ marginTop: 6, fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: selected ? '#e2e8f0' : '#7c8aa0' }}>
            {LEVEL_META[level as keyof typeof LEVEL_META].label}
          </span>
        </div>
      </Html>
    </group>
  )
}

// ── 선로 + 승강장 ──
function TrackAndPlatform({ total }: { total: number }) {
  const len = total * SPAN + 2.4
  return (
    <group position={[0, -0.02, 0]}>
      {/* 레일 */}
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[len, 0.05, 0.07]} />
          <meshStandardMaterial color="#7b8494" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* 침목 */}
      {linspace(-len / 2 + 0.4, len / 2 - 0.4, Math.round(len / 0.7)).map((x, i) => (
        <mesh key={i} position={[x, -0.06, 0]}>
          <boxGeometry args={[0.14, 0.06, 1.5]} />
          <meshStandardMaterial color="#3a4152" roughness={0.9} />
        </mesh>
      ))}
      {/* 승강장 */}
      <mesh position={[0, -0.02, CAR_D / 2 + 1.5]} receiveShadow>
        <boxGeometry args={[len, 0.1, 2.4]} />
        <meshStandardMaterial color="#e3e6ea" roughness={0.9} />
      </mesh>
      {/* 승강장 안전선 (노란 띠) */}
      <mesh position={[0, 0.035, CAR_D / 2 + 0.42]}>
        <boxGeometry args={[len, 0.02, 0.22]} />
        <meshStandardMaterial color="#f5c518" roughness={0.6} emissive="#f5c518" emissiveIntensity={0.15} />
      </mesh>
    </group>
  )
}

function Scene({ prediction, selected, onSelect }: Train3DProps) {
  const total = prediction.cars.length
  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight position={[6, 10, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-8, 5, -4]} intensity={0.4} color="#8fdcff" />
      <hemisphereLight args={['#dcefff', '#0d1119', 0.55]} />

      <TrackAndPlatform total={total} />

      {prediction.cars.map((car, i) => {
        const meta = LEVEL_META[car.level]
        return (
          <Car
            key={car.car}
            index={i}
            total={total}
            value={car.value}
            color={meta.color}
            level={car.level}
            selected={selected === car.car}
            isBest={prediction.best === car.car}
            onSelect={() => onSelect(car.car)}
          />
        )
      })}

      <ContactShadows position={[0, -0.02, 0]} opacity={0.42} scale={total * 3.2} blur={2.6} far={4} color="#000000" />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={total * SPAN * 0.28}
        maxDistance={total * SPAN * 1.5}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.5, 0]}
        {...ORBIT_TUNING}
        autoRotate={selected == null}
        autoRotateSpeed={0.32}
      />
    </>
  )
}

interface Train3DProps {
  prediction: PredictionResult
  selected: number | null
  onSelect: (car: number) => void
}

export function Train3D({ prediction, selected, onSelect }: Train3DProps) {
  const total = prediction.cars.length
  const dist = total * SPAN * 0.76
  // 열차 길이 방향으로 비스듬히 내려다보는 구도 (원근으로 프레임을 채움)
  const cam = useMemo(
    () => [-dist * 0.5, dist * 0.5, dist * 0.74] as [number, number, number],
    [dist],
  )

  return (
    <div className="relative h-[300px] w-full">
      <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <Scene prediction={prediction} selected={selected} onSelect={onSelect} />
      </Canvas>

      {/* LOW / MID / HIGH 범례 (씬 오버레이) */}
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col gap-1 rounded-xl bg-ink-900/60 px-2.5 py-2 backdrop-blur">
        {[
          { c: '#22c55e', t: '여유' },
          { c: '#facc15', t: '보통' },
          { c: '#ef4444', t: '혼잡' },
        ].map((r) => (
          <div key={r.t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.c }} />
            <span className="text-[10px] font-semibold text-slate-300">{r.t}</span>
          </div>
        ))}
      </div>

      {/* 조작 힌트 */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/70 px-3 py-1 text-[10px] font-medium text-slate-400 backdrop-blur">
        드래그 회전 · 핀치 확대 · 칸을 탭해 선택
      </div>
    </div>
  )
}
