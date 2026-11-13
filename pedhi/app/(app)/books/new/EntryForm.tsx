'use client'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Check, Home, Landmark, PackagePlus, Plus, Search, Trash2, Truck, Undo2, Wallet } from 'lucide-react'
import { bookAddSupplier, bookExpense, bookMove, bookOwner, bookPaySupplier, bookPurchase, bookReceipt, bookReturnPurchase } from '@/app/actions'
import { VoucherView, type VoucherRow } from '@/components/VoucherView'

type Acc = { id: number; name: string; bank: boolean; branch_id: number | null; balance: number }
type Party = { id: number; name: string; owes: number; state?: string }
type Item = { id: number; name: string; aliases: string; unit: string; cost: number; gst_rate: number }
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const num = (s: string) => parseInt(s.replace(/[^\d]/g, '')) || 0

const KINDS = [
  { a: 'receipt', label: 'Money came in', icon: ArrowDownLeft },
  { a: 'purchase', label: 'Bought stock', icon: PackagePlus },
  { a: 'supplier', label: 'Paid a supplier', icon: Truck },
  { a: 'expense', label: 'Paid an expense', icon: ArrowUpRight },
  { a: 'move', label: 'Moved money', icon: ArrowLeftRight },
  { a: 'owner', label: 'Owner money', icon: Home },
  { a: 'preturn', label: 'Returned to supplier', icon: Undo2 },
] as const

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 text-[13.5px] font-semibold">{label}{hint && <span className="ml-2 font-normal text-muted">{hint}</span>}</div>{children}</div>
}

function AccountPicker({ accounts, value, onChange, exclude }: { accounts: Acc[]; value?: number; onChange: (id: number) => void; exclude?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {accounts.filter((a) => a.id !== exclude).map((a) => (
        <button type="button" key={a.id} onClick={() => onChange(a.id)} aria-pressed={value === a.id}
          className={`flex items-center gap-2 rounded-[11px] border p-2.5 text-left transition ${value === a.id ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card hover:border-ink-2'}`}>
          {a.bank ? <Landmark className="size-4 shrink-0" /> : <Wallet className="size-4 shrink-0" />}
          <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{a.name}</span><span className={`block text-[11.5px] num ${value === a.id ? 'text-paper/70' : 'text-muted'}`}>{inr(a.balance)}</span></span>
        </button>
      ))}
    </div>
  )
}

function PartyPicker({ parties, value, onChange, owesLabel, placeholder }: { parties: Party[]; value?: number; onChange: (id: number | undefined) => void; owesLabel: string; placeholder: string }) {
  const [q, setQ] = useState('')
  const picked = parties.find((p) => p.id === value)
  if (picked) return (
    <div className="flex items-center gap-2 rounded-[11px] bg-paper-2 p-3">
      <div className="flex-1"><div className="font-semibold">{picked.name}</div><div className="text-[12.5px] text-muted num">{picked.owes > 0 ? `${owesLabel} ${inr(picked.owes)}` : 'Nothing pending'}{picked.state && picked.state !== 'Goa' ? ` · ${picked.state} (IGST)` : ''}</div></div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}>Change</button>
    </div>
  )
  const list = parties.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.owes - a.owes).slice(0, 8)
  return (
    <div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input h-11 pl-9" placeholder={placeholder} aria-label={placeholder} /></div>
      <div className="mt-2 flex flex-wrap gap-1.5">{list.map((p) => (
        <button type="button" key={p.id} onClick={() => onChange(p.id)} className="rounded-full border border-line-2 bg-card px-3 py-1.5 text-[13px] hover:border-gold">
          {p.name}{p.owes > 0 && <span className="ml-1.5 text-muted num">{inr(p.owes)}</span>}</button>))}</div>
    </div>
  )
}

