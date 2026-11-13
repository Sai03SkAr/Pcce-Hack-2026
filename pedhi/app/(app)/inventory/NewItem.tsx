'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { PackagePlus, X } from 'lucide-react'
import { bookAddItem } from '@/app/actions'

const RATES = [0, 5, 12, 18, 28]

/** New item: the details a shop actually knows. Stock then arrives through a purchase in Books. */
export function NewItem({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', category: '', unit: 'pc', hsn: '', gst: 18, cost: '', price: '', aliases: '' })
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ id: number; name: string } | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const num = (s: string) => parseInt(s.replace(/\D/g, '')) || 0
  const close = () => { setOpen(false); setDone(null); setErr(''); setF({ name: '', category: '', unit: 'pc', hsn: '', gst: 18, cost: '', price: '', aliases: '' }) }

  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><PackagePlus className="size-3.5" />New item</button>
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label="New item" className="card rise max-h-[90dvh] w-full max-w-md overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="display text-xl font-semibold">{done ? 'Item added' : 'New item'}</h2>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={close} aria-label="Close"><X className="size-4" /></button></div>
        {done ? (
          <div className="mt-3 space-y-3">
            <p className="text-[14px] text-ink-2"><b>{done.name}</b> is in the catalogue with zero stock in every branch. When the goods arrive, record the supplier bill: that adds the stock, the GST credit and what you owe, in one step.</p>
            <div className="flex gap-2"><Link href={`/books/new?a=purchase&item=${done.id}`} className="btn btn-primary">Record the purchase</Link><button className="btn" onClick={close}>Done</button></div>
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
            setErr('')
            const r = await bookAddItem({ name: f.name, category: f.category, unit: f.unit, hsn: f.hsn, gstRate: +f.gst, cost: num(f.cost), price: num(f.price), aliases: f.aliases })
            if (!r.ok) return setErr(r.error)
            setDone(r.data as { id: number; name: string })
          }) }}>
            <label className="block text-[13px] font-medium">Item name<input autoFocus value={f.name} onChange={set('name')} className="input mt-1" placeholder="Asian Paints Apex 10L White" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[13px] font-medium">Category<input value={f.category} onChange={set('category')} list="cats" className="input mt-1" placeholder="Paint" />
                <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
              <label className="block text-[13px] font-medium">Unit<input value={f.unit} onChange={set('unit')} className="input mt-1" placeholder="bag, pc, kg, box" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[13px] font-medium">Selling price (₹, with GST)<input value={f.price} onChange={set('price')} inputMode="numeric" className="input num mt-1" /></label>
              <label className="block text-[13px] font-medium">Purchase price (₹, with GST)<input value={f.cost} onChange={set('cost')} inputMode="numeric" className="input num mt-1" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[13px] font-medium">GST rate<select value={f.gst} onChange={set('gst')} className="input mt-1">{RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></label>
              <label className="block text-[13px] font-medium">HSN code <span className="font-normal text-muted">optional</span><input value={f.hsn} onChange={set('hsn')} inputMode="numeric" maxLength={8} className="input num mt-1" placeholder="3209" /></label>
            </div>
            <label className="block text-[13px] font-medium">Other names people use <span className="font-normal text-muted">comma separated</span>
              <input value={f.aliases} onChange={set('aliases')} className="input mt-1" placeholder="apex white, safed apex" /></label>
            <p className="text-[12px] text-muted">These names let staff bill it by voice or WhatsApp.</p>
            {err && <p role="alert" className="rounded-[8px] bg-bahi-soft p-2.5 text-[13px] text-bahi">{err}</p>}
            <button className="btn btn-primary w-full" disabled={pending || f.name.trim().length < 2 || !num(f.price)}>{pending ? 'Adding…' : 'Add item'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
