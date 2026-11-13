'use client'
import { useState, useTransition } from 'react'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { bookReturnSale } from '@/app/actions'

type Line = { item_id: number; name: string; unit: string; sold: number; returned: number; price: number }
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

/** Customer brings goods back: pick quantities, then credit their account or refund cash/UPI. */
export function ReturnItems({ saleId, lines, hasCustomer, wasCredit }: { saleId: number; lines: Line[]; hasCustomer: boolean; wasCredit: boolean }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<number, number>>({})
  const [refund, setRefund] = useState<'account' | 'cash' | 'upi'>(wasCredit ? 'account' : 'cash')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const left = lines.filter((l) => l.sold > l.returned)
  if (!left.length) return null
  const total = left.reduce((s, l) => s + (qty[l.item_id] ?? 0) * l.price, 0)
  const set = (id: number, n: number, max: number) => setQty({ ...qty, [id]: Math.max(0, Math.min(max, n)) })
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}><RotateCcw className="size-4" />Return items</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Return items" className="card rise max-h-[90dvh] w-full max-w-md overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center"><h2 className="display text-xl font-semibold">Goods returned</h2>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></button></div>
            <ul className="mt-3 divide-y divide-line">
              {left.map((l) => {
                const max = l.sold - l.returned, n = qty[l.item_id] ?? 0
                return (
                  <li key={l.item_id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{l.name}</div><div className="text-[12px] text-muted num">{max} {l.unit} can come back · {inr(l.price)} each</div></div>
                    <div className="flex items-center rounded-[9px] border border-line-2">
                      <button type="button" className="grid size-8 place-items-center" onClick={() => set(l.item_id, n - 1, max)} aria-label="One less"><Minus className="size-3.5" /></button>
                      <span className="num w-8 text-center text-[14px] font-semibold">{n}</span>
                      <button type="button" className="grid size-8 place-items-center" onClick={() => set(l.item_id, n + 1, max)} aria-label="One more"><Plus className="size-3.5" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 text-[13.5px] font-semibold">Give the money back as</div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {([['account', 'Less udhaar'], ['cash', 'Cash'], ['upi', 'UPI']] as const).filter(([k]) => k !== 'account' || hasCustomer).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setRefund(k)} aria-pressed={refund === k} className={`rounded-[10px] border p-2 text-[13px] font-semibold ${refund === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{l}</button>))}
            </div>
            <label className="mt-3 block text-[13px] font-medium">Reason<input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1" placeholder="2 bags damaged in transit" /></label>
            <p className="mt-2 text-[12px] text-muted">Stock goes back to this branch and the GST is reversed. Booked as a Credit Note.</p>
            {msg && <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p>}
            <button className="btn btn-primary mt-3 w-full" disabled={pending || !total} onClick={() => start(async () => {
              const r = await bookReturnSale(saleId, left.map((l) => ({ itemId: l.item_id, qty: qty[l.item_id] ?? 0 })), refund, note)
              setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error })
              if (r.ok) setQty({})
            })}>{pending ? 'Saving…' : `Take back ${inr(total)}`}</button>
          </div>
        </div>
      )}
    </>
  )
}
