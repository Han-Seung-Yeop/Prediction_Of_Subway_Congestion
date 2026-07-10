import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Bounds, Center, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ORBIT_TUNING } from '../lib/three'
import { STATION_MODELS, FALLBACK_STATION_MODEL } from '../data/stationModels'
import {
  STATION_MARKER_SETS,
  FALLBACK_MARKER_SET,
  type Marker,
  type StationMarkerSet,
} from '../data/stationMarkers'

// ─────────────────────────────────────────────────────────────
// 역 내부노선 glb 뷰어 + 안내도 마커(엘리베이터·화장실·출구 등) 오버레이
//   실제 시연 3역(안국·을지로3가·성수)은 각자의 glb 를 보여주되, 마커 핀은
//   역별로 좌표를 손으로 잡아야 해서(../data/stationMarkers) 한 역씩 추가한다.
//   매칭되는 역이 없으면 기존 역삼역 예시 모델+마커로 대신한다.
//   역삼역 모델은 POSITION 만 있고 NORMAL·재질이 없어(Meshy 원본), 로드 시
//   노말을 계산하고 표준 재질을 입혀 조명을 받게 한다.
//   역 id → glb 매칭 표는 ../data/stationModels 에서 관리(뷰에서도 three.js
//   없이 참조할 수 있도록 분리).
// ─────────────────────────────────────────────────────────────
const FALLBACK_MODEL = FALLBACK_STATION_MODEL

function norm(half: StationMarkerSet['half'], [nx, ny, nz]: [number, number, number]): [number, number, number] {
  return [nx * half.x, ny * half.y, nz * half.z]
}

function MarkerPin({ m, half }: { m: Marker; half: StationMarkerSet['half'] }) {
  const pos = norm(half, m.n)

  if (m.kind === 'exit') {
    return (
      <Html position={pos} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#f5c518',
            color: '#1a1400',
            fontSize: 12,
            fontWeight: 900,
            boxShadow: '0 2px 8px rgba(0,0,0,.45)',
          }}
        >
          {m.label}
        </div>
      </Html>
    )
  }

  if (m.kind === 'here') {
    return (
      <Html position={pos} center zIndexRange={[31, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            whiteSpace: 'nowrap',
            background: '#e11d48',
            color: '#fff',
            fontSize: 11,
            fontWeight: 900,
            borderRadius: 999,
            padding: '3px 10px',
            boxShadow: '0 3px 10px rgba(225,29,72,.5)',
          }}
        >
          ● {m.label}
        </div>
      </Html>
    )
  }

  if (m.kind === 'floor') {
    return (
      <Html position={pos} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontWeight: 800,
            color: '#e7ecf4',
            background: 'rgba(10,14,22,.78)',
            borderRadius: 8,
            padding: '3px 9px',
          }}
        >
          {m.label}
        </div>
      </Html>
    )
  }

  // poi / facility — 아이콘 배지 + 라벨
  return (
    <Html position={pos} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: m.color ?? '#64748b',
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            boxShadow: '0 2px 6px rgba(0,0,0,.4)',
          }}
        >
          {m.icon}
        </div>
        <span
          style={{
            marginTop: 3,
            fontSize: 9,
            fontWeight: 700,
            color: '#cbd5e1',
            whiteSpace: 'nowrap',
            background: 'rgba(10,14,22,.6)',
            borderRadius: 5,
            padding: '1px 5px',
          }}
        >
          {m.label}
        </span>
      </div>
    </Html>
  )
}

function StationModel({ url, markerSet }: { url: string; markerSet: StationMarkerSet | null }) {
  const { scene } = useGLTF(url)

  const prepared = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const geo = mesh.geometry as THREE.BufferGeometry
      // 원본에 노말이 없으면 조명이 안 먹으므로 계산해준다
      if (!geo.getAttribute('normal')) geo.computeVertexNormals()
      // 재질이 없으므로 표준 재질을 입힌다
      mesh.material = new THREE.MeshStandardMaterial({
        color: '#a9b8ce',
        roughness: 0.72,
        metalness: 0.12,
      })
    })
    return root
  }, [scene])

  return (
    <group>
      <primitive object={prepared} />
      {markerSet && markerSet.markers.map((m) => <MarkerPin key={m.id} m={m} half={markerSet.half} />)}
    </group>
  )
}
useGLTF.preload(FALLBACK_MODEL.url)
for (const { url } of Object.values(STATION_MODELS)) useGLTF.preload(url)

function Loader() {
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-full bg-ink-900/80 px-3 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        모델 불러오는 중…
      </div>
    </Html>
  )
}

function Scene({
  url,
  spin,
  markerSet,
}: {
  url: string
  spin: boolean
  markerSet: StationMarkerSet | null
}) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-8, 5, -4]} intensity={0.45} color="#8fdcff" />
      <hemisphereLight args={['#dcefff', '#0d1119', 0.55]} />

      <Suspense fallback={<Loader />}>
        {/* 모델 크기가 작고 원점 근처라 Center 로 정렬 후 Bounds 로 화면에 맞춘다 */}
        <Bounds fit clip observe margin={1.1}>
          <Center>
            <StationModel url={url} markerSet={markerSet} />
          </Center>
        </Bounds>
      </Suspense>

      <ContactShadows position={[0, -0.35, 0]} opacity={0.4} scale={12} blur={2.2} far={4} color="#000000" />

      <OrbitControls
        enablePan
        enableZoom
        minDistance={1.2}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2.05}
        {...ORBIT_TUNING}
        autoRotate={spin}
        autoRotateSpeed={0.3}
      />
    </>
  )
}

export function Station3D({
  stationId,
  spin = true,
  showMarkers = true,
}: {
  /** 역 id (예: 's-anguk') — 매칭되는 glb 가 있으면 그 역을, 없으면 역삼역 예시를 보여준다 */
  stationId?: string | null
  spin?: boolean
  showMarkers?: boolean
}) {
  const matched = stationId ? STATION_MODELS[stationId] : undefined
  const model = matched ?? FALLBACK_MODEL
  const isExample = !matched
  // 실제 모델이 있어도 그 역 전용 마커 좌표가 아직 없으면(을지로3가·성수) 마커는 숨긴다.
  const hasOwnMarkers = !!stationId && stationId in STATION_MARKER_SETS
  const markerSet = showMarkers && (isExample || hasOwnMarkers) ? (hasOwnMarkers ? STATION_MARKER_SETS[stationId as string] : FALLBACK_MARKER_SET) : null

  return (
    <div className="relative h-[340px] w-full">
      <Canvas
        key={model.url}
        shadows
        dpr={[1, 2]}
        camera={{ position: [4, 3, 6], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene url={model.url} spin={spin} markerSet={markerSet} />
      </Canvas>

      <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-xl bg-ink-900/60 px-2.5 py-1.5 backdrop-blur">
        <span className="text-[10.5px] font-semibold text-slate-300">
          {model.label} 내부노선 · 3D 모델{isExample ? ' (예시)' : ''}
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/70 px-3 py-1 text-[10px] font-medium text-slate-400 backdrop-blur">
        드래그 회전 · 휠 줌 · 우클릭 이동
      </div>
    </div>
  )
}
