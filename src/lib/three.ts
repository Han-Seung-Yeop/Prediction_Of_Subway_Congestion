import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** 결정론적 유사난수 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function linspace(a: number, b: number, n: number) {
  if (n <= 1) return [(a + b) / 2]
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))
}

export function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(1 + amt)
  return `#${c.getHexString()}`
}

export function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * 3D 뷰 공통 인터랙션 기준 — 열차·역·칸 내부 세 뷰가 동일한 터치/드래그 감도를 공유한다.
 * 값을 낮출수록 드래그 회전·핀치 확대가 차분하고 정밀해지고, dampingFactor를 높일수록
 * 손을 뗀 뒤 더 부드럽게 감속한다. OrbitControls에 `{...ORBIT_TUNING}`으로 펼쳐 적용한다.
 */
export const ORBIT_TUNING = {
  rotateSpeed: 0.7,
  zoomSpeed: 0.8,
  enableDamping: true,
  dampingFactor: 0.12,
} as const

/** 사람 피규어 (몸통 캡슐 + 머리 구) — 발이 y=0 */
export const PERSON_GEO = (() => {
  const body = new THREE.CapsuleGeometry(0.088, 0.22, 3, 8)
  body.translate(0, 0.198, 0)
  const head = new THREE.SphereGeometry(0.072, 10, 10)
  head.translate(0, 0.46, 0)
  return mergeGeometries([body, head])!
})()
