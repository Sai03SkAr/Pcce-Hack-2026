import { Download, FileCode2, ShieldCheck } from 'lucide-react'
import { q } from '@/lib/db'
import { addDays, fmtDay, today } from '@/lib/format'
import { booksFrom } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { SignOff } from './SignOff'
import { Backup } from './Backup'

export default async function CaPack({ searchParams }: PageProps<'/books/ca'>) {
  const u = await getUser()
  const sp = await searchParams
  const start = await booksFrom(u.org_id)
  const to = typeof sp.to === 'string' ? sp.to : addDays(today(), -1), from = typeof sp.from === 'string' ? sp.from : start
  const locks = await q<any>('SELECT p.*, us.name FROM period_locks p LEFT JOIN users us ON us.id=p.user_id WHERE p.org_id=? ORDER BY p.upto DESC', [u.org_id])
  const x = (kind: string) => `/api/export?kind=${kind}&from=${from}&to=${to}`
  const files = [
    ['tally-masters', 'Tally ledgers (masters) XML', 'Import first in TallyPrime: Import → Masters. Creates every ledger under its group, with opening balances.', FileCode2],
    ['tally-vouchers', 'Tally vouchers XML', 'Then Import → Transactions. Every sale, purchase, receipt, payment and contra in the period.', FileCode2],
    ['daybook', 'Day Book (CSV)', 'Every voucher line, opens in Excel.', Download],
    ['tb', 'Trial Balance (CSV)', '', Download], ['pl', 'Profit & Loss (CSV)', '', Download], ['bs', 'Balance Sheet (CSV)', '', Download],
  ] as const
  return (
    <div className="space-y-5">
      <div><h1 className="display text-[26px] font-semibold">CA pack</h1>
        <p className="max-w-2xl text-[13.5px] text-muted">Everything your chartered accountant needs to review the books and file returns. No re-typing from WhatsApp photos. Your CA can also log in to Pedhi with a read-only CA account.</p></div>

      <form className="flex flex-wrap items-end gap-2">
        <label className="text-[12.5px] font-medium text-ink-2">From<input type="date" name="from" defaultValue={from} className="input mt-1 h-9 w-auto" /></label>
        <label className="text-[12.5px] font-medium text-ink-2">To<input type="date" name="to" defaultValue={to} className="input mt-1 h-9 w-auto" /></label>
        <button className="btn btn-sm h-9">Set period</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {files.map(([k, title, sub, Icon]) => (
          <a key={k} href={x(k)} className="card flex gap-3 p-4 transition hover:border-gold hover:shadow-[var(--shadow-lg)]">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-gold-soft text-gold"><Icon className="size-5" /></span>
            <span><span className="block font-semibold">{title}</span>{sub && <span className="block text-[12.5px] text-muted">{sub}</span>}<span className="mt-1 block text-[12px] text-ink-2">{fmtDay(from)} to {fmtDay(to)}</span></span>
          </a>
        ))}
      </div>
      <p className="text-[12.5px] text-muted">The Tally files follow Tally’s documented XML import format (ENVELOPE → TALLYMESSAGE → LEDGER / VOUCHER). Do one test import into a copy of the company before importing a full year.</p>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-leaf" />Sign-off</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">When the CA has reviewed a period, they sign it off here. Signed-off days are locked: no bill, payment or entry on or before that date can be added, changed or cancelled until the CA reopens it.</p>
        {(u.role === 'ca' || u.role === 'owner') && <SignOff defaultUpto={to} isCa={u.role === 'ca'} hasLock={locks.length > 0} />}
        <ul className="mt-4 space-y-2">
          {locks.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-leaf-soft/50 px-3 py-2 text-[13.5px]"><ShieldCheck className="size-4 text-leaf" /><b>Up to {fmtDay(l.upto)}</b><span className="text-ink-2">signed by {l.name} on {fmtDay(l.ts.slice(0, 10))}</span>{l.note && <span className="text-muted">· “{l.note}”</span>}</li>)}
          {!locks.length && <li className="text-[13.5px] text-muted">Nothing signed off yet.</li>}
        </ul>
      </section>
      {(u.role === 'owner' || u.role === 'family') && <Backup isOwner={u.role === 'owner'} />}
    </div>
  )
}
