import Link from 'next/link'
import { NotebookPen } from 'lucide-react'
import { inr } from '@/lib/format'
import { receivables } from '@/lib/metrics'
import { getScope, getUser } from '@/lib/session'
import { getLang } from '../../actions'
import { RemindButton } from './RemindButton'
import { NewCustomerButton } from '@/components/NewCustomer'
import { q } from '@/lib/db'
import { today } from '@/lib/format'
import { booksFrom, ledgerBalances } from '@/lib/reports'
import { reminderSettings } from '@/lib/reminders'
import { waEnabled } from '@/lib/whatsapp'
import { AutoReminders } from './AutoReminders'
import { SupplierOld } from './SupplierOld'

export default async function Customers({ searchParams }: PageProps<'/customers'>) {
  const u = await getUser()
  const scope = await getScope(u)
  const lang = await getLang()
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? AND (? IS NULL OR id=?) ORDER BY id', [u.org_id, u.branch_id, u.branch_id])
  const sp = await searchParams
  const tab = sp.tab === 'suppliers' && u.role !== 'staff' ? 'suppliers' : 'customers'
  if (tab === 'suppliers') return <Suppliers orgId={u.org_id} canEdit={u.role === 'owner' || u.role === 'family' || u.role === 'manager'} />
  const all = await receivables(scope)
  const rem = await reminderSettings(u.org_id)
  const show = sp.f === 'all' ? all : all.filter((r) => r.outstanding > 0)
  const total = all.reduce((s, r) => s + r.outstanding, 0)
  const buckets = [
    ['0-30 days', all.reduce((s, r) => s + r.b0_30, 0), 'bg-leaf'],
    ['31-60 days', all.reduce((s, r) => s + r.b31_60, 0), 'bg-amber'],
    ['60+ days', all.reduce((s, r) => s + r.b60p, 0), 'bg-bahi'],
  ] as const
  const overdueIds = all.filter((r) => r.overdue > 0).map((r) => r.customer_id)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><p className="eyebrow">{scope.branchName ?? 'All branches'}</p><h1 className="display text-[30px] font-semibold leading-tight">Udhaar</h1></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {u.role !== 'ca' && <NewCustomerButton branches={branches} defaultBranch={scope.branchId ?? branches[0].id} canSetLimit={u.role !== 'staff'} />}
          {overdueIds.length > 0 && u.role !== 'staff' && u.role !== 'ca' && <RemindButton ids={overdueIds} lang={lang} label={`Remind all ${overdueIds.length} overdue`} primary />}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div><div className="eyebrow">Outstanding</div><div className="num text-[30px] font-semibold tracking-tight">{inr(total)}</div></div>
          <p className="text-[13.5px] text-muted">{all.filter((r) => r.outstanding > 0).length} customers owe money. Payments are applied to their oldest bills first.</p>
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-paper-2">{buckets.map(([l, v, c]) => <div key={l} className={c} style={{ width: `${total ? (v / total) * 100 : 0}%` }} title={`${l}: ${inr(v)}`} />)}</div>
        <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">{buckets.map(([l, v, c]) => <span key={l} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${c}`} />{l}<span className="num font-semibold">{inr(v)}</span></span>)}</div>
      </div>

 {(u.role === 'owner' || u.role === 'family') && <AutoReminders on={rem.remind_after_days !== null} after={rem.remind_after_days ?? 0} every={rem.remind_every_days} waLive={waEnabled()} />}

      <div className="flex flex-wrap gap-1.5">
        {u.role !== 'staff' && <><span className="chip h-7 bg-ink px-3 text-[12.5px] text-paper">Customers</span><Link href="/customers?tab=suppliers" className="chip chip-grey h-7 px-3 text-[12.5px]">Suppliers</Link><span className="mx-1 w-px self-stretch bg-line-2" /></>}
        <Link href="/customers" className={`chip h-7 px-3 text-[12.5px] ${sp.f !== 'all' ? 'bg-ink text-paper' : 'chip-grey'}`}>Owes money</Link>
        <Link href="/customers?f=all" className={`chip h-7 px-3 text-[12.5px] ${sp.f === 'all' ? 'bg-ink text-paper' : 'chip-grey'}`}>All customers</Link>
      </div>

      <ul className="card divide-y divide-line md:hidden">
        {show.map((r) => (
          <li key={r.customer_id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/customers/${r.customer_id}`} className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold">{r.name}</div>
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted">{r.branch}
                {r.outstanding > 0 && <span className={`chip ${r.oldest_days > r.credit_days + 15 ? 'chip-red' : r.overdue > 0 ? 'chip-amber' : 'chip-grey'} num`}>{r.oldest_days} days</span>}
                {r.outstanding > r.credit_limit && <span className="chip chip-red">over limit</span>}</div>
            </Link>
            <div className="flex flex-col items-end gap-1">
              <span className="num text-[15px] font-semibold">{inr(r.outstanding)}</span>
              {r.outstanding > 0 && u.role !== 'staff' && <RemindButton ids={[r.customer_id]} lang={lang} label="Remind" />}
            </div>
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto md:block">
        <table className="table min-w-[760px]">
          <thead><tr><th>Customer</th><th>Branch</th><th className="text-right">Owes</th><th>Oldest bill</th><th>Limit used</th><th>Last paid</th><th></th></tr></thead>
          <tbody>{show.map((r) => {
            const used = r.credit_limit ? Math.round((r.outstanding / r.credit_limit) * 100) : 0
            return (
              <tr key={r.customer_id}>
                <td><Link href={`/customers/${r.customer_id}`} className="font-semibold hover:text-bahi">{r.name}</Link>{r.notes && <div className="flex max-w-[260px] items-center gap-1 text-[12px] text-muted"><NotebookPen className="size-3 shrink-0" /><span className="truncate">{r.notes}</span></div>}</td>
                <td className="text-ink-2">{r.branch}</td>
                <td className="num text-right font-semibold">{inr(r.outstanding)}</td>
                <td>{r.outstanding > 0 ? <span className={`chip ${r.oldest_days > r.credit_days + 15 ? 'chip-red' : r.overdue > 0 ? 'chip-amber' : 'chip-grey'} num`}>{r.oldest_days} days</span> : <span className="text-muted">-</span>}</td>
                <td><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-2"><div className={`h-full ${used > 100 ? 'bg-bahi' : used > 75 ? 'bg-amber' : 'bg-leaf'}`} style={{ width: `${Math.min(100, used)}%` }} /></div><span className={`num text-[12.5px] ${used > 100 ? 'font-semibold text-bahi' : 'text-muted'}`}>{used}%</span></div></td>
                <td className="num text-ink-2">{r.last_payment ? r.last_payment.slice(5).split('-').reverse().join('/') : '-'}</td>
                <td className="text-right">{r.outstanding > 0 && u.role !== 'staff' && <RemindButton ids={[r.customer_id]} lang={lang} label="Remind" />}</td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}

async function Suppliers({ orgId, canEdit }: { orgId: number; canEdit: boolean }) {
  const bal = await ledgerBalances(orgId, await booksFrom(orgId), today())
  const sup = await q<any>('SELECT s.id, s.name, s.gstin, s.state, s.phone, l.id ledger_id, l.opening FROM suppliers s JOIN ledgers l ON l.supplier_id=s.id WHERE s.org_id=? ORDER BY s.name', [orgId])
  const rows = sup.map((s) => ({ ...s, owe: -(bal.find((b) => b.id === s.ledger_id)?.closing ?? 0) })).sort((a, b) => b.owe - a.owe)
  const total = rows.reduce((a, r) => a + Math.max(0, r.owe), 0)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3"><h1 className="display text-[30px] font-semibold leading-tight">Udhaar</h1></div>
      <div className="flex flex-wrap gap-1.5"><Link href="/customers" className="chip chip-grey h-7 px-3 text-[12.5px]">Customers</Link><span className="chip h-7 bg-ink px-3 text-[12.5px] text-paper">Suppliers</span></div>
      <div className="card p-5"><div className="eyebrow">We owe suppliers</div><div className="num text-[30px] font-semibold tracking-tight">{inr(total)}</div>
        <p className="text-[13.5px] text-muted">From supplier bills recorded in Books, less payments and goods sent back.</p></div>
      <ul className="card divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
            <div className="min-w-0 flex-1"><Link href={`/books/ledgers/${r.ledger_id}`} className="font-semibold hover:text-bahi">{r.name}</Link>
              <div className="text-[12.5px] text-muted num">{r.state}{r.gstin ? ` · ${r.gstin}` : ''}</div></div>
            <span className="num text-[15px] font-semibold">{r.owe >= 0 ? inr(r.owe) : `${inr(-r.owe)} advance`}</span>
            <div className="flex gap-1.5">
              {r.owe > 0 && canEdit && <Link href={`/books/new?a=supplier&d=${encodeURIComponent(JSON.stringify({ action: 'supplier', supplierId: r.id, amount: r.owe }))}`} className="btn btn-primary btn-sm">Pay</Link>}
              <Link href={`/books/ledgers/${r.ledger_id}`} className="btn btn-sm">Statement</Link>
              {canEdit && <SupplierOld supplierId={r.id} current={-r.opening} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
