'use client'
import { useState, useTransition } from 'react'
import { ArrowDownLeft, ArrowUpRight, Landmark, Percent, Wallet } from 'lucide-react'
import { bookReceipt, bookSetCreditTerms, bookSetOpening, bookUdhaarEntry, saveNotes } from '@/app/actions'

type Acc = { id: number; name: string; bank: boolean; balance: number }
const inr = (n: number) => (n < 0 ? '−₹' : '₹') + Math.abs(Math.round(n)).toLocaleString('en-IN')
const num = (s: string) => parseInt(s.replace(/[^\d]/g, '')) || 0

type Tab = 'got' | 'gave' | 'less'
const TABS: [Tab, string, typeof Wallet][] = [['got', 'Got money', ArrowDownLeft], ['gave', 'Gave / added', ArrowUpRight], ['less', 'Discount / write-off', Percent]]

export function CustomerActions({ id, notes: n0, owes, limit: l0, days: d0, opening: o0, openingDay, accounts, canManage, isStaff }: {
  id: number; notes: string; owes: number; limit: number; days: number; opening: number; openingDay: string | null
  accounts: Acc[]; canManage: boolean; isStaff: boolean
}) {
  const [tab, setTab] = useState<Tab>('got')
  const [amount, setAmount] = useState(owes > 0 ? String(owes) : '')
  const [acc, setAcc] = useState<number | undefined>(accounts.find((a) => a.bank)?.id)
  const [gaveKind, setGaveKind] = useState<'gave_money' | 'charge'>('gave_money')
  const [lessKind, setLessKind] = useState<'discount' | 'writeoff'>('discount')
  const [note, setNote] = useState('')
  const [limit, setLimit] = useState(String(l0))
  const [days, setDays] = useState(String(d0))
  const [opening, setOpening] = useState(o0 ? String(o0) : '')
  const [since, setSince] = useState(openingDay ?? '')
  const [notes, setNotes] = useState(n0)
  const [msg, setMsg] = useState<{ k: string; ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const done = (k: string) => (r: { ok: boolean; error?: string; message?: string }) => {
    setMsg({ k, ok: r.ok, text: r.ok ? (r.message ?? 'Saved.') : r.error! })
    if (r.ok && k === 'main') { setAmount(''); setNote('') }
  }
  const Status = ({ k }: { k: string }) => msg?.k === k ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-leaf' : 'text-bahi'}`}>{msg.text}</p> : null
  const tabs = TABS.filter(([k]) => k !== 'less' || canManage)

  const Accounts = () => (
    <div className="grid grid-cols-2 gap-1.5">
      {accounts.map((a) => (
        <button type="button" key={a.id} onClick={() => setAcc(a.id)} aria-pressed={acc === a.id}
          className={`flex items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-left text-[12.5px] font-semibold ${acc === a.id ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>
          {a.bank ? <Landmark className="size-3.5 shrink-0" /> : <Wallet className="size-3.5 shrink-0" />}<span className="truncate">{a.name}</span>
        </button>
      ))}
    </div>
  )

  const submit = () => start(async () => {
    const n = num(amount)
    if (tab === 'got') {
      const a = accounts.find((x) => x.id === acc)
      if (!a) return setMsg({ k: 'main', ok: false, text: 'Pick where the money went.' })
      return done('main')(await bookReceipt(id, n, a.bank ? 'upi' : 'cash', a.id))
    }
    if (tab === 'gave') return done('main')(await bookUdhaarEntry(id, gaveKind, n, gaveKind === 'gave_money' ? acc : undefined, note))
    done('main')(await bookUdhaarEntry(id, lessKind, n, undefined, note))
  })

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-paper-2 p-1">
          {tabs.map(([k, l, I]) => (
            <button key={k} onClick={() => { setTab(k); setMsg(null); setAmount(k === 'got' && owes > 0 ? String(owes) : '') }}
              className={`flex flex-col items-center gap-0.5 rounded-[8px] py-1.5 text-[11.5px] font-semibold ${tab === k ? 'bg-card shadow-[var(--shadow)]' : 'text-muted'}`}><I className="size-4" />{l}</button>
          ))}
        </div>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); submit() }}>
          {tab === 'gave' && (
            <div className="grid grid-cols-2 gap-1.5">
              {([['gave_money', 'Gave money'], ['charge', 'Added a charge']] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setGaveKind(k)} aria-pressed={gaveKind === k} className={`rounded-[10px] border p-2 text-[13px] font-semibold ${gaveKind === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{l}</button>))}
            </div>
          )}
          {tab === 'less' && (
            <div className="grid grid-cols-2 gap-1.5">
              {([['discount', 'Discount'], ['writeoff', 'Write off (won’t pay)']] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setLessKind(k)} aria-pressed={lessKind === k} className={`rounded-[10px] border p-2 text-[13px] font-semibold ${lessKind === k ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-card'}`}>{l}</button>))}
            </div>
          )}
          <label className="block text-[13.5px] font-semibold">Amount (₹)
            <input value={amount ? Number(num(amount)).toLocaleString('en-IN') : ''} onChange={(e) => setAmount(String(num(e.target.value)))} inputMode="numeric"
              className="input num mt-1.5 h-12 text-[20px] font-semibold" placeholder="0" /></label>
          {(tab === 'got' || (tab === 'gave' && gaveKind === 'gave_money')) && (
            <div><div className="mb-1.5 text-[13.5px] font-semibold">{tab === 'got' ? 'Money went into' : 'Money came from'}</div><Accounts /></div>
          )}
          {tab !== 'got' && <label className="block text-[13px] font-medium">Note<input value={note} onChange={(e) => setNote(e.target.value)} className="input mt-1"
            placeholder={tab === 'gave' ? (gaveKind === 'charge' ? 'Tempo delivery to site' : 'Advance for labour') : 'Settled at ₹500 less'} /></label>}
          <p className="text-[12px] text-muted">{tab === 'got' ? 'Lowers what they owe. Booked as a Receipt.' : tab === 'gave' ? (gaveKind === 'gave_money' ? 'They owe this back. Booked as a Payment from your cash or bank.' : 'Adds to what they owe, e.g. delivery. Booked as other income.') : lessKind === 'discount' ? 'Lowers what they owe. Booked as Discount Allowed.' : 'For money you will not get back. Booked as Bad Debts Written Off.'}</p>
          <button className="btn btn-primary w-full" disabled={pending || !num(amount)}>{pending ? 'Saving…' : 'Save'}</button>
          <Status k="main" />
        </form>
      </div>

      {canManage && (
        <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => done('terms')(await bookSetCreditTerms(id, num(limit), num(days)))) }}>
          <h2 className="font-semibold">Credit terms</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[13px] font-medium">Udhaar limit (₹)<input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1" /></label>
            <label className="text-[13px] font-medium">Pay within (days)<input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1" /></label>
          </div>
          <button className="btn w-full" disabled={pending || (limit === String(l0) && days === String(d0))}>Save terms</button>
          <Status k="terms" />
        </form>
      )}

      {canManage && (
        <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); start(async () => done('open')(await bookSetOpening({ customerId: id }, num(opening), since || undefined))) }}>
          <div><h2 className="font-semibold">Old balance</h2><p className="text-[12.5px] text-muted">What they owed before you started using Pedhi, from the paper khata or another app.</p></div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[13px] font-medium">Amount (₹)<input value={opening} onChange={(e) => setOpening(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input num mt-1" placeholder="0" /></label>
            <label className="text-[13px] font-medium">Owed since<input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="input mt-1" /></label>
          </div>
          <button className="btn w-full" disabled={pending || (num(opening) === o0 && since === (openingDay ?? ''))}>Save old balance</button>
          <Status k="open" />
        </form>
      )}

      <div className="card space-y-3 p-4">
        <div><h2 className="font-semibold">What the family knows</h2><p className="text-[12.5px] text-muted">Notes the owner carries in their head. Pedhi uses them when it answers questions about this customer.</p></div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={!canManage} rows={3} className="input" placeholder="Pays after the monsoon contract closes. Call the son, not the site office." />
        {canManage && <button className="btn w-full" disabled={pending || notes === n0} onClick={() => start(async () => done('n')(await saveNotes(id, notes)))}>Save notes</button>}
        <Status k="n" />
      </div>
      {isStaff && <p className="text-[12px] text-muted">Discounts, write-offs, limits and old balances are set by the family or a manager.</p>}
    </div>
  )
}
