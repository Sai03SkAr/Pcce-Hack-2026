'use client'
import { useState, useTransition } from 'react'
import { Check, FileSpreadsheet, Upload } from 'lucide-react'
import { confirmCustomerImport, previewCustomerImport } from '@/app/actions'
import type { CMapping, CPreview } from '@/lib/importer'

const FIELDS: [keyof CMapping, string][] = [['name', 'Name'], ['phone', 'Mobile'], ['balance', 'Old balance (they owe)'], ['gstin', 'GSTIN'], ['limit', 'Udhaar limit'], ['days', 'Credit days']]
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

/** Bring every customer and what they owe from a paper khata, Khatabook, Vyapar or Tally export. */
export function CustomerImporter({ branches, defaultBranch }: { branches: { id: number; name: string }[]; defaultBranch: number }) {
  const [text, setText] = useState('')
  const [branch, setBranch] = useState(defaultBranch)
  const [p, setP] = useState<{ header: string[]; mapping: CMapping; rows: CPreview[] } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const preview = (t: string, m?: CMapping) => start(async () => {
    setMsg(null)
    const r = await previewCustomerImport(t, m)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setP(r.data)
  })
  const remap = (f: keyof CMapping, col: string) => {
    const m = { ...p!.mapping }
    for (const k of Object.keys(m) as (keyof CMapping)[]) if (m[k] === +col) delete m[k]
    if (col === '') delete m[f]; else m[f] = +col
    preview(text, m)
  }
  const good = p?.rows.filter((r) => !r.problem) ?? []
  const due = good.reduce((s, r) => s + r.balance, 0)
  return (
    <div className="space-y-5">
      {!p ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="card flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-6 text-center hover:border-gold">
            <Upload className="size-7 text-gold" /><span className="font-semibold">Choose a .csv of customers</span>
            <span className="text-[12.5px] text-muted">Khatabook: Customers → Download → Excel, then save as CSV. Tally: Sundry Debtors → Export → Excel.</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); preview(t) } }} />
          </label>
          <div className="card flex flex-col p-4">
            <label htmlFor="cpaste" className="text-[13px] font-semibold">Or paste rows from Excel (name, mobile, balance)</label>
            <textarea id="cpaste" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="input mt-2 flex-1 font-mono text-[12px]" placeholder={'Name\tMobile\tBalance\nPai Constructions\t9822012345\t18500'} />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary" disabled={pending || !text.trim()} onClick={() => preview(text)}>Read list</button>
              <button className="btn" disabled={pending} onClick={async () => { const t = await (await fetch('/sample-khata.csv')).text(); setText(t); preview(t) }}><FileSpreadsheet className="size-4" />Try a sample khata</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <div className="flex items-center"><h2 className="font-semibold">Columns</h2><button className="btn btn-ghost btn-sm ml-auto" onClick={() => setP(null)}>Start over</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FIELDS.map(([f, l]) => (
                <label key={f} className="text-[12.5px] font-medium text-ink-2">{l}
                  <select value={p.mapping[f] ?? ''} onChange={(e) => remap(f, e.target.value)} className="input mt-1 h-9 text-[13px]">
                    <option value="">Not in sheet</option>{p.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select></label>
              ))}
            </div>
          </div>
          <ul className="card divide-y divide-line">
            {p.rows.map((r, i) => (
              <li key={i} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13.5px] ${r.problem ? 'opacity-60' : ''}`}>
                <span className="min-w-0 flex-1"><span className="font-semibold">{r.name || '-'}</span> <span className="text-muted num">{r.phone}</span></span>
                <span className="num font-semibold">{r.balance ? inr(r.balance) : '-'}</span>
                {r.problem ? <span className="chip chip-red">{r.problem}</span> : r.match ? <span className="chip chip-gold">Update existing</span> : <span className="chip chip-green">New customer</span>}
              </li>
            ))}
          </ul>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <span className="text-[14px]"><b className="num">{good.length}</b> customers, <b className="num">{inr(due)}</b> of old udhaar, into</span>
            <select value={branch} onChange={(e) => setBranch(+e.target.value)} className="input h-9 w-auto">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <button className="btn btn-primary ml-auto" disabled={pending || !good.length} onClick={() => start(async () => {
              const r = await confirmCustomerImport(branch, p.rows)
              if (!r.ok) return setMsg({ ok: false, text: r.error })
              const d = r.data as { created: number; updated: number; skipped: number }
              setMsg({ ok: true, text: `Done: ${d.created} new customers, ${d.updated} updated${d.skipped ? `, ${d.skipped} skipped` : ''}. Their old balances are in Udhaar.` })
              setP(null); setText('')
            })}><Check className="size-4" />Import {good.length} customers</button>
          </div>
        </>
      )}
      {msg && <p role="status" className={`rounded-[10px] p-3 text-[14px] ${msg.ok ? 'bg-leaf-soft text-leaf' : 'bg-bahi-soft text-bahi'}`}>{msg.text}</p>}
    </div>
  )
}
