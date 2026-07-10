import { useEffect, useRef, useState } from 'react'
import { getStation, searchStations, getLine } from '../../data/subway'

interface StationSearchProps {
  label: string
  accent: string
  value: string | null
  onSelect: (stationId: string) => void
  placeholder?: string
}

export function StationSearch({
  label,
  accent,
  value,
  onSelect,
  placeholder,
}: StationSearchProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 외부에서 선택(지도 클릭 등)되면 입력창에 반영
  useEffect(() => {
    const st = value ? getStation(value) : null
    setText(st ? st.name : '')
  }, [value])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = open ? searchStations(text) : []
  const selected = value ? getStation(value) : null

  return (
    <div ref={wrapRef} className="relative flex-1">
      <div
        className="flex items-center gap-2 rounded-xl bg-ink-850 px-3 py-2 ring-1 ring-white/5 focus-within:ring-2"
        style={{ ['--tw-ring-color' as string]: accent }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="shrink-0 text-[10px] font-bold" style={{ color: accent }}>
          {label}
        </span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? '역 이름 검색'}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-white placeholder:font-normal placeholder:text-slate-500 focus:outline-none"
        />
        {selected && (
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: getLine(selected.lineId).color }}
          >
            {getLine(selected.lineId).name}
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-ink-800 py-1 shadow-2xl ring-1 ring-white/10">
          {results.map((s) => {
            const line = getLine(s.lineId)
            return (
              <li key={s.id}>
                <button
                  onClick={() => {
                    onSelect(s.id)
                    setText(s.name)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-ink-700"
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: line.color }}
                  >
                    {line.name}
                  </span>
                  <span className="text-[14px] font-medium text-white">{s.name}</span>
                  <span className="ml-auto text-[11px] text-slate-500">{line.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
