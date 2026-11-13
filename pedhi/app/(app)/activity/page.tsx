import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { q } from '@/lib/db'
import { fmtDay } from '@/lib/format'
import { getUser, isFamily } from '@/lib/session'

const TONE: Record<string, string> = { credit_override: 'chip-red', undo_sale: 'chip-amber', adjust: 'chip-amber', transfer: 'chip-gold', reminder: 'chip-green', payment: 'chip-green', import: 'chip-gold' }

export default async function Activity() {
  const u = await getUser()
  if (!isFamily(u) && u.role !== 'ca') redirect('/')
  const rows = await q<any>('SELECT a.*, us.name user FROM audit a LEFT JOIN users us ON us.id=a.user_id WHERE a.org_id=? ORDER BY a.id DESC LIMIT 300', [u.org_id])
  return (
    <div className="space-y-5">
      <div><p className="eyebrow">Family only</p><h1 className="display text-[30px] font-semibold leading-tight">Activity</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2"><ShieldCheck className="size-4 text-leaf" />Every bill, payment, stock change, override and cancellation, with who did it. Nobody can edit this list.</p></div>
      <div className="card divide-y divide-line">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13.5px]">
            <span className="num w-24 shrink-0 text-muted">{fmtDay(r.ts.slice(0, 10))} {r.ts.slice(11, 16)}</span>
            <span className={`chip ${TONE[r.action] ?? 'chip-grey'}`}>{r.action.replace('_', ' ')}</span>
            <span className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">{r.detail}</span>
            <span className="ml-auto text-muted sm:ml-0">{r.user ?? 'System'}</span>
          </div>
        ))}
        {!rows.length && <p className="p-10 text-center text-muted">Nothing yet. Make a bill or send a WhatsApp message and it will show up here.</p>}
      </div>
    </div>
  )
}
