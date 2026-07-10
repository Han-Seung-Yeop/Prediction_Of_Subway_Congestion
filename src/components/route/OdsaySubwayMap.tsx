import { useEffect, useRef, useState } from 'react'
import type { OdsaySubwayMapInstance } from '../../types/odsay'

// ODsay Subway Map SDK(odsay.maps.Subway) React 래퍼.
//   수도권 전체 노선도를 그려주고, 역을 탭하면 SDK 자체 네이티브 팝업(출발/경유/도착/상세)이
//   뜬다. 여기서 "출발"/"도착"을 선택하면 SDK가 start_changed/end_changed 이벤트를 쏘는데,
//   이걸 받아 fromId/toId 선택에 연결한다. 경로·혼잡도 계산 자체는 여전히 mock 어댑터
//   (routing.ts, congestion.ts)가 담당하고, 이 컴포넌트는 "역을 고르는 화면" 역할만 한다.

const SDK_CALLBACK_NAME = '__initOdsaySubwayMap'
const CITY_SEOUL = 1000

// 초기 화면 — 시연 3역의 환승 중심역인 을지로3가를 기준으로 확대해서 시작한다.
const INITIAL_CENTER_STATION = '을지로3가'
const INITIAL_ZOOM_LEVEL = 3

export interface PickedStation {
  stationId: string
  stationName: string
}

interface OdsaySubwayMapProps {
  apiKey: string
  onPickStart: (station: PickedStation) => void
  onPickEnd: (station: PickedStation) => void
}

let sdkLoadPromise: Promise<void> | null = null

function loadOdsaySdk(apiKey: string): Promise<void> {
  if (window.odsay) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, () => void>
    w[SDK_CALLBACK_NAME] = () => resolve()
    const script = document.createElement('script')
    script.src = `https://api.odsay.com/v1/api/subway/sdk.js?apiKey=${encodeURIComponent(apiKey)}&callback=${SDK_CALLBACK_NAME}`
    script.async = true
    script.onerror = () => reject(new Error('ODsay SDK 스크립트 로드 실패'))
    document.head.appendChild(script)
  })
  return sdkLoadPromise
}

export function OdsaySubwayMap({ apiKey, onPickStart, onPickEnd }: OdsaySubwayMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<OdsaySubwayMapInstance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(apiKey ? 'loading' : 'error')

  // 최신 콜백을 ref 로 들고 있어, 부모 리렌더로 콜백 identity 가 바뀌어도
  // SDK 위젯을 다시 만들지 않는다 (지도 재생성은 apiKey 가 바뀔 때만).
  const onPickStartRef = useRef(onPickStart)
  const onPickEndRef = useRef(onPickEnd)
  onPickStartRef.current = onPickStart
  onPickEndRef.current = onPickEnd

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false

    loadOdsaySdk(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.odsay) return
        const map = new window.odsay.maps.Subway(containerRef.current)
        mapRef.current = map

        map.addEvent('start_changed', (data) => {
          onPickStartRef.current({ stationId: String(data.stationID), stationName: data.stationName })
        })
        map.addEvent('end_changed', (data) => {
          onPickEndRef.current({ stationId: String(data.stationID), stationName: data.stationName })
        })
        // svg 로드가 끝난 뒤에만 역 좌표를 조회할 수 있어 ready 이벤트에서 초기 확대/중심 이동을 건다.
        map.addEvent('ready', () => {
          map.setLevel(INITIAL_ZOOM_LEVEL)
          map.searchStation(INITIAL_CENTER_STATION).then((res) => {
            const st = res.result?.station?.[0]
            if (st) map.setCenter(st.stationID)
          })
        })

        map.setCID(CITY_SEOUL)

        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [apiKey])

  return (
    <div className="odsay-subway-map mx-4 overflow-hidden rounded-2xl bg-ink-900/80 ring-1 ring-white/5">
      {/* SDK 가 역명 라벨에 fill="#333333" 을 직접 박아 넣어(어두운 배경에서 안 보임), CSS 로 덮어쓴다 */}
      <style>{`.odsay-subway-map svg text { fill: #fff !important; }`}</style>
      <div ref={containerRef} className="h-[420px] w-full" />
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          노선도 불러오는 중…
        </div>
      )}
      {status === 'error' && (
        <p className="px-3 py-3 text-center text-[12px] text-rose-400">
          {apiKey
            ? '노선도를 불러오지 못했어요. 네트워크 또는 API 키를 확인해 주세요.'
            : '.env 에 VITE_ODSAY_API_KEY 가 설정되지 않았어요.'}
        </p>
      )}
    </div>
  )
}
