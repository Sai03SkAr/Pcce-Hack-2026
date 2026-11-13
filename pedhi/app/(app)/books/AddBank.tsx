'use client'
import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { bookAddBank } from '@/app/actions'

export function AddBank() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [opening, setOpening] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />Bank account</button>
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setOpen(false)}>
      <form role="dialog" aria-modal="true" aria-label="Add a bank account" className="card rise w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await bookAddBank(name, parseInt(opening) || 0); if (r.ok) { setOpen(false); setName(''); setOpening('') } else setErr(r.error) }) }}>
        <div className="flex items-center"><h2 className="display text-xl font-semibold">Add a bank account</h2><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></button></div>
        <label className="block text-[13px] font-medium">Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Axis Bank - Current" /></label>
        <label className="block text-[13px] font-medium">Money in it today (₹)<input value={opening} onChange={(e) => setOpening(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1" placeholder="0" /></label>
        <p className="text-[12px] text-muted">Pedhi files it under Bank Accounts and treats today’s balance as money the owner brought in (Capital).</p>
        {err && <p role="alert" className="text-[13px] text-bahi">{err}</p>}
        <button className="btn btn-primary w-full" disabled={pending || name.trim().length < 3}>Add account</button>
      </form>
    </div>
  )
}
