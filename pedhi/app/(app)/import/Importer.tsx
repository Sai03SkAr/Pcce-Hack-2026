'use client'
import { useState, useTransition } from 'react'
import { Check, FileSpreadsheet, Sparkles, Upload } from 'lucide-react'
import { confirmImport, previewImport } from '@/app/actions'
import type { Mapping, Preview } from '@/lib/importer'

const FIELDS: [keyof Mapping, string][] = [['name', 'Item name'], ['category', 'Category'], ['unit', 'Unit'], ['cost', 'Cost price'], ['price', 'Selling price'], ['qty', 'Stock on hand'], ['gst_rate', 'GST %'], ['hsn', 'HSN']]
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

export function Importer({ branches, defaultBranch, ai }: { branches: { id: number; name: string }[]; defaultBranch: number; ai: boolean }) {
  const [text, setText] = useState('')
  const [branch, setBranch] = useState(defaultBranch)
  const [p, setP] = useState<{ header: string[]; mapping: Mapping; source: string; rows: Preview[] } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const preview = (t: string, mapping?: Mapping) => start(async () => {
    setMsg(null)
    const r = await previewImport(t, mapping)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setP(r.data)
  })
  const load = async (f: File) => { const t = await f.text(); setText(t); preview(t) }
  const remap = (field: keyof Mapping, col: string) => {
    const m = { ...p!.mapping }
    for (const k of Object.keys(m) as (keyof Mapping)[]) if (m[k] === +col) delete m[k]
    if (col === '') delete m[field]; else m[field] = +col
    preview(text, m)
  }
  const good = p?.rows.filter((r) => !r.problem) ?? []

  return (
    <div className="space-y-5">

      {!p ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="card flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-6 text-center transition hover:border-gold"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f) }}>
            <Upload className="size-7 text-gold" /><span className="font-semibold">Drop a .csv file, or click to choose</span>
            <span className="text-[12.5px] text-muted">From Excel: File → Save As → CSV</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
          <div className="card flex flex-col p-4">
            <label htmlFor="paste" className="text-[13px] font-semibold">Or paste cells from Excel / Google Sheets</label>
            <textarea id="paste" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="input mt-2 flex-1 font-mono text-[12px]" placeholder={'Item\tRate\tStock\nACC Cement\t410\t140'} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={pending || !text.trim()} onClick={() => preview(text)}>{pending ? 'Reading…' : 'Read sheet'}</button>
              <button className="btn" disabled={pending} onClick={async () => { const t = await (await fetch('/sample-stock-sheet.csv')).text(); setText(t); preview(t) }}><FileSpreadsheet className="size-4" />Try a messy sample</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Column mapping</h2>
              <span className={`chip ${p.source === 'ai' ? 'chip-green' : 'chip-gold'}`}>{p.source === 'ai' ? <><Sparkles className="size-3" />Mapped by AI</> : p.source === 'manual' ? 'Edited by you' : 'Mapped by header rules'}</span>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setP(null)}>Start over</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIELDS.map(([f, l]) => (
                <label key={f} className="text-[12.5px] font-medium text-ink-2">{l}
                  <select value={p.mapping[f] ?? ''} onChange={(e) => remap(f, e.target.value)} className={`input mt-1 h-9 text-[13px] ${p.mapping[f] === undefined ? 'text-muted' : ''}`}>
                    <option value="">Not in sheet</option>
                    {p.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select></label>
              ))}
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead><tr><th>Item</th><th>Category</th><th>Unit</th><th className="text-right">Cost</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>GST</th><th>Will</th></tr></thead>
              <tbody>{p.rows.map((r, i) => (
                <tr key={i} className={r.problem ? 'opacity-60' : ''}>
                  <td className="font-medium">{r.name || '-'}</td><td className="text-ink-2">{r.category}</td><td className="text-ink-2">{r.unit}</td>
                  <td className="num text-right">{inr(r.cost)}</td><td className="num text-right">{inr(r.price)}</td><td className="num text-right">{r.qty}</td><td className="num">{r.gst_rate}%</td>
                  <td>{r.problem ? <span className="chip chip-red">{r.problem}</span> : r.match ? <span className="chip chip-gold">Update stock</span> : <span className="chip chip-green">New item</span>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <span className="text-[14px]"><b className="num">{good.length}</b> rows ready{p.rows.length - good.length ? <>, <b className="num">{p.rows.length - good.length}</b> skipped</> : ''}. Stock counts will be set for</span>
            <select value={branch} onChange={(e) => setBranch(+e.target.value)} className="input h-9 w-auto">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <button className="btn btn-primary ml-auto" disabled={pending || !good.length} onClick={() => start(async () => {
              const r = await confirmImport(branch, p.rows)
              if (!r.ok) return setMsg({ ok: false, text: r.error })
              setMsg({ ok: true, text: `Done: ${r.data.created} new items, ${r.data.updated} stock counts updated${r.data.skipped ? `, ${r.data.skipped} skipped` : ''}.` })
              setP(null); setText('')
            })}><Check className="size-4" />Import {good.length} rows</button>
          </div>
        </>
      )}
      {msg && <p role="status" className={`rounded-[10px] p-3 text-[14px] ${msg.ok ? 'bg-leaf-soft text-leaf' : 'bg-bahi-soft text-bahi'}`}>{msg.text}</p>}
    </div>
  )
}
