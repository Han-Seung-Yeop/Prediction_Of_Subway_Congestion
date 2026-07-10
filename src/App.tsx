import { useState } from 'react'
import type { AppMode } from './data/types'
import { TopBar, ModeTabs } from './components/Chrome'
import { RouteView } from './views/RouteView'
import { ExploreView } from './views/ExploreView'

export default function App() {
  const [mode, setMode] = useState<AppMode>('route')

  return (
    <div className="min-h-full bg-grid">
      {/* 모바일 프레임 (데스크톱에서 중앙 정렬) */}
      <div className="mx-auto flex min-h-full max-w-[440px] flex-col bg-ink-950/60 shadow-2xl ring-1 ring-white/5 safe-x sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-[28px]">
        {/* 상단 고정 영역 */}
        <div className="sticky top-0 z-20 glass safe-t sm:rounded-t-[28px]">
          <TopBar />
          <ModeTabs mode={mode} onChange={setMode} />
        </div>

        {mode === 'route' ? <RouteView /> : <ExploreView />}
      </div>
    </div>
  )
}
