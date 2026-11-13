import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { fmtDay, inr, today } from '@/lib/format'
import { booksFrom, ledgerStatement } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { RangeForm } from '@/components/RangeForm'

const side = (n: number) => `${inr(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}`

export default async function LedgerPage({ params, searchParams }: PageProps<'/books/ledgers/[id]'>) {
  const u = await getUser()
  const id = +(await params).id
  const sp = await searchParams
  const to = typeof sp.to === 'string' ? sp.to : today(), from = typeof sp.from === 'string' ? sp.from : await booksFrom(u.org_id)
  const st = await ledgerStatement(u.org_id, id, from, to)
  if (!st) notFound()
  return (
    <div className="space-y-4">
      <Link href="/books/ledgers" className="btn btn-ghost btn-sm print:hidden"><ArrowLeft className="size-4" />Ledgers</Link>
      <div className="flex flex-wrap items-end gap-3"><div><p className="eyebrow">Under {st.ledger.grp}</p><h1 className="display text-[26px] font-semibold">{st.ledger.name}</h1></div>
        <div className="ml-auto text-right"><div className="eyebrow">Closing balance</div><div className="num text-[22px] font-semibold">{side(st.closing)}</div></div></div>
      <RangeForm from={from} to={to} csv={`/api/export?kind=ledger&id=${id}&from=${from}&to=${to}`} />
      <div className="card overflow-x-auto">
        <table className="table min-w-[680px]">
          <thead><tr><th>Date</th><th>Particulars (against)</th><th>Voucher</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
          <tbody className="num">
            <tr><td>{fmtDay(from)}</td><td className="font-medium">Opening balance</td><td></td><td></td><td></td><td className="text-right font-semibold">{side(st.opening)}</td></tr>
            {st.rows.map((r) => (
              <tr key={r.id}>
                <td className="text-ink-2">{fmtDay(r.day)}</td>
                <td className="max-w-[320px]"><div className="truncate">{r.against}</div><div className="truncate text-[12px] text-muted">{r.narration}</div></td>
                <td className="text-[12.5px] text-muted">{r.type} {r.number}</td>
                <td className="text-right">{r.amount > 0 ? inr(r.amount) : ''}</td>
                <td className="text-right">{r.amount < 0 ? inr(-r.amount) : ''}</td>
                <td className="text-right font-medium">{side(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
