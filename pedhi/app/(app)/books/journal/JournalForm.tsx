'use client'
import { useState, useTransition } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { bookCreateLedger, bookJournal } from '@/app/actions'
import { VoucherView, type VoucherRow } from '@/components/VoucherView'

type Led = { id: number; name: string; grp: string }
type Row = { ledgerId: number | ''; dr: string; cr: string }
const num = (s: string) => parseInt(s.replace(/\D/g, '')) || 0
const inr = (n: number) => '₹' + n.toLocaleString('en-IN')

// Common entries a shop owner or CA needs, prefilled by ledger name (the first matching ledger is picked).
const TEMPLATES: { label: string; narration: string; rows: [string, 'dr' | 'cr'][] }[] = [
  { label: 'Bought equipment or furniture', narration: 'Bought a computer for the Margao counter', rows: [['Computers & Equipment', 'dr'], ['HDFC Bank - Current', 'cr']] },
  { label: 'Loan received', narration: 'Business loan received in bank', rows: [['HDFC Bank - Current', 'dr'], ['', 'cr']] },
  { label: 'Loan EMI paid', narration: 'Loan EMI for the month', rows: [['', 'dr'], ['Interest Paid', 'dr'], ['HDFC Bank - Current', 'cr']] },
  { label: 'Depreciation', narration: 'Depreciation for the year', rows: [['Depreciation', 'dr'], ['Computers & Equipment', 'cr']] },
  { label: 'Blank entry', narration: '', rows: [['', 'dr'], ['', 'cr']] },
]

export function JournalForm({ ledgers: l0, groups, today }: { ledgers: Led[]; groups: string[]; today: string }) {
  const [ledgers, setLedgers] = useState(l0)
  const [day, setDay] = useState(today)
  const [narration, setNarration] = useState('')
  const [rows, setRows] = useState<Row[]>([{ ledgerId: '', dr: '', cr: '' }, { ledgerId: '', dr: '', cr: '' }])
  const [newLed, setNewLed] = useState<{ name: string; grp: string } | null>(null)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<VoucherRow | null>(null)
  const [pending, start] = useTransition()
  const dr = rows.reduce((s, r) => s + num(r.dr), 0), cr = rows.reduce((s, r) => s + num(r.cr), 0)
  const byGroup = [...new Set(ledgers.map((l) => l.grp))]
  const setRow = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const use = (t: (typeof TEMPLATES)[number]) => {
    setNarration(t.narration)
    setRows(t.rows.map(([name]) => ({ ledgerId: ledgers.find((l) => l.name === name)?.id ?? '', dr: '', cr: '' })))
    setErr(''); setDone(null)
  }

  if (done) return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="display text-[26px] font-semibold">Entry saved</h1>
      <VoucherView v={done} />
      <button className="btn btn-primary" onClick={() => { setDone(null); setRows([{ ledgerId: '', dr: '', cr: '' }, { ledgerId: '', dr: '', cr: '' }]); setNarration('') }}>Another entry</button>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="display text-[26px] font-semibold">Advanced entry</h1>
        <p className="text-[13.5px] text-muted">For things that are not a sale, purchase, payment or receipt: equipment, loans, depreciation, corrections. Each line is a debit or a credit, and both totals must match. This is Tally’s Journal; your CA will recognise it.</p></div>
      <div className="flex flex-wrap gap-1.5">{TEMPLATES.map((t) => <button key={t.label} onClick={() => use(t)} className="rounded-full border border-line-2 bg-card px-3 py-1.5 text-[13px] hover:border-gold">{t.label}</button>)}</div>

      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <label className="text-[13px] font-medium">Date<input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="input mt-1" /></label>
          <label className="text-[13px] font-medium">What is this for?<input value={narration} onChange={(e) => setNarration(e.target.value)} className="input mt-1" placeholder="Bought a computer for the Margao counter" /></label>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_120px_120px_32px] gap-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted sm:grid"><span>Ledger</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span /></div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-[10px] border border-line p-2 sm:grid-cols-[1fr_120px_120px_32px] sm:border-0 sm:p-0">
              <select value={r.ledgerId} onChange={(e) => setRow(i, { ledgerId: e.target.value ? +e.target.value : '' })} className="input col-span-2 sm:col-span-1" aria-label="Ledger">
                <option value="">Pick a ledger…</option>
                {byGroup.map((g) => <optgroup key={g} label={g}>{ledgers.filter((l) => l.grp === g).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>)}
              </select>
              <input value={r.dr} onChange={(e) => setRow(i, { dr: e.target.value.replace(/\D/g, ''), cr: '' })} inputMode="numeric" className="input num text-right" placeholder="Debit" aria-label="Debit" />
              <input value={r.cr} onChange={(e) => setRow(i, { cr: e.target.value.replace(/\D/g, ''), dr: '' })} inputMode="numeric" className="input num text-right" placeholder="Credit" aria-label="Credit" />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length <= 2} className="text-muted hover:text-bahi disabled:opacity-30" aria-label="Remove line"><Trash2 className="mx-auto size-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-sm" onClick={() => setRows([...rows, { ledgerId: '', dr: '', cr: '' }])}><Plus className="size-3.5" />Line</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewLed({ name: '', grp: groups[0] })}><Plus className="size-3.5" />New ledger</button>
            <span className={`ml-auto text-[13.5px] num ${dr === cr && dr ? 'text-leaf' : 'text-muted'}`}>Debit {inr(dr)} · Credit {inr(cr)}{dr !== cr ? ` · difference ${inr(Math.abs(dr - cr))}` : ''}</span>
          </div>
        </div>
        {err && <p role="alert" className="rounded-[8px] bg-bahi-soft p-2.5 text-[13px] text-bahi">{err}</p>}
        <button className="btn btn-primary btn-lg w-full" disabled={pending || !dr || dr !== cr} onClick={() => start(async () => {
          setErr('')
          const r = await bookJournal({ day, narration, lines: rows.filter((x) => x.ledgerId).map((x) => ({ ledgerId: +x.ledgerId, dr: num(x.dr), cr: num(x.cr) })) })
          if (!r.ok) return setErr(r.error)
          setDone(r.data as VoucherRow)
        })}>{pending ? 'Saving…' : 'Save entry'}</button>
      </div>

      {newLed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setNewLed(null)}>
          <form role="dialog" aria-modal="true" aria-label="New ledger" className="card rise w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); start(async () => {
              const r = await bookCreateLedger(newLed.name, newLed.grp)
              if (!r.ok) return setErr(r.error)
              const l = r.data as Led
              setLedgers([...ledgers, l]); setNewLed(null)
            }) }}>
            <div className="flex items-center"><h2 className="display text-xl font-semibold">New ledger</h2><button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setNewLed(null)} aria-label="Close"><X className="size-4" /></button></div>
            <label className="block text-[13px] font-medium">Name<input autoFocus value={newLed.name} onChange={(e) => setNewLed({ ...newLed, name: e.target.value })} className="input mt-1" placeholder="Business loan - SBI" /></label>
            <label className="block text-[13px] font-medium">Under (Tally group)<select value={newLed.grp} onChange={(e) => setNewLed({ ...newLed, grp: e.target.value })} className="input mt-1">{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
            <p className="text-[12px] text-muted">Loans you took go under Loans (Liability). Things you own for years (computer, vehicle) go under Fixed Assets.</p>
            <button className="btn btn-primary w-full" disabled={pending || newLed.name.trim().length < 3}>Create ledger</button>
          </form>
        </div>
      )}
    </div>
  )
}
