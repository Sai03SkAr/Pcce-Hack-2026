import Link from 'next/link'
import { Undo2, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Building2, Home, Landmark, Lock, PackagePlus, ReceiptIndianRupee, Truck, Wallet } from 'lucide-react'
import { one } from '@/lib/db'
import { fmtDay, inr, today } from '@/lib/format'
import { accounts } from '@/lib/books'
import { booksFrom, dayBook, gstSummary, ledgerBalances, outstanding, profitLoss } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { TellBar } from '@/components/TellBar'
import { VoucherView } from '@/components/VoucherView'
import { AddBank } from './AddBank'

const ACTIONS = [
  { a: 'sale', href: '/bill', label: 'Sold something', sub: 'Make a bill', icon: ReceiptIndianRupee, tone: 'text-leaf bg-leaf-soft' },
  { a: 'receipt', label: 'Money came in', sub: 'A customer paid', icon: ArrowDownLeft, tone: 'text-leaf bg-leaf-soft' },
  { a: 'purchase', label: 'Bought stock', sub: 'Supplier bill', icon: PackagePlus, tone: 'text-gold bg-gold-soft' },
  { a: 'supplier', label: 'Paid a supplier', sub: 'Clear what we owe', icon: Truck, tone: 'text-bahi bg-bahi-soft' },
  { a: 'expense', label: 'Paid an expense', sub: 'Rent, salary, bijli…', icon: ArrowUpRight, tone: 'text-bahi bg-bahi-soft' },
  { a: 'move', label: 'Moved money', sub: 'Cash ↔ bank', icon: ArrowLeftRight, tone: 'text-ink-2 bg-paper-2' },
  { a: 'owner', label: 'Owner money', sub: 'Took home / put in', icon: Home, tone: 'text-ink-2 bg-paper-2' },
  { a: 'preturn', label: 'Returned goods', sub: 'Back to supplier', icon: Undo2, tone: 'text-gold bg-gold-soft' },
]

