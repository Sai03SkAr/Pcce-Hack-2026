import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { one, q } from '@/lib/db'
import { fmtDay, fmtDayLong, inr } from '@/lib/format'
import { getUser, isFamily } from '@/lib/session'
import { InvoiceActions } from './InvoiceActions'
import { ReturnItems } from './ReturnItems'
import { returnable } from '@/lib/books'

export default async function Invoice({ params }: PageProps<'/sales/[id]'>) {
  const u = await getUser()
  const { id } = await params
  const s = await one<any>(
    `SELECT s.*, b.name branch, o.name org, o.upi_id, o.state ostate, o.gstin ogstin, c.name customer, c.phone cphone, c.gstin cgstin, c.state cstate, us.name user FROM sales s
     JOIN branches b ON b.id=s.branch_id JOIN orgs o ON o.id=s.org_id LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users us ON us.id=s.user_id
     WHERE s.id=? AND s.org_id=?`, [+id, u.org_id])
  if (!s || (u.branch_id && u.branch_id !== s.branch_id)) notFound()
  const lines = await q<any>('SELECT si.*, i.name, i.unit, i.hsn, i.gst_rate FROM sale_items si JOIN items i ON i.id=si.item_id WHERE si.sale_id=?', [s.id])
  const taxable = s.total - s.tax
  const canReturn = await returnable(s.id)
  const returns = await q<any>(`SELECT r.day, r.total, r.refund, r.note, v.number FROM returns r LEFT JOIN vouchers v ON v.id=r.voucher_id WHERE r.sale_id=? ORDER BY r.id`, [s.id])
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/sales" className="btn btn-ghost btn-sm"><ArrowLeft className="size-4" />Sales</Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {u.role !== 'ca' && <ReturnItems saleId={s.id} lines={canReturn} hasCustomer={!!s.customer_id} wasCredit={s.mode === 'credit'} />}
          <InvoiceActions id={s.id} canUndo={(isFamily(u) || s.user_id === u.id) && !returns.length} />
        </div>
      </div>
      <article className="card p-4 sm:p-9 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start gap-4 border-b border-line pb-5">
          <div><h1 className="display text-[26px] font-semibold">{s.org}</h1><p className="text-[13px] text-muted">{s.branch} branch · {s.ostate} · GSTIN {s.ogstin}</p></div>
          <div className="ml-auto text-right"><div className="eyebrow">Tax invoice</div><div className="num text-[18px] font-semibold">{s.invoice_no}</div><div className="text-[13px] text-muted">{fmtDayLong(s.day)} · {s.ts.slice(11, 16)}</div></div>
        </header>
        <div className="flex flex-wrap gap-6 py-4 text-[13.5px]">
          <div><div className="eyebrow">Billed to</div><div className="mt-1 font-semibold">{s.customer ?? 'Walk-in customer'}</div>{s.cphone && <div className="text-muted num">+{s.cphone}</div>}{s.cgstin && <div className="num text-ink-2">GSTIN {s.cgstin} · {s.cstate}</div>}</div>
          <div><div className="eyebrow">Payment</div><div className="mt-1 font-semibold">{s.mode === 'credit' ? 'Udhaar (on account)' : s.mode.toUpperCase()}</div></div>
          <div><div className="eyebrow">Billed by</div><div className="mt-1">{s.user} · via {s.source === 'whatsapp' ? 'WhatsApp' : 'counter'}</div></div>
        </div>
        <table className="table">
          <thead><tr><th>Item</th><th className="hidden sm:table-cell print:table-cell">HSN</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="hidden text-right sm:table-cell print:table-cell">GST</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.id}><td className="font-medium">{l.name}</td><td className="num hidden text-muted sm:table-cell print:table-cell">{l.hsn}</td><td className="num text-right">{l.qty} {l.unit}</td><td className="num text-right">{inr(l.price)}</td><td className="num hidden text-right text-muted sm:table-cell print:table-cell">{l.gst_rate}%</td><td className="num text-right font-semibold">{inr(l.qty * l.price)}</td></tr>
          ))}</tbody>
        </table>
        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-[13.5px] num">
          <div className="flex"><span className="text-muted">Taxable value</span><span className="ml-auto">{inr(taxable)}</span></div>
          {s.cstate && s.cstate !== s.ostate
            ? <div className="flex"><span className="text-muted">IGST (supply to {s.cstate})</span><span className="ml-auto">{inr(s.tax)}</span></div>
            : <>
              <div className="flex"><span className="text-muted">CGST</span><span className="ml-auto">{inr(Math.floor(s.tax / 2))}</span></div>
              <div className="flex"><span className="text-muted">SGST</span><span className="ml-auto">{inr(s.tax - Math.floor(s.tax / 2))}</span></div>
            </>}
          <div className="flex border-t border-line pt-2 text-[18px] font-semibold"><span>Total</span><span className="ml-auto">{inr(s.total)}</span></div>
        </div>
        {returns.length > 0 && (
          <div className="mt-6 rounded-[10px] bg-amber-soft/50 p-3 text-[13px]">
            <div className="font-semibold">Goods returned on this bill</div>
            {returns.map((r, i) => <div key={i} className="num">{fmtDay(r.day)} · {r.number} · {inr(r.total)} · {r.refund === 'account' ? 'credited to account' : `refunded ${r.refund.toUpperCase()}`}{r.note ? ` · ${r.note}` : ''}</div>)}
          </div>
        )}
        <p className="mt-8 text-[12px] text-muted">Prices include GST. {s.mode === 'credit' ? `Pay by UPI to ${s.upi_id}.` : 'Thank you for your business.'}</p>
      </article>
    </div>
  )
}