function Amount({ value, onChange, label = 'How much?' }: { value: string; onChange: (s: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-muted">₹</span>
        <input value={value ? Number(num(value)).toLocaleString('en-IN') : ''} onChange={(e) => onChange(String(num(e.target.value)))} inputMode="numeric"
          className="input num h-14 pl-10 text-[24px] font-semibold" placeholder="0" aria-label={label} /></div>
    </Field>
  )
}

export function EntryForm(props: {
  action: string; draft: any; pre: { item?: number; branch?: number; qty?: number }
  accounts: Acc[]; customers: Party[]; suppliers: Party[]; items: Item[]; branches: { id: number; name: string }[]
  defaultBranch: number; expenses: { id: number; name: string; grp: string }[]; isFamily: boolean
}) {
  const d = props.draft ?? {}
  const [a, setA] = useState<string>(props.action)
  const [amount, setAmount] = useState(d.amount ? String(d.amount) : '')
  const [acc, setAcc] = useState<number | undefined>(d.accountId ?? d.fromId)
  const [acc2, setAcc2] = useState<number | undefined>(d.toId)
  const [cust, setCust] = useState<number | undefined>(d.customerId)
  const [sup, setSup] = useState<number | undefined>(d.supplierId)
  const [exp, setExp] = useState<number | undefined>(d.ledgerId)
  const [gst, setGst] = useState<number>(d.gstRate ?? 0)
  const [note, setNote] = useState('')
  const [dir, setDir] = useState<'take' | 'add'>(d.dir ?? 'take')
  const [mode, setMode] = useState<'credit' | 'paid'>(d.mode ?? 'credit')
  const [billNo, setBillNo] = useState('')
  const [branch, setBranch] = useState(props.pre.branch ?? props.defaultBranch)
  const [lines, setLines] = useState<{ itemId: number; qty: number; rate: number }[]>(
    d.lines ?? (props.pre.item ? [{ itemId: props.pre.item, qty: props.pre.qty ?? 1, rate: props.items.find((i) => i.id === props.pre.item)?.cost ?? 0 }] : []))
  const [search, setSearch] = useState('')
  const [newSup, setNewSup] = useState<{ name: string; gstin: string; state: string } | null>(null)
  const [suppliers, setSuppliers] = useState(props.suppliers)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<VoucherRow | null>(null)
  const [pending, start] = useTransition()
  const fromDraft = !!props.draft

  const item = (id: number) => props.items.find((i) => i.id === id)!
  const ptotal = lines.reduce((s, l) => s + Math.round(l.qty * l.rate), 0)
  const pgst = lines.reduce((s, l) => { const r = item(l.itemId).gst_rate; const v = Math.round(l.qty * l.rate); return s + v - Math.round((v * 100) / (100 + r)) }, 0)
  const found = useMemo(() => {
    const s = search.toLowerCase().trim()
    return s ? props.items.filter((i) => i.name.toLowerCase().includes(s) || i.aliases.includes(s)).slice(0, 6) : []
  }, [search, props.items])
  const cashAcc = props.accounts.find((x) => x.id === acc)

  const save = () => start(async () => {
    setErr('')
    const n = num(amount)
    const r =
      a === 'receipt' ? (!cust ? { ok: false as const, error: 'Pick who paid.' } : !acc ? { ok: false as const, error: 'Pick where the money went.' } : await bookReceipt(cust, n, cashAcc?.bank ? 'upi' : 'cash', acc))
      : a === 'preturn' ? (!sup ? { ok: false as const, error: 'Pick the supplier.' } : await bookReturnPurchase({ branchId: branch, supplierId: sup, lines, refundAccountId: mode === 'paid' ? acc : undefined, note: billNo }))
      : a === 'purchase' ? (!sup ? { ok: false as const, error: 'Pick the supplier.' } : await bookPurchase({ branchId: branch, supplierId: sup, billNo: billNo || undefined, mode, accountId: acc, lines }))
      : a === 'supplier' ? (!sup || !acc ? { ok: false as const, error: 'Pick the supplier and the account you paid from.' } : await bookPaySupplier(sup, n, acc))
      : a === 'expense' ? (!exp || !acc ? { ok: false as const, error: 'Pick what it was for and where the money came from.' } : await bookExpense({ ledgerId: exp, amount: n, accountId: acc, gstRate: gst, note }))
      : a === 'move' ? (!acc || !acc2 ? { ok: false as const, error: 'Pick both accounts.' } : await bookMove(acc, acc2, n))
      : !acc ? { ok: false as const, error: 'Pick the account.' } : await bookOwner(dir, n, acc)
    if (!r.ok) return setErr(r.error)
    setDone(r.data as VoucherRow)
  })
  const reset = () => { setDone(null); setAmount(''); setLines([]); setNote(''); setBillNo(''); setCust(undefined) }

  if (done) return (
    <div className="mx-auto max-w-2xl space-y-5 pt-4 rise">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-leaf-soft text-leaf"><Check className="size-6" strokeWidth={2.5} /></span>
        <div><h1 className="display text-[26px] font-semibold leading-tight">Saved in your books</h1><p className="text-[14px] text-muted">{done.narration}</p></div>
      </div>
      <div>
        <p className="mb-2 text-[13px] text-ink-2">This is exactly how it sits in the books, the way Tally and your CA see it:</p>
        <VoucherView v={done} />
      </div>
      <div className="flex gap-2"><button className="btn btn-primary" onClick={reset}>Record another</button><Link href="/books" className="btn">Back to Books</Link></div>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/books" className="btn btn-ghost btn-sm"><ArrowLeft className="size-4" />Books</Link>
      <div>
        <h1 className="display text-[28px] font-semibold leading-tight">What happened?</h1>
        {fromDraft && <p className="mt-1 text-[13.5px] text-leaf">Filled from what you said. Check it and save.</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {KINDS.map((k) => (
          <button key={k.a} onClick={() => { setA(k.a); setErr('') }} aria-pressed={a === k.a}
            className={`flex flex-col items-center gap-1 rounded-[12px] border p-2.5 text-center text-[12px] font-semibold transition ${a === k.a ? 'border-bahi bg-bahi text-[#fff6e6]' : 'border-line-2 bg-card text-ink-2 hover:border-ink-2'}`}>
            <k.icon className="size-5" />{k.label}
          </button>
        ))}
      </div>

      <div className="card space-y-5 p-5">
        {a === 'receipt' && <>
          <Field label="Who paid?"><PartyPicker parties={props.customers} value={cust} onChange={(id) => { setCust(id); const c = props.customers.find((x) => x.id === id); if (c && !amount) setAmount(String(c.owes)) }} owesLabel="Owes" placeholder="Search customer" /></Field>
          <Amount value={amount} onChange={setAmount} />
          <Field label="Where did the money go?"><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>
        </>}

        {(a === 'purchase' || a === 'preturn') && <>
          <Field label={a === 'preturn' ? 'Returned to' : 'Bought from'}>
            {newSup ? (
              <div className="space-y-2 rounded-[11px] bg-paper-2 p-3">
                <input value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} className="input" placeholder="Supplier name" aria-label="Supplier name" autoFocus />
                <div className="flex gap-2">
                  <input value={newSup.gstin} onChange={(e) => setNewSup({ ...newSup, gstin: e.target.value.toUpperCase() })} className="input num" placeholder="GSTIN (optional)" aria-label="GSTIN" maxLength={15} />
                  <select value={newSup.state} onChange={(e) => setNewSup({ ...newSup, state: e.target.value })} className="input w-40" aria-label="State">{['Goa', 'Maharashtra', 'Karnataka', 'Gujarat', 'Other'].map((s) => <option key={s}>{s}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => start(async () => {
                    const r = await bookAddSupplier(newSup)
                    if (!r.ok) return setErr(r.error)
                    setSuppliers((s) => [...s, { id: r.data as number, name: newSup.name, owes: 0, state: newSup.state }]); setSup(r.data as number); setNewSup(null)
                  })}>Add supplier</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewSup(null)}>Cancel</button>
                </div>
              </div>
            ) : <>
              <PartyPicker parties={suppliers} value={sup} onChange={setSup} owesLabel="We owe" placeholder="Search supplier" />
              {!sup && <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => setNewSup({ name: '', gstin: '', state: 'Goa' })}><Plus className="size-3.5" />New supplier</button>}
            </>}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={a === 'preturn' ? 'Stock goes out of' : 'Stock goes to'}>
              <select value={branch} onChange={(e) => setBranch(+e.target.value)} className="input h-11">{props.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </Field>
            <Field label={a === 'preturn' ? 'Reason or their note no.' : 'Supplier’s bill no.'} hint="optional"><input value={billNo} onChange={(e) => setBillNo(e.target.value)} className="input h-11" placeholder="GCA/1123" /></Field>
          </div>
          <Field label={a === 'preturn' ? 'What went back?' : 'What came in?'} hint="rate per unit, including GST">
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-[11px] border border-line p-2.5">
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{item(l.itemId).name}<span className="ml-1.5 font-normal text-muted">GST {item(l.itemId).gst_rate}%</span></span>
                  <input value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: num(e.target.value) } : x)))} inputMode="numeric" className="input num h-9 w-20" aria-label="Quantity" />
                  <span className="text-[12px] text-muted">{item(l.itemId).unit} × ₹</span>
                  <input value={l.rate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, rate: num(e.target.value) } : x)))} inputMode="numeric" className="input num h-9 w-24" aria-label="Rate" />
                  <span className="num w-24 text-right text-[13.5px] font-semibold">{inr(l.qty * l.rate)}</span>
                  <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-muted hover:text-bahi" aria-label="Remove"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
            <div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="Add an item: cement, pipe, putty…" aria-label="Add item" /></div>
            {found.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{found.map((i) => (
              <button type="button" key={i.id} onClick={() => { setLines([...lines, { itemId: i.id, qty: 1, rate: i.cost }]); setSearch('') }} className="rounded-full border border-line-2 bg-card px-3 py-1.5 text-[13px] hover:border-gold">{i.name}</button>))}</div>}
            {lines.length > 0 && <div className="mt-3 flex justify-end gap-4 text-[13.5px] num"><span className="text-muted">of which GST {inr(pgst)} (input credit)</span><span className="font-semibold">Bill total {inr(ptotal)}</span></div>}
          </Field>
          <Field label={a === 'preturn' ? 'Money back?' : 'Paid?'}>
            <div className="grid grid-cols-2 gap-2">
              {(a === 'preturn' ? [['credit', 'Less from what we owe'], ['paid', 'Refund received']] as const : [['credit', 'Not yet, on credit'], ['paid', 'Paid now']] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-[11px] border p-3 text-[13.5px] font-semibold ${mode === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{l}</button>))}
            </div>
          </Field>
          {mode === 'paid' && <Field label={a === 'preturn' ? 'Refund came into' : 'Paid from'}><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>}
        </>}

        {a === 'supplier' && <>
          <Field label="Which supplier?"><PartyPicker parties={suppliers} value={sup} onChange={(id) => { setSup(id); const s = suppliers.find((x) => x.id === id); if (s && !amount && s.owes > 0) setAmount(String(s.owes)) }} owesLabel="We owe" placeholder="Search supplier" /></Field>
          <Amount value={amount} onChange={setAmount} />
          <Field label="Paid from"><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>
        </>}

        {a === 'expense' && <>
          <Field label="What was it for?">
            <div className="flex flex-wrap gap-1.5">{props.expenses.map((e) => (
              <button type="button" key={e.id} onClick={() => setExp(e.id)} aria-pressed={exp === e.id} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${exp === e.id ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card hover:border-ink-2'}`}>{e.name}</button>))}</div>
          </Field>
          <Amount value={amount} onChange={setAmount} />
          <Field label="Paid from"><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>
          <Field label="Is there a GST bill?" hint="then the GST comes back as input credit">
            <div className="flex flex-wrap gap-1.5">{[0, 5, 12, 18, 28].map((r) => (
              <button type="button" key={r} onClick={() => setGst(r)} aria-pressed={gst === r} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${gst === r ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{r ? `Yes, ${r}%` : 'No GST bill'}</button>))}</div>
          </Field>
          <Field label="Note" hint="optional"><input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="November rent, Margao shop" /></Field>
        </>}

        {a === 'move' && <>
          <Field label="From"><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>
          <Field label="To"><AccountPicker accounts={props.accounts} value={acc2} onChange={setAcc2} exclude={acc} /></Field>
          <Amount value={amount} onChange={setAmount} />
        </>}

        {a === 'owner' && <>
          <Field label="Which way?">
            <div className="grid grid-cols-2 gap-2">
              {([['take', 'Took money home'], ['add', 'Put money into the business']] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setDir(k)} aria-pressed={dir === k} className={`rounded-[11px] border p-3 text-[13.5px] font-semibold ${dir === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{l}</button>))}
            </div>
          </Field>
          <Amount value={amount} onChange={setAmount} />
          <Field label={dir === 'take' ? 'Taken from' : 'Put into'}><AccountPicker accounts={props.accounts} value={acc} onChange={setAcc} /></Field>
          {!props.isFamily && <p className="text-[13px] text-amber">Only the family can record owner money.</p>}
        </>}

        {err && <p role="alert" className="rounded-[10px] bg-bahi-soft p-3 text-[13.5px] text-bahi">{err}</p>}
        <button onClick={save} disabled={pending || (a === 'purchase' || a === 'preturn' ? !lines.length : !num(amount))} className="btn btn-primary btn-lg w-full">
          {pending ? 'Saving…' : a === 'purchase' ? `Save purchase · ${inr(ptotal)}` : a === 'preturn' ? `Save return · ${inr(ptotal)}` : `Save · ${inr(num(amount))}`}
        </button>
      </div>
    </div>
  )
}
