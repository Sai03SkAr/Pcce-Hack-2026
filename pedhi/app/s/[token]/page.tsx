import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { one } from '@/lib/db'
import { fmtDay, inr, today } from '@/lib/format'
import { customerLedger, receivables } from '@/lib/metrics'
import { Logo } from '@/components/Logo'
import { PrintButton } from '@/components/PrintButton'

export const metadata: Metadata = { title: 'Account statement', robots: { index: false, follow: false } }

const LABEL: Record<string, string> = { Sales: 'Bill', Receipt: 'Payment received', Payment: 'Money given', Journal: 'Adjustment', 'Credit Note': 'Goods returned', Opening: 'Old balance' }

/** The customer's own view of their khata, opened from a private link. Shows only this one account. */
export default async function Statement({ params }: PageProps<'/s/[token]'>) {
  const { token } = await params
  if (!/^[a-f0-9]{40}$/.test(token)) notFound()
  const c = await one<any>(`SELECT c.id, c.org_id, c.name, o.name org, o.gstin, o.upi_id, b.name branch FROM customers c JOIN orgs o ON o.id=c.org_id
    JOIN branches b ON b.id=c.branch_id WHERE c.share_token=?`, [token])
  if (!c) notFound()
  const r = (await receivables({ orgId: c.org_id })).find((x) => x.customer_id === c.id)!
  const ledger = (await customerLedger(c.org_id, c.id)).reverse().slice(0, 100)
  const upi = `upi://pay?pa=${c.upi_id}&pn=${encodeURIComponent(c.org)}&am=${Math.max(0, r.outstanding)}&cu=INR&tn=${encodeURIComponent('Account ' + c.name)}`
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        <Logo size={36} />
        <div className="leading-tight"><div className="text-[17px] font-semibold">{c.org}</div><div className="text-[12.5px] text-muted">{c.branch} branch{c.gstin ? ` · GSTIN ${c.gstin}` : ''}</div></div>
        <span className="ml-auto print:hidden"><PrintButton /></span>
      </header>
      <section className="card p-5">
        <div className="text-[13px] text-muted">Account statement for</div>
        <h1 className="display text-[26px] font-semibold leading-tight">{c.name}</h1>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div><div className="eyebrow">{r.outstanding >= 0 ? 'Amount due' : 'Paid in advance'}</div><div className="num text-[32px] font-semibold tracking-tight">{inr(Math.abs(r.outstanding))}</div>
            {r.overdue > 0 && <div className="text-[13px] text-bahi">{inr(r.overdue)} is past the {r.credit_days}-day credit period</div>}</div>
          {r.outstanding > 0 && <a href={upi} className="btn btn-primary btn-lg ml-auto print:hidden">Pay {inr(r.outstanding)} by UPI</a>}
        </div>
        <p className="mt-3 text-[12px] text-muted">As on {fmtDay(today())}. The UPI button opens GPay, PhonePe or any UPI app on your phone.</p>
      </section>
      <ul className="card divide-y divide-line sm:hidden">
        {ledger.map((l, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{LABEL[l.type] ?? l.type} {l.number}</div><div className="text-[12px] text-muted">{fmtDay(l.day)}</div></div>
            <div className="text-right num"><div className={`text-[14.5px] font-semibold ${l.amount < 0 ? 'text-leaf' : ''}`}>{l.amount < 0 ? '−' : '+'}{inr(Math.abs(l.amount))}</div><div className="text-[11.5px] text-muted">bal {inr(l.balance)}</div></div>
          </li>))}
      </ul>
      <section className="card hidden overflow-x-auto sm:block print:block">
        <table className="table min-w-[480px] num">
          <thead><tr><th>Date</th><th>Entry</th><th className="text-right">Added</th><th className="text-right">Paid / less</th><th className="text-right">Balance</th></tr></thead>
          <tbody>{ledger.map((l, i) => (
            <tr key={i}><td className="text-ink-2">{fmtDay(l.day)}</td><td>{LABEL[l.type] ?? l.type} {l.number}</td>
              <td className="text-right">{l.amount > 0 ? inr(l.amount) : ''}</td><td className="text-right text-leaf">{l.amount < 0 ? inr(-l.amount) : ''}</td>
              <td className="text-right font-semibold">{inr(l.balance)}</td></tr>))}
            {!ledger.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No entries.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-center text-[12px] text-muted">Questions about an entry? Call or WhatsApp {c.org}. Sent from Pedhi.</p>
    </main>
  )
}
