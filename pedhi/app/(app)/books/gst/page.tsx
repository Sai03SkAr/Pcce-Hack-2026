import { addDays, fmtDay, inr, today } from '@/lib/format'
import { gstSummary } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { PrintButton } from '@/components/PrintButton'
import { Download } from 'lucide-react'

export default async function Gst({ searchParams }: PageProps<'/books/gst'>) {
  const u = await getUser()
  const sp = await searchParams
  const month = typeof sp.m === 'string' && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today().slice(0, 7)
  const g = await gstSummary(u.org_id, month)
  const months = [0, 1, 2, 3].map((i) => addDays(today().slice(0, 8) + '15', -31 * i).slice(0, 7))
  const label = (m: string) => new Date(m + '-15').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const next = addDays(g.to, 1)
  const T = (x: { taxable: number; cgst: number; sgst: number; igst: number }) => <><td className="text-right">{inr(x.taxable)}</td><td className="text-right">{inr(x.cgst)}</td><td className="text-right">{inr(x.sgst)}</td><td className="text-right">{inr(x.igst)}</td></>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="display text-[26px] font-semibold">GST for {label(month)}</h1>
          <p className="text-[13.5px] text-muted">Prepared from your bills and purchases. File GSTR-1 by {fmtDay(next.slice(0, 8) + '11')} and GSTR-3B by {fmtDay(next.slice(0, 8) + '20')} on the GST portal (monthly filers), or let your CA file.</p></div>
        <form className="flex w-full gap-2 sm:ml-auto sm:w-auto print:hidden">
          <select name="m" defaultValue={month} className="input h-9 min-w-0 flex-1 sm:w-auto sm:flex-none">{months.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
          <button className="btn btn-sm h-9">Show</button><PrintButton />
        </form>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="eyebrow">Tax on sales</div><div className="num mt-1 text-[22px] font-semibold">{inr(g.r3b.out.cgst + g.r3b.out.sgst + g.r3b.out.igst)}</div><div className="text-[12.5px] text-muted num">on {inr(g.r3b.out.taxable)} of sales</div></div>
        <div className="card p-4"><div className="eyebrow">Input credit (purchases & bills)</div><div className="num mt-1 text-[22px] font-semibold">{inr(g.r3b.itc.cgst + g.r3b.itc.sgst + g.r3b.itc.igst)}</div><div className="text-[12.5px] text-muted">Check it appears in GSTR-2B before claiming</div></div>
        <div className="card bg-gold-soft/50 p-4"><div className="eyebrow">To pay in cash</div><div className="num mt-1 text-[22px] font-semibold">{inr(g.r3b.cash)}</div><div className="text-[12.5px] text-muted num">IGST {inr(g.r3b.pay.igst)} · CGST {inr(g.r3b.pay.cgst)} · SGST {inr(g.r3b.pay.sgst)}</div></div>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex items-center px-4 pt-4"><h2 className="font-semibold">GSTR-3B summary</h2></div>
        <table className="table min-w-[640px] num">
          <thead><tr><th>Table</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th></tr></thead>
          <tbody>
            <tr><td>3.1(a) Outward taxable supplies</td>{T({ taxable: g.r3b.out.taxable, cgst: g.r3b.out.cgst, sgst: g.r3b.out.sgst, igst: g.r3b.out.igst })}</tr>
            <tr><td>4(A)(5) Input tax credit, all other</td><td></td><td className="text-right">{inr(g.r3b.itc.cgst)}</td><td className="text-right">{inr(g.r3b.itc.sgst)}</td><td className="text-right">{inr(g.r3b.itc.igst)}</td></tr>
            <tr className="font-semibold"><td>6.1 Tax payable in cash</td><td></td><td className="text-right">{inr(g.r3b.pay.cgst)}</td><td className="text-right">{inr(g.r3b.pay.sgst)}</td><td className="text-right">{inr(g.r3b.pay.igst)}</td></tr>
            {g.r3b.carry.cgst + g.r3b.carry.sgst + g.r3b.carry.igst > 0 && <tr><td>Credit carried forward</td><td></td><td className="text-right">{inr(g.r3b.carry.cgst)}</td><td className="text-right">{inr(g.r3b.carry.sgst)}</td><td className="text-right">{inr(g.r3b.carry.igst)}</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card overflow-x-auto">
          <div className="flex items-center px-4 pt-4"><h2 className="font-semibold">GSTR-1 · B2B invoices <span className="font-normal text-muted">({g.b2b.length})</span></h2>
            <a href={`/api/export?kind=gstr1-b2b&m=${month}`} className="btn btn-sm ml-auto print:hidden"><Download className="size-3.5" />CSV</a></div>
          <table className="table min-w-[640px] num text-[13px]">
            <thead><tr><th>Invoice</th><th>Customer · GSTIN</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
            <tbody>{g.b2b.slice(0, 40).map((b) => (
              <tr key={b.invoice_no}><td>{b.invoice_no}<div className="text-[11.5px] text-muted">{fmtDay(b.day)}</div></td><td className="max-w-[220px]"><div className="truncate">{b.name}</div><div className="text-[11.5px] text-muted">{b.gstin}{b.inter ? ' · IGST' : ''}</div></td>
                <td className="text-right">{inr(b.taxable)}</td><td className="text-right">{inr(b.cgst + b.sgst + b.igst)}</td></tr>))}</tbody>
          </table>
          {g.b2b.length > 40 && <p className="px-4 pb-3 text-[12.5px] text-muted">Showing 40 of {g.b2b.length}. Download the CSV for all.</p>}
        </section>
        <div className="space-y-5">
          {g.cdnr.length > 0 && (
            <section className="card overflow-x-auto">
              <div className="px-4 pt-4"><h2 className="font-semibold">GSTR-1 · Credit notes to registered customers <span className="font-normal text-muted">({g.cdnr.length})</span></h2></div>
              <table className="table num text-[13px]"><thead><tr><th>Against bill</th><th>Customer · GSTIN</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
                <tbody>{g.cdnr.map((c, i) => <tr key={i}><td>{c.invoice_no}<div className="text-[11.5px] text-muted">{fmtDay(c.day)}</div></td><td><div className="truncate">{c.name}</div><div className="text-[11.5px] text-muted">{c.gstin}</div></td>
                  <td className="text-right">{inr(-c.taxable)}</td><td className="text-right">{inr(-(c.cgst + c.sgst + c.igst))}</td></tr>)}</tbody></table>
            </section>
          )}
          <section className="card overflow-x-auto">
            <div className="px-4 pt-4"><h2 className="font-semibold">GSTR-1 · B2C (small) by rate</h2></div>
            <table className="table num text-[13px]"><thead><tr><th>Rate</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th></tr></thead>
              <tbody>{g.b2cs.map((b) => <tr key={b.rate}><td>{b.rate}%</td>{T(b)}</tr>)}</tbody></table>
          </section>
          <section className="card overflow-x-auto">
            <div className="flex items-center px-4 pt-4"><h2 className="font-semibold">GSTR-1 · HSN summary</h2><a href={`/api/export?kind=gstr1-hsn&m=${month}`} className="btn btn-sm ml-auto print:hidden"><Download className="size-3.5" />CSV</a></div>
            <table className="table num text-[13px]"><thead><tr><th>HSN</th><th>Rate</th><th className="text-right">Qty</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
              <tbody>{g.hsn.map((h) => <tr key={h.hsn + h.rate}><td>{h.hsn}</td><td>{h.rate}%</td><td className="text-right">{h.qty} {h.unit}</td><td className="text-right">{inr(h.taxable)}</td><td className="text-right">{inr(h.cgst + h.sgst + h.igst)}</td></tr>)}</tbody></table>
          </section>
        </div>
      </div>
      <p className="text-[12.5px] text-muted">Pedhi prepares these numbers from your books; it does not file returns. GST rules change: have your CA confirm rates, HSN codes and credit before filing.</p>
    </div>
  )
}
