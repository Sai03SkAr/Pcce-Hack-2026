'use client'
import { useState, useTransition } from 'react'
import { bookSetOpening } from '@/app/actions'

/** Old dues to a supplier from before Pedhi. */
export function SupplierOld({ supplierId, current }: { supplierId: number; current: number }) {
  const [open, setOpen] = useState(false)
  const [amt, setAmt] = useState(current ? String(current) : '')
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()
  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Old balance</button>
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await bookSetOpening({ supplierId }, parseInt(amt) || 0); setMsg(r.ok ? 'Saved' : r.error); if (r.ok) setOpen(false) }) }}>
      <input autoFocus value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="₹ we owed" aria-label="Old balance we owed" className="input num h-8 w-28 text-[13px]" />
      <button className="btn btn-sm" disabled={pending}>Save</button>
      {msg && <span className="text-[12px] text-bahi">{msg}</span>}
    </form>
  )
}
