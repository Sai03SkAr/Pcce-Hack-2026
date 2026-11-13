'use client'
import { useMemo, useState, useTransition } from 'react'
import { ArrowRightLeft, PackagePlus, Pencil, Search, X } from 'lucide-react'
import Link from 'next/link'
import { doAdjust, doTransfer } from '@/app/actions'
import { NewItem } from './NewItem'
import type { StockRow } from '@/lib/metrics'

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const CELL: Record<string, string> = {
  out: 'bg-bahi-soft text-bahi ring-bahi/30', low: 'bg-amber-soft text-amber ring-amber/30', dead: 'bg-paper-2 text-muted ring-line-2', ok: 'bg-card text-ink ring-line',
}
const RANK: Record<string, number> = { out: 0, low: 1, dead: 2, ok: 3 }
const worst = (rs: StockRow[]) => Math.min(...rs.map((r) => RANK[r.status]))
const LABEL: Record<string, string> = { out: 'Out', low: 'Low', dead: 'Not moving', ok: '' }

export function StockGrid({ rows, branches, focus, canManage, myBranch, money, filter: f0 }: {
  rows: StockRow[]; branches: { id: number; name: string }[]; focus: number | null; canManage: boolean; myBranch: number | null; money: boolean; filter: string
}) {
  const [filter, setFilter] = useState(f0)
  const [search, setSearch] = useState('')
  const [openKey, setOpen] = useState<StockRow | null>(null)
  const open = openKey && rows.find((r) => r.item_id === openKey.item_id && r.branch_id === openKey.branch_id) // fresh after each save
  const cols = focus ? branches.filter((b) => b.id === focus) : branches

  const items = useMemo(() => {
    const by = new Map<number, StockRow[]>()
    for (const r of rows) by.set(r.item_id, [...(by.get(r.item_id) ?? []), r])
    return [...by.values()].filter((rs) => {
      const vis = rs.filter((r) => cols.some((c) => c.id === r.branch_id))
      const s = search.toLowerCase()
      return (!s || rs[0].name.toLowerCase().includes(s) || rs[0].category.toLowerCase().includes(s)) && (filter === 'all' || vis.some((r) => r.status === filter))
    }).sort((a, b) => worst(a) - worst(b)) // problems first: out, then low, then not moving
  }, [rows, search, filter, cols])
  const count = (s: string) => rows.filter((r) => r.status === s && cols.some((c) => c.id === r.branch_id)).length
  const value = rows.filter((r) => cols.some((c) => c.id === r.branch_id)).reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><p className="eyebrow">{focus ? cols[0].name : 'All branches, side by side'}</p><h1 className="display text-[30px] font-semibold leading-tight">Stock</h1></div>
        <div className="ml-auto flex flex-wrap items-center gap-3 pb-1">
          {money && <p className="text-[13.5px] text-muted">Stock value at cost <span className="num font-semibold text-ink">{inr(value)}</span></p>}
          {canManage && <NewItem categories={[...new Set(rows.map((r) => r.category))]} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="Search items or category" aria-label="Search stock" /></div>
        {[['all', 'All items', ''], ['out', 'Out of stock', 'chip-red'], ['low', 'Running low', 'chip-amber'], ['dead', 'Not moving 60d', 'chip-grey']].map(([k, l, c]) => (
          <button key={k} onClick={() => setFilter(k)} className={`chip h-8 px-3 text-[13px] ${filter === k ? 'bg-ink text-paper' : c || 'chip-grey'}`}>
            {l}{k !== 'all' && <span className="num opacity-80">{count(k)}</span>}
          </button>
        ))}
      </div>

      {/* Phones: one card per item with a tappable chip per branch */}
      <ul className="space-y-2 md:hidden">
        {items.map((rs) => {
          const it = rs[0]
          return (
            <li key={it.item_id} className="card p-3">
              <div className="text-[14px] font-semibold leading-tight">{it.name}</div>
              <div className="text-[12px] text-muted">{inr(it.price)}/{it.unit}{money ? ` · cost ${inr(it.cost)}` : ''}</div>
              <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((b) => {
                  const r = rs.find((x) => x.branch_id === b.id)
                  if (!r) return <span key={b.id} />
                  return (
                    <button key={b.id} onClick={() => setOpen(r)} className={`flex flex-col items-center rounded-[10px] px-1 py-1.5 ring-1 ${CELL[r.status]}`}>
                      <span className="text-[10.5px] font-medium opacity-75">{b.name}</span>
                      <span className="num text-[14px] font-semibold">{r.qty}</span>
                      <span className="text-[10.5px] num opacity-85">{LABEL[r.status] || (r.cover_days !== null ? `${Math.round(r.cover_days)}d` : '-')}</span>
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
        {!items.length && <li className="card py-10 text-center text-muted">Nothing here.</li>}
      </ul>

      <div className="card hidden overflow-x-auto md:block">
        <table className="table min-w-[640px]">
          <thead><tr><th>Item</th>{cols.map((b) => <th key={b.id} className="text-center">{b.name}</th>)}<th className="text-right">Sells / day</th></tr></thead>
          <tbody>
            {items.map((rs) => {
              const it = rs[0]
              const daily = rs.filter((r) => cols.some((c) => c.id === r.branch_id)).reduce((s, r) => s + r.avg_daily, 0)
              return (
                <tr key={it.item_id}>
                  <td><div className="font-semibold leading-tight">{it.name}</div><div className="text-[12px] text-muted">{it.category} · {inr(it.price)}/{it.unit}{money ? ` · cost ${inr(it.cost)}` : ''}</div></td>
                  {cols.map((b) => {
                    const r = rs.find((x) => x.branch_id === b.id)
                    if (!r) return <td key={b.id} className="text-center text-muted">-</td>
                    return (
                      <td key={b.id} className="text-center">
                        <button onClick={() => setOpen(r)} className={`mx-auto flex w-[104px] flex-col items-center rounded-[10px] px-2 py-1.5 ring-1 transition hover:ring-2 ${CELL[r.status]}`}>
                          <span className="num text-[15px] font-semibold">{r.qty} <span className="text-[11px] font-normal opacity-75">{r.unit}</span></span>
                          <span className="text-[11px] num opacity-85">{LABEL[r.status] || (r.cover_days !== null ? `${Math.round(r.cover_days)} days` : '-')}</span>
                        </button>
                      </td>
                    )
                  })}
                  <td className="num text-right text-ink-2">{daily ? daily.toFixed(1) : '-'}</td>
                </tr>
              )
            })}
            {!items.length && <tr><td colSpan={cols.length + 2} className="py-10 text-center text-muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-muted">Days = how long the stock lasts at the last 28 days’ rate of sale. Low = runs out before the supplier can deliver.</p>
      {open && <StockPanel row={open} all={rows.filter((r) => r.item_id === open.item_id)} branches={branches}
        canManage={canManage && (!myBranch || myBranch === open.branch_id)} canPurchase={!myBranch || myBranch === open.branch_id} onClose={() => setOpen(null)} />}
    </div>
  )
}

function StockPanel({ row, all, branches, canManage, canPurchase, onClose }: {
  row: StockRow; all: StockRow[]; branches: { id: number; name: string }[]; canManage: boolean; canPurchase: boolean; onClose: () => void
}) {
  const [tab, setTab] = useState<'purchase' | 'transfer' | 'adjust'>(canPurchase ? 'purchase' : 'transfer')
  const donor = all.filter((r) => r.branch_id !== row.branch_id).sort((a, b) => b.qty - a.qty)[0]
  const [qty, setQty] = useState(String(Math.max(1, Math.ceil(row.avg_daily * 14) - row.qty)))
  const [from, setFrom] = useState(donor?.branch_id ?? 0)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const n = parseInt(qty)
  const submit = () => start(async () => {
    const r = tab === 'transfer' ? await doTransfer(row.item_id, from, row.branch_id, n)
      : await doAdjust(row.item_id, row.branch_id, n, reason)
    setMsg(r.ok ? { ok: true, text: r.message ?? 'Saved.' } : { ok: false, text: r.error })
  })
  const tabs = [canPurchase && ['purchase', 'Stock received', PackagePlus], canManage && ['transfer', 'Transfer in', ArrowRightLeft], canManage && ['adjust', 'Correct count', Pencil]].filter(Boolean) as [typeof tab, string, typeof X][]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px]" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={row.name} className="h-full w-full max-w-md overflow-auto bg-card p-5 shadow-[var(--shadow-lg)] rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2"><div><p className="eyebrow">{row.branch}</p><h2 className="display text-[22px] font-semibold leading-tight">{row.name}</h2></div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="Close"><X className="size-4" /></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[['In stock', `${row.qty} ${row.unit}`], ['Sells / day', row.avg_daily.toFixed(1)], ['Lasts', row.cover_days !== null ? `${Math.round(row.cover_days)} days` : '-']].map(([l, v]) => (
            <div key={l} className="rounded-[10px] bg-paper-2 p-2.5"><div className="text-[11.5px] text-muted">{l}</div><div className="num font-semibold">{v}</div></div>))}
        </div>
        <h3 className="eyebrow mt-5">Other branches</h3>
        <ul className="mt-2 space-y-1 text-[13.5px]">{all.filter((r) => r.branch_id !== row.branch_id).map((r) => (
          <li key={r.branch_id} className="flex"><span>{r.branch}</span><span className="num ml-auto">{r.qty} {r.unit} {r.cover_days !== null && <span className="text-muted">· {Math.round(r.cover_days)} days</span>}</span></li>))}</ul>

        {tabs.length > 0 ? (
          <div className="mt-6">
            <div className="flex gap-1 rounded-[10px] bg-paper-2 p-1">{tabs.map(([k, l, I]) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null); if (k === 'adjust') setQty('') }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] py-1.5 text-[12.5px] font-semibold ${tab === k ? 'bg-card shadow-[var(--shadow)]' : 'text-muted'}`}><I className="size-3.5" />{l}</button>))}</div>
            <div className="mt-4 space-y-3">
              {tab === 'transfer' && (
                <label className="block text-[13px] font-medium">From
                  <select value={from} onChange={(e) => setFrom(+e.target.value)} className="input mt-1">
                    {all.filter((r) => r.branch_id !== row.branch_id).map((r) => <option key={r.branch_id} value={r.branch_id}>{branches.find((b) => b.id === r.branch_id)?.name} ({r.qty} {r.unit})</option>)}
                  </select></label>
              )}
              <label className="block text-[13px] font-medium">{tab === 'adjust' ? 'Change (+ found, − damaged or missing)' : `Quantity (${row.unit})`}
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="input num mt-1" placeholder={tab === 'adjust' ? '-2' : ''} /></label>
              {tab === 'adjust' && <label className="block text-[13px] font-medium">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1" placeholder="2 bags torn in the rain" /></label>}
              {tab === 'purchase'
                ? <Link href={`/books/new?a=purchase&item=${row.item_id}&branch=${row.branch_id}&qty=${n || 1}`} className="btn btn-primary w-full">Record the supplier bill for {n || ''} {row.unit}</Link>
                : <button onClick={submit} disabled={pending || !n} className="btn btn-primary w-full">{pending ? 'Saving…' : tab === 'transfer' ? `Move ${n || ''} ${row.unit} to ${row.branch}` : 'Save correction'}</button>}
              {tab === 'purchase' && <p className="text-[12.5px] text-muted">Stock that arrives with a bill is a purchase: it adds the stock, the GST credit and what you owe the supplier, in one step.</p>}
              {msg && <p role="status" className={`text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p>}
            </div>
          </div>
        ) : <p className="mt-6 text-[13px] text-muted">You can only change stock in your own branch.</p>}
      </aside>
    </div>
  )
}
