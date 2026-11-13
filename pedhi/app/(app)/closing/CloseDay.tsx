'use client'
import { useState, useTransition } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import { bookCloseDay } from '@/app/actions'

type B = { id: number; name: string; expected: number; done: { expected: number; counted: number; user: string } | null }
const inr = (n: number) => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (d: string) => `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`

export function CloseDay({ branches, focus, history }: { branches: B[]; focus: number; history: any[] }) {
  const [branchId, setBranchId] = useState(focus)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const b = branches.find((x) => x.id === branchId) ?? branches[0]
  const n = parseInt(counted.replace(/\D/g, ''))
  const diff = Number.isFinite(n) ? n - b.expected : null

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="display text-[30px] font-semibold leading-tight">Close the day</h1>
        <p className="mt-1 text-[14px] text-muted">Count the cash in the drawer and enter it. Pedhi compares it with the books and tells the owner if it doesn’t match.</p>
      </div>
      {branches.length > 1 && (
        <div className="flex rounded-[10px] border border-line-2 bg-card p-0.5 text-[13px] font-semibold">
          {branches.map((x) => <button key={x.id} onClick={() => { setBranchId(x.id); setCounted(''); setErr('') }} className={`flex-1 rounded-[8px] py-1.5 ${x.id === branchId ? 'bg-ink text-paper' : 'text-muted'}`}>{x.name}{x.done ? ' ✓' : ''}</button>)}
        </div>
      )}

      {b.done ? (
        <div className={`card p-5 ${b.done.counted === b.done.expected ? 'bg-leaf-soft/40' : 'bg-amber-soft/40'}`}>
          <div className="flex items-center gap-2 font-semibold"><Check className="size-5 text-leaf" />{b.name} is closed for today</div>
          <p className="mt-1 text-[14px] text-ink-2">Counted {inr(b.done.counted)} against {inr(b.done.expected)} expected{b.done.counted !== b.done.expected ? `, ${b.done.counted < b.done.expected ? 'short' : 'excess'} by ${inr(Math.abs(b.done.counted - b.done.expected))}` : ', exact match'}. Closed by {b.done.user}.</p>
        </div>
      ) : (
        <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); start(async () => {
          setErr('')
          const r = await bookCloseDay(b.id, n, note)
          if (!r.ok) setErr(r.error)
        }) }}>
          <div className="flex items-baseline justify-between rounded-[12px] bg-paper-2 p-4">
            <span className="text-[14px] text-ink-2">Cash that should be in the {b.name} drawer</span>
            <span className="num text-[22px] font-semibold">{inr(b.expected)}</span>
          </div>
          <p className="-mt-2 text-[12px] text-muted">Cash in the box at the start, plus cash bills and cash payments received, minus cash spent and cash deposited in the bank.</p>
          <label className="block text-[14px] font-semibold">Cash you counted
            <div className="relative mt-1.5"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-muted">₹</span>
              <input value={counted ? Number(n).toLocaleString('en-IN') : ''} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))} inputMode="numeric" autoFocus
                className="input num h-14 pl-10 text-[24px] font-semibold" placeholder="0" /></div>
          </label>
          {diff !== null && (
            <p role="status" className={`flex items-center gap-2 rounded-[10px] p-3 text-[14px] font-medium ${diff === 0 ? 'bg-leaf-soft text-leaf' : 'bg-amber-soft text-amber'}`}>
              {diff === 0 ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}
              {diff === 0 ? 'Matches the books exactly.' : `${diff < 0 ? 'Short' : 'Excess'} by ${inr(Math.abs(diff))}. Count again before saving.`}
            </p>
          )}
          {diff !== null && diff !== 0 && <label className="block text-[13px] font-medium">Reason, if you know it<input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1" placeholder="₹500 given to tempo driver, no slip" /></label>}
          {err && <p role="alert" className="rounded-[8px] bg-bahi-soft p-2.5 text-[13px] text-bahi">{err}</p>}
          <button className="btn btn-primary btn-lg w-full" disabled={pending || diff === null}>{pending ? 'Saving…' : 'Close the day'}</button>
          <p className="text-[12px] text-muted">A difference is written to the books under “Cash Shortage & Excess”, so the books always match the drawer.</p>
        </form>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Last 7 days</h2>
          <ul className="card divide-y divide-line">
            {history.map((h, i) => {
              const d = h.counted - h.expected
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
                  <span className="w-14 text-muted num">{day(h.day)}</span>
                  <span className="flex-1">{h.branch}<span className="text-muted"> · {h.user}</span></span>
                  <span className={`num font-medium ${d < -500 ? 'text-bahi' : d !== 0 && Math.abs(d) > 100 ? 'text-amber' : 'text-leaf'}`}>{Math.abs(d) <= 100 ? 'OK' : `${d < 0 ? 'short' : 'excess'} ${inr(Math.abs(d))}`}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
