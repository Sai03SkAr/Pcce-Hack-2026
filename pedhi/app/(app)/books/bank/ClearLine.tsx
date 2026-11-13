'use client'
import { useState, useTransition } from 'react'
import { setBankDate } from '@/app/actions'

export function ClearLine({ id, day, cleared }: { id: number; day: string; cleared?: boolean }) {
  const [date, setDate] = useState(day)
  const [pending, start] = useTransition()
  if (cleared) return <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await setBankDate(id, null) })}>Undo</button>
  return (
    <span className="flex items-center gap-1.5">
      <input type="date" value={date} min={day} onChange={(e) => setDate(e.target.value)} aria-label="Date on bank statement" className="input h-8 w-[140px] text-[12.5px]" />
      <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await setBankDate(id, date) })}>In bank</button>
    </span>
  )
}
