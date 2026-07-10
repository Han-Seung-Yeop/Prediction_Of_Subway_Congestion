// 경로 탐색 어댑터 계층
//   UI 는 RouteProvider 인터페이스에만 의존한다.
//   1차: mock(그래프 Dijkstra). 이후 ODsay 구현으로 무손실 교체.

import type { RouteLeg, RoutePlan } from '../data/types'
import { buildAdjacency, getStation, type GraphEdge } from '../data/subway'

export interface RouteProvider {
  findRoutes(fromId: string, toId: string, departAt: Date): RoutePlan[]
}

/** 환승 1회의 체감 페널티(분 환산) — 종합 랭킹에서 환승을 억제 */
const TRANSFER_PENALTY = 6

interface Crumb {
  from: string
  edge: GraphEdge
}

/**
 * 최소 시간·최소 환승·최소 도보를 종합한 비용으로 Dijkstra.
 *   cost = 승차분 + 환승도보분 + (환승 1회당 페널티)
 */
export const mockRouteProvider: RouteProvider = {
  findRoutes(fromId, toId) {
    if (fromId === toId) return []
    const adj = buildAdjacency()

    const dist = new Map<string, number>()
    const prev = new Map<string, Crumb>()
    const visited = new Set<string>()
    dist.set(fromId, 0)

    // 노드 수가 작아 단순 선형 최소값 선택으로 충분
    while (true) {
      let cur: string | null = null
      let best = Infinity
      for (const [node, d] of dist) {
        if (!visited.has(node) && d < best) {
          best = d
          cur = node
        }
      }
      if (cur == null || cur === toId) break
      visited.add(cur)

      for (const edge of adj.get(cur) ?? []) {
        if (visited.has(edge.to)) continue
        const step = edge.minutes + (edge.transfer ? TRANSFER_PENALTY : 0)
        const nd = best + step
        if (nd < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, nd)
          prev.set(edge.to, { from: cur, edge })
        }
      }
    }

    if (!dist.has(toId)) return []

    // 경로 복원 (target → source)
    const chain: Crumb[] = []
    let node = toId
    while (node !== fromId) {
      const crumb = prev.get(node)
      if (!crumb) return []
      chain.push(crumb)
      node = crumb.from
    }
    chain.reverse() // source → target 순서

    const plan = buildPlan(fromId, chain, dist.get(toId) ?? 0)
    return plan ? [plan] : []
  },
}

/** 복원된 edge 체인을 노선별 leg 로 묶는다 */
function buildPlan(fromId: string, chain: Crumb[], score: number): RoutePlan | null {
  const legs: RouteLeg[] = []
  let pendingWalk = 0
  let run: string[] = [fromId] // 현재 leg 의 역 시퀀스

  const flush = () => {
    if (run.length < 2) {
      run = [run[run.length - 1]]
      return
    }
    const board = getStation(run[0])!
    const alight = getStation(run[run.length - 1])!
    const rideMinutes = Math.round((run.length - 1) * 2.5)
    legs.push({
      lineId: board.lineId,
      boardStationId: board.id,
      alightStationId: alight.id,
      direction: alight.order > board.order ? 'up' : 'down',
      stationIds: [...run],
      numStations: run.length - 1,
      rideMinutes,
      transferWalkMinutes: pendingWalk,
    })
    pendingWalk = 0
    run = [alight.id]
  }

  for (const { edge } of chain) {
    if (edge.transfer) {
      flush()
      pendingWalk += edge.minutes
      run = [edge.to] // 환승 후 새 leg 시작점
    } else {
      run.push(edge.to)
    }
  }
  flush()

  if (legs.length === 0) return null

  const walkMinutes = legs.reduce((a, l) => a + l.transferWalkMinutes, 0)
  const rideTotal = legs.reduce((a, l) => a + l.rideMinutes, 0)
  return {
    id: legs.map((l) => l.boardStationId).join('>'),
    legs,
    totalMinutes: rideTotal + walkMinutes,
    transferCount: legs.length - 1,
    walkMinutes,
    score: Math.round(score),
  }
}
