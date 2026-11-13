'use client'
import { useState, useTransition } from 'react'
import { bookReopen, bookSignOff } from '@/app/actions'

export function SignOff({ defaultUpto, isCa, hasLock }: { defaultUpto: string; isCa: boolean; hasLock: boolean }) {
  const [upto, setUpto] = useState(defaultUpto)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-[12.5px] font-medium text-ink-2">Books correct up to<input type="date" value={upto} onChange={(e) => setUpto(e.target.value)} className="input mt-1 h-9 w-auto" /></label>
      <label className="min-w-[220px] flex-1 text-[12.5px] font-medium text-ink-2">Note<input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1 h-9" placeholder="Reviewed Oct; GSTR-3B filed" /></label>
      <button className="btn btn-primary btn-sm h-9" disabled={pending} onClick={() => start(async () => { const r = await bookSignOff(upto, note); setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error }) })}>Sign off and lock</button>
      {isCa && hasLock && <button className="btn btn-sm h-9" disabled={pending} onClick={() => start(async () => { const r = await bookReopen(); setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error }) })}>Reopen last period</button>}
      {msg && <p role="status" className={`w-full text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p>}
    </div>
  )
}
