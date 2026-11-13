import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone } from 'lucide-react'
import { fmtDay, inr } from '@/lib/format'
import { accounts } from '@/lib/books'
import { customerLedger, receivables } from '@/lib/metrics'
import { booksFrom, ledgerBalances } from '@/lib/reports'
import { one } from '@/lib/db'
import { today, addDays } from '@/lib/format'
import { getUser, isFamily } from '@/lib/session'
import { getLang } from '../../../actions'
import { CustomerActions } from './CustomerActions'
import { RemindButton } from '../RemindButton'
import { ShareStatement } from './ShareStatement'

const LABEL: Record<string, string> = { Sales: 'Bill', Receipt: 'Payment received', Payment: 'Money given', Journal: 'Adjustment', 'Credit Note': 'Goods returned', Opening: 'Old balance' }

export default async function Customer({ params }: PageProps<'/customers/[id]'>) {
  const u = await getUser()
  const id = +(await params).id
  const r = (await receivables({ orgId: u.org_id })).find((c) => c.customer_id === id)
  if (!r || (u.branch_id && u.branch_id !== r.branch_id)) notFound()
  const ledger = (await customerLedger(u.org_id, id)).reverse()
  const c = (await one<any>('SELECT gstin, state, opening_day FROM customers WHERE id=?', [id]))!
  const opening = (await one<any>('SELECT opening FROM ledgers WHERE customer_id=?', [id]))!.opening as number
  const bought = (await one<any>(`SELECT COALESCE(SUM(total),0) total, COUNT(*) n FROM sales WHERE customer_id=? AND day >= ?`, [id, addDays(today(), -90)]))!
  const lang = await getLang()
  const [accs, bal] = await Promise.all([accounts(u.org_id), ledgerBalances(u.org_id, await booksFrom(u.org_id), today())])
  const money = accs.filter((a) => !u.branch_id || a.grp === 'Bank Accounts' || a.branch_id === u.branch_id)
    .map((a) => ({ id: a.id, name: a.name, bank: a.grp === 'Bank Accounts', balance: bal.find((b) => b.id === a.id)?.closing ?? 0 }))
  const canManage = isFamily(u) || u.role === 'manager'

  return (
    <div className="space-y-5">
      <Link href="/customers" className="btn btn-ghost btn-sm print:hidden"><ArrowLeft className="size-4" />Udhaar</Link>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0"><p className="eyebrow">{r.branch} branch</p><h1 className="display text-[30px] font-semibold leading-tight">{r.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 text-[13.5px] text-muted">{r.phone && <a href={`tel:+${r.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink num"><Phone className="size-3.5" />+{r.phone}</a>}{c.gstin && <span className="num">GSTIN {c.gstin} · {c.state}</span>}</div></div>
        {u.role !== 'ca' && (
          <div className="ml-auto flex flex-wrap gap-2 print:hidden">
            <ShareStatement customerId={id} phone={r.phone} name={r.name} balance={r.outstanding} />
            {r.outstanding > 0 && u.role !== 'staff' && <RemindButton ids={[r.customer_id]} lang={lang} label="Send reminder" primary />}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[[r.outstanding < 0 ? 'Paid in advance' : 'Owes', inr(Math.abs(r.outstanding)), r.outstanding > r.credit_limit ? 'Over the limit' : `of ${inr(r.credit_limit)} limit`],
          ['Oldest unpaid', r.outstanding > 0 ? `${r.oldest_days} days` : '-', r.overdue > 0 ? `${inr(r.overdue)} past ${r.credit_days}-day credit` : `Within ${r.credit_days}-day credit`],
          ['Bought, 90 days', inr(bought.total), `${bought.n} bills`],
          ['Last payment', r.last_payment ? fmtDay(r.last_payment) : '-', '']].map(([l, v, s]) => (
          <div key={l} className="card p-4"><div className="eyebrow">{l}</div><div className="num mt-1.5 text-[20px] font-semibold">{v}</div>
            <div className={`text-[12.5px] ${s === 'Over the limit' || String(s).includes('past') ? 'text-bahi' : 'text-muted'}`}>{s}</div></div>))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="card overflow-x-auto">
          <div className="flex items-baseline px-4 pt-4"><h2 className="font-semibold">Khata</h2><span className="ml-2 text-[12.5px] text-muted">every bill, payment and adjustment on this account</span></div>
          <table className="table min-w-[520px]">
            <thead><tr><th>Date</th><th>Entry</th><th className="text-right">Udhaar +</th><th className="text-right">Paid / less −</th><th className="text-right">Balance</th></tr></thead>
            <tbody className="num">{ledger.slice(0, 120).map((l, i) => (
              <tr key={(l.voucher_id ?? 'o') + ':' + i}>
                <td className="text-ink-2">{fmtDay(l.day)}</td>
                <td className="max-w-[260px]">
                  {l.sale_id ? <Link href={`/sales/${l.sale_id}`} className="font-medium hover:text-bahi">{LABEL[l.type] ?? l.type} {l.number}</Link> : <span className="font-medium">{LABEL[l.type] ?? l.type} {l.number}</span>}
                  <div className="truncate text-[12px] text-muted">{l.narration}</div>
                </td>
                <td className="text-right">{l.amount > 0 ? inr(l.amount) : ''}</td>
                <td className="text-right text-leaf">{l.amount < 0 ? inr(-l.amount) : ''}</td>
                <td className="text-right font-semibold">{inr(l.balance)}</td>
              </tr>))}
              {!ledger.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No entries yet.</td></tr>}
            </tbody>
          </table>
          <p className="px-4 pb-3 text-[12px] text-muted">Cash and UPI bills are paid on the spot, so they don’t change the balance.</p>
        </div>
        {u.role !== 'ca' && (
          <CustomerActions id={r.customer_id} notes={r.notes ?? ''} owes={r.outstanding} limit={r.credit_limit} days={r.credit_days}
            opening={opening} openingDay={c.opening_day} accounts={money} canManage={canManage} isStaff={u.role === 'staff'} />
        )}
      </div>
    </div>
  )
}
