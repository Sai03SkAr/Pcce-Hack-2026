import { addDays, fmtDay, inr, today } from '@/lib/format'
import { dayBook } from '@/lib/reports'
import { getScope, getUser } from '@/lib/session'
import { RangeForm } from '@/components/RangeForm'
import { VoucherView } from '@/components/VoucherView'

const TYPES = ['Sales', 'Receipt', 'Purchase', 'Payment', 'Contra', 'Journal', 'Credit Note', 'Debit Note']

export default async function DayBook({ searchParams }: PageProps<'/books/daybook'>) {
  const u = await getUser()
  const scope = await getScope(u)
  const sp = await searchParams
  const to = typeof sp.to === 'string' ? sp.to : today(), from = typeof sp.from === 'string' ? sp.from : addDays(to, -2)
  const type = typeof sp.type === 'string' && TYPES.includes(sp.type) ? sp.type : undefined
  const vs = await dayBook(u.org_id, from, to, type, scope.branchId)
  const total = vs.reduce((s, v) => s + v.amount, 0)
  return (
    <div className="space-y-4">
      <div><h1 className="display text-[26px] font-semibold">Day Book</h1><p className="text-[13.5px] text-muted">Every entry, in order, with its debit and credit. Tap one to see it the Tally way.</p></div>
      <RangeForm from={from} to={to} csv={`/api/export?kind=daybook&from=${from}&to=${to}`}>
        <label className="text-[12.5px] font-medium text-ink-2">Type<select name="type" defaultValue={type ?? ''} className="input mt-1 h-9 w-auto"><option value="">All vouchers</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      </RangeForm>
      <div className="card divide-y divide-line">
        {vs.map((v) => (
          <details key={v.id} className="group px-4 py-2.5 print:break-inside-avoid">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
              <span className="w-14 text-muted num">{fmtDay(v.day)}</span>
              <span className="w-20 font-medium">{v.type}</span>
              <span className="num w-28 text-muted">{v.number}</span>
              <span className="min-w-0 flex-1 truncate">{v.party ?? v.narration}</span>
              <span className="num font-semibold">{inr(v.amount)}</span>
            </summary>
            <div className="mt-2.5 rounded-[10px] bg-paper-2/60 p-3"><VoucherView v={v} compact /><p className="mt-2 text-[12px] text-muted">{v.narration}{v.user ? ` · by ${v.user}` : ''}{v.branch ? ` · ${v.branch}` : ''}</p></div>
          </details>
        ))}
        {!vs.length && <p className="p-10 text-center text-muted">No entries in this period.</p>}
      </div>
      <p className="text-right text-[13px] text-muted num">{vs.length}{vs.length === 500 ? '+' : ''} vouchers · {inr(total)}</p>
    </div>
  )
}
