'use client'
import { useState, useTransition } from 'react'
import { setBankDate } from '@/app/actions'

export function ClearLine({ id, day, cleared }: { id: number; day: string; cleared?: boolean }) {
  const [date, setDate] = useState(day)
  const [pending, start] = useTransition()
  if (cleared) return <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await setBankDate(id, null) })}>Undo</button>
  return (
    <span className="order-2 flex w-full items-center gap-1.5 sm:order-none sm:w-auto">
      <input type="date" value={date} min={day} onChange={(e) => setDate(e.target.value)} aria-label="Date on bank statement" className="input h-9 min-w-0 flex-1 text-[12.5px] sm:h-8 sm:w-[140px] sm:flex-none" />
      <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await setBankDate(id, date) })}>In bank</button>
    </span>
  )
}
