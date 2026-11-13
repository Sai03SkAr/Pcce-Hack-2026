import Link from 'next/link'
import { MessageCircle, Mic, Monitor } from 'lucide-react'
import { addDays, fmtDay, inr, today } from '@/lib/format'
import { recentSales, salesSummary } from '@/lib/metrics'
import { getScope, getUser, seesMoney } from '@/lib/session'

const SRC = { whatsapp: { icon: MessageCircle, label: 'WhatsApp' }, voice: { icon: Mic, label: 'Voice' }, pos: { icon: Monitor, label: 'Counter' } } as const
const MODE: Record<string, string> = { cash: 'chip-grey', upi: 'chip-gold', credit: 'chip-red' }

export default async function Sales({ searchParams }: PageProps<'/sales'>) {
  const u = await getUser()
  const scope = await getScope(u)
  const sp = await searchParams
  const days = sp.range === 'today' ? 0 : sp.range === 'month' ? 29 : 6
  const T = today(), from = addDays(T, -days)
  const [sum, bills] = await Promise.all([salesSummary(scope, from, T), recentSales(scope, 200, from)])
  const mode = typeof sp.mode === 'string' ? sp.mode : ''
  const shown = mode ? bills.filter((b) => b.mode === mode) : bills
  const link = (k: string, v: string) => { const p = new URLSearchParams(Object.entries({ range: sp.range ?? '', mode, [k]: v }).filter(([, x]) => x) as any); return `/sales?${p}` }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><p className="eyebrow">{scope.branchName ?? 'All branches'}</p><h1 className="display text-[30px] font-semibold leading-tight">Sales</h1></div>
        <div className="ml-auto flex rounded-[10px] border border-line-2 bg-card p-0.5 text-[13px] font-semibold">
          {[['today', 'Today'], ['', '7 days'], ['month', '30 days']].map(([k, l]) => (
            <Link key={k} href={link('range', k)} className={`rounded-[8px] px-3 py-1.5 ${(sp.range ?? '') === k ? 'bg-ink text-paper' : 'text-muted'}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {[
          ['Sales', inr(sum.revenue), `${sum.bills} bills`],
          ['Average bill', inr(sum.avg_bill), ''],
          ...(seesMoney(u) ? [['Gross margin', inr(sum.margin), `${sum.margin_pct}%`]] : []),
          ['Cash · UPI', `${inr(sum.cash)}`, `UPI ${inr(sum.upi)}`],
          ['Udhaar given', inr(sum.credit), `Collected ${inr(sum.collected)}`],
        ].map(([l, v, s]) => (
          <div key={l} className="card p-4"><div className="eyebrow">{l}</div><div className="num mt-1.5 text-[20px] font-semibold">{v}</div><div className="text-[12.5px] text-muted num">{s}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[['', 'All'], ['cash', 'Cash'], ['upi', 'UPI'], ['credit', 'Udhaar']].map(([k, l]) => (
          <Link key={k} href={link('mode', k)} className={`chip h-7 px-3 text-[12.5px] ${mode === k ? 'bg-ink text-paper' : 'chip-grey'}`}>{l}</Link>
        ))}
      </div>

      <ul className="card divide-y divide-line md:hidden">
        {shown.map((b) => (
          <li key={b.id}><Link href={`/sales/${b.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-paper-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold">{b.customer ?? 'Walk-in'}</div>
              <div className="text-[12.5px] text-muted num">{b.invoice_no} · {fmtDay(b.day)} {b.ts.slice(11, 16)} · {b.branch}</div>
            </div>
            <div className="text-right">
              <div className="num text-[15px] font-semibold">{inr(b.total)}</div>
              <span className={`chip ${MODE[b.mode]} mt-0.5`}>{b.mode === 'credit' ? 'Udhaar' : b.mode.toUpperCase()}</span>
            </div>
          </Link></li>
        ))}
        {!shown.length && <li className="py-10 text-center text-muted">No bills in this period.</li>}
      </ul>

      <div className="card hidden overflow-x-auto md:block">
        <table className="table min-w-[720px]">
          <thead><tr><th>Bill</th><th>When</th><th>Branch</th><th>Customer</th><th>By</th><th>Via</th><th>Paid</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {shown.map((b) => {
              const src = SRC[b.source as keyof typeof SRC] ?? SRC.pos
              return (
                <tr key={b.id}>
                  <td><Link href={`/sales/${b.id}`} className="num font-semibold hover:text-bahi">{b.invoice_no}</Link><div className="text-[12px] text-muted">{b.lines} {b.lines === 1 ? 'item' : 'items'}</div></td>
                  <td className="num text-ink-2">{fmtDay(b.day)} <span className="text-muted">{b.ts.slice(11, 16)}</span></td>
                  <td>{b.branch}</td>
                  <td className="max-w-[200px] truncate">{b.customer ?? <span className="text-muted">Walk-in</span>}</td>
                  <td className="text-ink-2">{b.user?.split(' ')[0]}</td>
                  <td><span className={`chip ${b.source === 'whatsapp' ? 'chip-green' : 'chip-grey'}`}><src.icon className="size-3" />{src.label}</span></td>
                  <td><span className={`chip ${MODE[b.mode]}`}>{b.mode === 'credit' ? 'Udhaar' : b.mode.toUpperCase()}</span></td>
                  <td className="num text-right font-semibold">{inr(b.total)}</td>
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={8} className="py-10 text-center text-muted">No bills in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      {bills.length === 200 && <p className="text-center text-[12.5px] text-muted">Showing the latest 200 bills.</p>}
    </div>
  )
}