export default async function Books() {
  const u = await getUser()
  const T = today(), M = T.slice(0, 8) + '01', start = await booksFrom(u.org_id)
  const [accs, bal, pl, rec, pay, gst, recent, lock] = await Promise.all([
    accounts(u.org_id), ledgerBalances(u.org_id, start, T), profitLoss(u.org_id, M, T), outstanding(u.org_id, 'Sundry Debtors', T),
    outstanding(u.org_id, 'Sundry Creditors', T), gstSummary(u.org_id, T.slice(0, 7)), dayBook(u.org_id, start, T),
    one<any>('SELECT p.upto, p.ts, us.name FROM period_locks p LEFT JOIN users us ON us.id=p.user_id WHERE p.org_id=? ORDER BY p.upto DESC LIMIT 1', [u.org_id]),
  ])
  const balOf = (id: number) => bal.find((b) => b.id === id)?.closing ?? 0
  const visible = accs.filter((a) => !u.branch_id || a.grp === 'Bank Accounts' || a.branch_id === u.branch_id)
  const canEnter = u.role !== 'ca'
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
  const mon = new Date(T).toLocaleString('en-IN', { month: 'long' })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="display text-[30px] font-semibold leading-tight">Your khata, without the accountant</h1><p className="mt-1 text-[14px] text-muted">Kept the way Tally keeps it. You answer plain questions; Pedhi writes the vouchers.</p></div>
        <Link href="/books/ca" className={`chip ml-auto h-8 px-3 text-[12.5px] ${lock ? 'chip-green' : 'chip-gold'}`}>
          <Lock className="size-3.5" />{lock ? `Signed off by ${lock.name} up to ${fmtDay(lock.upto)}` : 'Not yet reviewed by your CA'}
        </Link>
      </div>

      {canEnter && (
        <>
          <TellBar />
          <section aria-label="What happened?" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {ACTIONS.map((x) => (
              <Link key={x.a} href={x.href ?? `/books/new?a=${x.a}`} className="card group flex flex-col gap-2 p-3.5 transition hover:border-gold hover:shadow-[var(--shadow-lg)]">
                <span className={`grid size-10 place-items-center rounded-[11px] ${x.tone}`}><x.icon className="size-5" strokeWidth={2} /></span>
                <span className="text-[14px] font-semibold leading-tight">{x.label}</span>
                <span className="text-[12px] text-muted">{x.sub}</span>
              </Link>
            ))}
          </section>
        </>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="card p-5">
          <div className="flex items-center"><h2 className="display text-[20px] font-semibold">Money in hand and bank</h2>{u.role !== 'ca' && (u.role === 'owner' || u.role === 'family') && <span className="ml-auto"><AddBank /></span>}</div>
          <ul className="mt-3 divide-y divide-line">
            {visible.map((a) => (
              <li key={a.id}><Link href={`/books/ledgers/${a.id}`} className="flex items-center gap-3 py-2.5 hover:text-bahi">
                <span className="grid size-8 place-items-center rounded-full bg-paper-2 text-ink-2">{a.grp === 'Bank Accounts' ? <Landmark className="size-4" /> : <Wallet className="size-4" />}</span>
                <span className="flex-1 text-[14px] font-medium">{a.name}</span>
                <span className="num text-[15px] font-semibold">{inr(balOf(a.id))}</span>
              </Link></li>
            ))}
          </ul>
          <div className="mt-3 flex border-t border-line pt-3 text-[14px] font-semibold"><span>Total</span><span className="num ml-auto">{inr(visible.reduce((s, a) => s + balOf(a.id), 0))}</span></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/books/reports?r=pl&from=${M}&to=${T}`} className="card p-4 hover:shadow-[var(--shadow-lg)]">
            <div className="eyebrow">Profit, {mon} so far</div>
            <div className={`num mt-1.5 text-[24px] font-semibold ${pl.net < 0 ? 'text-bahi' : ''}`}>{inr(pl.net)}</div>
            <div className="mt-1 text-[12.5px] text-muted num">Sales {inr(pl.totals.sales)} · Gross profit {inr(pl.gross)} · Expenses {inr(pl.totals.indirect + pl.totals.direct)}</div>
          </Link>
          <Link href="/books/gst" className="card p-4 hover:shadow-[var(--shadow-lg)]">
            <div className="eyebrow">GST to pay for {mon}</div>
            <div className="num mt-1.5 text-[24px] font-semibold">{inr(gst.r3b.cash)}</div>
            <div className="mt-1 text-[12.5px] text-muted num">Output {inr(gst.r3b.out.cgst + gst.r3b.out.sgst + gst.r3b.out.igst)} − input credit {inr(gst.r3b.itc.cgst + gst.r3b.itc.sgst + gst.r3b.itc.igst)} · GSTR-3B due 20th</div>
          </Link>
          <Link href="/customers" className="card p-4 hover:shadow-[var(--shadow-lg)]">
            <div className="eyebrow">Customers owe us</div>
            <div className="num mt-1.5 text-[24px] font-semibold">{inr(sum(rec))}</div>
            <div className="mt-1 text-[12.5px] text-muted">{rec.length} customers · Sundry Debtors</div>
          </Link>
          <Link href="/books/ledgers?g=Sundry+Creditors" className="card p-4 hover:shadow-[var(--shadow-lg)]">
            <div className="eyebrow">We owe suppliers</div>
            <div className="num mt-1.5 text-[24px] font-semibold">{inr(sum(pay))}</div>
            <div className="mt-1 text-[12.5px] text-muted">{pay.length} suppliers · Sundry Creditors</div>
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-baseline"><h2 className="display text-[22px] font-semibold">Latest entries</h2><Link href="/books/daybook" className="ml-auto text-[13px] text-muted hover:text-ink">Full Day Book →</Link></div>
        <div className="card divide-y divide-line">
          {recent.slice(0, 8).map((v) => (
            <details key={v.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-16 text-[12.5px] text-muted num">{fmtDay(v.day)}</span>
                <span className="chip chip-grey">{v.type}</span>
                <span className="order-last min-w-0 basis-full truncate text-[13.5px] text-ink-2 sm:order-none sm:flex-1 sm:basis-0 sm:text-[14px] sm:text-ink">{v.narration}</span>
                {v.branch && <span className="hidden text-[12px] text-muted sm:inline"><Building2 className="mr-1 inline size-3" />{v.branch}</span>}
                <span className="num ml-auto text-[14px] font-semibold sm:ml-0">{inr(v.amount)}</span>
                <span className="hidden text-[12px] text-gold group-open:hidden sm:inline">Tally view</span>
              </summary>
              <div className="mt-3 rounded-[10px] bg-paper-2/60 p-3"><VoucherView v={v} compact /></div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
