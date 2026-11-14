'use client'
import Link from 'next/link'
import { useMemo, useRef, useState, useTransition } from 'react'
import { Banknote, Check, CreditCard, Minus, Plus, Search, Smartphone, Trash2, Wand2, X } from 'lucide-react'
import { createSale, quickParse } from '@/app/actions'
import { Mic } from '@/components/Mic'
import { NewCustomerDialog } from '@/components/NewCustomer'

type Item = { id: number; name: string; aliases: string; category: string; unit: string; price: number; gst_rate: number; branch_id: number; qty: number; pop: number }
type Cust = { id: number; name: string; branch_id: number; owes: number; limit: number; oldest: number }
type Line = { itemId: number; qty: number; price: number }
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const MODES = [
  { k: 'cash', label: 'Cash', icon: Banknote },
  { k: 'upi', label: 'UPI', icon: Smartphone },
  { k: 'credit', label: 'Udhaar', icon: CreditCard },
] as const

export function BillForm({ branches, defaultBranch, items, customers, canEditPrice, isFamily }: {
  branches: { id: number; name: string }[]; defaultBranch: number; items: Item[]; customers: Cust[]; canEditPrice: boolean; isFamily: boolean
}) {
  const [branch, setBranch] = useState(defaultBranch)
  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')
  const [custId, setCustId] = useState<number | null>(null)
  const [custQ, setCustQ] = useState('')
  const [custList, setCustList] = useState(customers)
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'cash' | 'upi' | 'credit'>('cash')
  const [quick, setQuick] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ id: number; total: number } | null>(null)
  const [pending, start] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  // examples built from this business's own items, so a pharmacy isn't shown cement
  const ex = items[0]
  const example = ex ? `Ramesh ko 2 ${ex.unit} ${ex.name.toLowerCase()} udhaar` : 'Add items under Stock first'
  const searchHint = [...new Set(items.map((i) => i.name.split(' ')[0].toLowerCase()))].slice(0, 4).join(', ') || 'item name'

  const stock = useMemo(() => items.filter((i) => i.branch_id === branch), [items, branch])
  const byId = (id: number) => stock.find((i) => i.id === id)!
  const results = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return stock.slice(0, 12)
    return stock.filter((i) => i.name.toLowerCase().includes(s) || i.aliases.split(',').some((a) => a.includes(s))).slice(0, 12)
  }, [search, stock])
  const custs = custList.filter((c) => c.branch_id === branch || isFamily)
  const custMatches = custQ ? custs.filter((c) => c.name.toLowerCase().includes(custQ.toLowerCase())).slice(0, 6) : []
  const cust = custList.find((c) => c.id === custId)

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const gst = lines.reduce((s, l) => { const r = byId(l.itemId)?.gst_rate ?? 18; return s + (l.qty * l.price * r) / (100 + r) }, 0)
  const overLimit = mode === 'credit' && cust && cust.owes + total > cust.limit

  const add = (id: number, qty = 1) => {
    const it = byId(id)
    if (!it) return
    setLines((ls) => ls.some((l) => l.itemId === id) ? ls.map((l) => (l.itemId === id ? { ...l, qty: l.qty + qty } : l)) : [...ls, { itemId: id, qty, price: it.price }])
    setSearch('')
    setError('')
  }
  const setQty = (id: number, qty: number) => setLines((ls) => ls.map((l) => (l.itemId === id ? { ...l, qty: Math.max(1, qty || 1) } : l)))

  const fill = (text: string) => {
    setQuick(text)
    start(async () => {
      const p = await quickParse(text)
      if (!p.lines.length && !p.customerId) return setError(`Could not find any items in that. Try “${example}”.`)
      setLines(p.lines.filter((l) => byId(l.itemId)).map((l) => ({ itemId: l.itemId, qty: l.qty, price: byId(l.itemId).price })))
      if (p.customerId) { setCustId(p.customerId); setCustQ('') }
      if (p.mode) setMode(p.mode)
      setError('')
    })
  }

  const save = () => start(async () => {
    setError('')
    const r = await createSale({ branchId: branch, customerId: custId, mode, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, price: l.price })) })
    if (!r.ok) return setError(r.error)
    setDone(r.data)
  })
  const reset = () => { setDone(null); setLines([]); setCustId(null); setMode('cash'); setQuick(''); searchRef.current?.focus() }

  if (done) return (
    <div className="mx-auto max-w-md pt-10 text-center rise">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-leaf-soft text-leaf"><Check className="size-8" strokeWidth={2.5} /></div>
      <h1 className="display mt-4 text-3xl font-semibold">Bill saved</h1>
      <p className="num mt-1 text-2xl font-semibold">{inr(done.total)}</p>
      <p className="mt-2 text-muted">Stock{mode === 'credit' ? ', udhaar' : ''} and today's sales are already updated on the owner's dashboard.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href={`/sales/${done.id}`} className="btn">View invoice</Link>
        <button onClick={reset} className="btn btn-primary" autoFocus>New bill</button>
      </div>
    </div>
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="display text-[30px] font-semibold leading-tight">New bill</h1>
          {branches.length > 1 && (
            <div className="ml-auto flex rounded-[10px] border border-line-2 bg-card p-0.5">
              {branches.map((b) => <button key={b.id} onClick={() => { setBranch(b.id); setLines([]) }} className={`h-8 rounded-[8px] px-3 text-[13px] font-semibold ${branch === b.id ? 'bg-ink text-paper' : 'text-muted'}`}>{b.name}</button>)}
            </div>
          )}
        </div>

        <div className="card p-3">
          <label htmlFor="quick" className="flex items-center gap-1.5 px-1 text-[12.5px] font-semibold text-ink-2"><Wand2 className="size-3.5 text-gold" />Say or type the whole bill</label>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (quick.trim()) fill(quick) }}>
            <input id="quick" value={quick} onChange={(e) => setQuick(e.target.value)} className="input" placeholder={example} />
            <Mic onText={fill} lang="hi-IN" />
            <button className="btn" disabled={pending || !quick.trim()}>Fill</button>
          </form>
        </div>

        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input ref={searchRef} autoFocus value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search items"
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); add(results[0].id) } }}
              className="input h-11 pl-9 text-[15px]" placeholder={`Search items: ${searchHint}…  (Enter adds the first)`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {results.map((i) => (
              <button key={i.id} onClick={() => add(i.id)} disabled={i.qty <= 0}
                className="card group p-3 text-left transition hover:border-gold hover:shadow-[var(--shadow-lg)] disabled:opacity-50 disabled:hover:border-line">
                <div className="line-clamp-2 min-h-[2.5em] text-[13.5px] font-semibold leading-tight">{i.name}</div>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="num text-[14px] font-semibold">{inr(i.price)}<span className="text-[11px] font-normal text-muted">/{i.unit}</span></span>
                  <span className={`text-[11.5px] num ${i.qty <= 0 ? 'text-bahi font-semibold' : 'text-muted'}`}>{i.qty <= 0 ? 'Out of stock' : `${i.qty} left`}</span>
                </div>
              </button>
            ))}
            {!results.length && <p className="col-span-full py-6 text-center text-muted">No item matches “{search}”.</p>}
          </div>
        </div>
      </section>

      {lines.length > 0 && (
        <button onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="fixed inset-x-3 bottom-[76px] z-30 flex items-center gap-3 rounded-[14px] bg-ink px-4 py-3 text-paper shadow-[var(--shadow-lg)] lg:hidden">
          <span className="text-[13.5px]">{lines.length} {lines.length === 1 ? 'item' : 'items'}{cust ? ` · ${cust.name.split(' ')[0]}` : ''}</span>
          <span className="num ml-auto text-[17px] font-semibold">{inr(total)}</span>
          <span className="rounded-full bg-bahi px-3 py-1 text-[13px] font-semibold text-[#fff6e6]">Review</span>
        </button>
      )}
      <aside id="cart" className="scroll-mt-20 pb-16 lg:sticky lg:top-20 lg:self-start lg:pb-0">
        <div className="card overflow-hidden">
          <div className="border-b border-line p-4">
            <label htmlFor="cust" className="eyebrow">Customer</label>
            {cust ? (
              <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-paper-2 p-2.5">
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{cust.name}</div>
                  <div className={`text-[12.5px] num ${cust.owes > cust.limit * 0.8 ? 'text-bahi' : 'text-muted'}`}>Owes {inr(cust.owes)} · limit {inr(cust.limit)}{cust.oldest > 30 ? ` · ${cust.oldest} days old` : ''}</div></div>
                <button className="btn btn-ghost btn-sm" onClick={() => setCustId(null)} aria-label="Remove customer"><X className="size-4" /></button>
              </div>
            ) : (
              <div className="relative mt-2">
                <input id="cust" value={custQ} onChange={(e) => setCustQ(e.target.value)} className="input" placeholder="Walk-in, or search a customer" />
                {custQ.trim().length > 1 && (
                  <ul className="card absolute inset-x-0 top-11 z-10 overflow-hidden p-1 shadow-[var(--shadow-lg)]">
                    {custMatches.map((c) => <li key={c.id}><button onClick={() => { setCustId(c.id); setCustQ('') }} className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-[13.5px] hover:bg-paper-2">
                      <span className="truncate">{c.name}</span>{c.owes > 0 && <span className="ml-auto pl-2 text-[12px] text-muted num">owes {inr(c.owes)}</span>}</button></li>)}
                    <li><button onClick={() => setAdding(true)} className="flex w-full items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] font-semibold text-bahi hover:bg-paper-2">
                      <Plus className="size-4" />Add “{custQ.trim()}” as a new customer</button></li>
                  </ul>
                )}
                {adding && <NewCustomerDialog initialName={custQ.trim()} branches={branches} defaultBranch={branch} canSetLimit={canEditPrice}
                  onClose={() => setAdding(false)}
                  onCreated={(c) => { setCustList((l) => [...l, { id: c.id, name: c.name, branch_id: c.branch_id, owes: 0, limit: c.credit_limit, oldest: 0 }]); setCustId(c.id); setCustQ(''); setAdding(false) }} />}
              </div>
            )}
          </div>

          <ul className="max-h-[38dvh] divide-y divide-line overflow-auto">
            {lines.map((l) => {
              const it = byId(l.itemId)
              return (
                <li key={l.itemId} className="p-3.5">
                  <div className="flex items-start gap-2"><span className="flex-1 text-[13.5px] font-semibold leading-tight">{it.name}</span>
                    <button onClick={() => setLines((ls) => ls.filter((x) => x.itemId !== l.itemId))} className="text-muted hover:text-bahi" aria-label={`Remove ${it.name}`}><Trash2 className="size-4" /></button></div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-[9px] border border-line-2">
                      <button className="grid size-8 place-items-center" onClick={() => setQty(l.itemId, l.qty - 1)} aria-label="One less"><Minus className="size-3.5" /></button>
                      <input value={l.qty} onChange={(e) => setQty(l.itemId, parseInt(e.target.value))} inputMode="numeric" aria-label="Quantity" className="num h-8 w-12 bg-transparent text-center text-[14px] font-semibold outline-none" />
                      <button className="grid size-8 place-items-center" onClick={() => setQty(l.itemId, l.qty + 1)} aria-label="One more"><Plus className="size-3.5" /></button>
                    </div>
                    <span className="text-[12px] text-muted">{it.unit} ×</span>
                    {canEditPrice
                      ? <input value={l.price} onChange={(e) => setLines((ls) => ls.map((x) => (x.itemId === l.itemId ? { ...x, price: +e.target.value || 0 } : x)))} inputMode="numeric" aria-label="Rate" className="input num h-8 w-20 px-2 text-[13px]" />
                      : <span className="num text-[13px]">{inr(l.price)}</span>}
                    <span className="num ml-auto text-[14px] font-semibold">{inr(l.qty * l.price)}</span>
                  </div>
                  {l.qty > it.qty && <p className="mt-1 text-[12px] text-bahi">Only {it.qty} {it.unit} in stock here.</p>}
                </li>
              )
            })}
            {!lines.length && <li className="p-8 text-center text-[13.5px] text-muted">Tap items or type a bill above.</li>}
          </ul>

          <div className="space-y-3 border-t border-line bg-paper-2/50 p-4">
            <div className="grid grid-cols-3 gap-1.5">
              {MODES.map((m) => (
                <button key={m.k} onClick={() => setMode(m.k)} aria-pressed={mode === m.k}
                  className={`flex h-11 flex-col items-center justify-center rounded-[10px] border text-[12.5px] font-semibold transition ${mode === m.k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card text-ink-2 hover:border-ink-2'}`}>
                  <m.icon className="size-4" />{m.label}
                </button>
              ))}
            </div>
            {mode === 'credit' && !cust && <p className="text-[12.5px] text-amber">Pick a customer for udhaar.</p>}
            {overLimit && <p className="text-[12.5px] text-bahi">This takes {cust!.name} to {inr(cust!.owes + total)}, over the {inr(cust!.limit)} limit. {isFamily ? 'You can approve it; it will be noted in the activity log.' : 'It needs the owner’s approval.'}</p>}
            <div className="flex items-end justify-between">
              <div className="text-[12px] text-muted num">incl. GST {inr(gst)}</div>
              <div className="num text-[28px] font-semibold leading-none tracking-tight">{inr(total)}</div>
            </div>
            {error && <p role="alert" className="rounded-[8px] bg-bahi-soft p-2.5 text-[13px] text-bahi">{error}</p>}
            <button onClick={save} disabled={pending || !lines.length || (mode === 'credit' && !cust)} className="btn btn-primary btn-lg w-full">
              {pending ? 'Saving…' : `Save bill · ${inr(total)}`}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
