import { one, q } from '@/lib/db'
import { today } from '@/lib/format'
import { balanceSheet, booksFrom, gstSummary, ledgerStatement, profitLoss, trialBalance } from '@/lib/reports'
import { getUser } from '@/lib/session'

const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
const xml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const isDay = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// Tally XML: a debit is ISDEEMEDPOSITIVE=Yes with a negative AMOUNT; a credit is No with a positive AMOUNT.
const tallyAmount = (amount: number) => (-amount).toFixed(2)
const envelope = (report: string, company: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>` +
  `<REQUESTDESC><REPORTNAME>${report}</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>` +
  `<REQUESTDATA>\n${body}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n`
const DUTY: Record<string, string> = { CGST: 'Central Tax', SGST: 'State Tax', IGST: 'Integrated Tax' }

export async function GET(req: Request) {
  const u = await getUser()
  if (u.role === 'staff') return new Response('Not allowed', { status: 403 })
  const p = new URL(req.url).searchParams
  const kind = p.get('kind') ?? ''
  const start = await booksFrom(u.org_id)
  const from = isDay(p.get('from')) ? p.get('from')! : start, to = isDay(p.get('to')) ? p.get('to')! : today()
  const org = (await one<any>('SELECT * FROM orgs WHERE id=?', [u.org_id]))!
  const file = (name: string, body: string, type: string) =>
    new Response(body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` } })
  const stamp = `${from}_to_${to}`

  if (kind === 'tally-masters') {
    const ls = await q<any>(`SELECT l.*, COALESCE(c.gstin, s.gstin) gstin, COALESCE(c.state, s.state) state FROM ledgers l
      LEFT JOIN customers c ON c.id=l.customer_id LEFT JOIN suppliers s ON s.id=l.supplier_id WHERE l.org_id=? ORDER BY l.id`, [u.org_id])
    const body = ls.map((l) => {
      const tax = /^(Output|Input) (CGST|SGST|IGST)$/.exec(l.name)
      return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xml(l.name)}" ACTION="Create"><NAME.LIST><NAME>${xml(l.name)}</NAME></NAME.LIST>` +
        `<PARENT>${xml(l.grp)}</PARENT>` +
        (l.opening ? `<OPENINGBALANCE>${tallyAmount(l.opening)}</OPENINGBALANCE>` : '') +
        (l.kind === 'customer' || l.kind === 'supplier' ? `<ISBILLWISEON>Yes</ISBILLWISEON>${l.gstin ? `<PARTYGSTIN>${xml(l.gstin)}</PARTYGSTIN><GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` : '<GSTREGISTRATIONTYPE>Unregistered/Consumer</GSTREGISTRATIONTYPE>'}<LEDSTATENAME>${xml(l.state ?? org.state)}</LEDSTATENAME>` : '') +
        (tax ? `<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>${DUTY[tax[2]]}</GSTDUTYHEAD>` : '') +
        `</LEDGER></TALLYMESSAGE>\n`
    }).join('')
    return file(`pedhi-tally-masters.xml`, envelope('All Masters', org.name, body), 'application/xml')
  }

  if (kind === 'tally-vouchers') {
    const vs = await q<any>(`SELECT v.*, pl.name party FROM vouchers v LEFT JOIN ledgers pl ON pl.id=v.party_ledger_id
      WHERE v.org_id=? AND v.day BETWEEN ? AND ? ORDER BY v.day, v.id`, [u.org_id, from, to])
    const lines = await q<any>(`SELECT vl.voucher_id, vl.amount, l.name FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id JOIN ledgers l ON l.id=vl.ledger_id
      WHERE v.org_id=? AND v.day BETWEEN ? AND ? ORDER BY vl.voucher_id, vl.amount DESC`, [u.org_id, from, to])
    const byV = new Map<number, any[]>()
    for (const l of lines) byV.set(l.voucher_id, [...(byV.get(l.voucher_id) ?? []), l])
    // Accounting-voucher mode (no item lines), as TallyPrime exports it. Tally's own docs disagree on the line tag,
    // so ?tag=ledgerentries switches to LEDGERENTRIES.LIST if an import rejects the default.
    const tag = p.get('tag') === 'ledgerentries' ? 'LEDGERENTRIES.LIST' : 'ALLLEDGERENTRIES.LIST'
    const body = vs.map((v) =>
      `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${xml(v.type)}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${v.day.replace(/-/g, '')}</DATE>` +
      `<VOUCHERTYPENAME>${xml(v.type)}</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(v.number)}</VOUCHERNUMBER>` +
      (v.party ? `<PARTYLEDGERNAME>${xml(v.party)}</PARTYLEDGERNAME>` : '') +
      `<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><ISINVOICE>No</ISINVOICE><NARRATION>${xml(v.narration)}</NARRATION>` +
      (byV.get(v.id) ?? []).map((l) => `<${tag}><LEDGERNAME>${xml(l.name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${l.amount > 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>` +
        `${l.name === v.party ? '<ISPARTYLEDGER>Yes</ISPARTYLEDGER>' : ''}<AMOUNT>${tallyAmount(l.amount)}</AMOUNT></${tag}>`).join('') +
      `</VOUCHER></TALLYMESSAGE>\n`).join('')
    return file(`pedhi-tally-vouchers-${stamp}.xml`, envelope('Vouchers', org.name, body), 'application/xml')
  }

  const out = (name: string, rows: unknown[][]) => file(`pedhi-${name}-${stamp}.csv`, '﻿' + csv(rows), 'text/csv; charset=utf-8')

  if (kind === 'daybook') {
    const lines = await q<any>(`SELECT v.day, v.type, v.number, v.narration, l.name, l.grp, vl.amount FROM vouchers v JOIN voucher_lines vl ON vl.voucher_id=v.id
      JOIN ledgers l ON l.id=vl.ledger_id WHERE v.org_id=? AND v.day BETWEEN ? AND ? ORDER BY v.day, v.id, vl.amount DESC`, [u.org_id, from, to])
    return out('daybook', [['Date', 'Voucher type', 'Voucher no.', 'Ledger', 'Group', 'Debit', 'Credit', 'Narration'],
      ...lines.map((l) => [l.day, l.type, l.number, l.name, l.grp, l.amount > 0 ? l.amount : '', l.amount < 0 ? -l.amount : '', l.narration])])
  }
  if (kind === 'ledger') {
    const st = await ledgerStatement(u.org_id, Number(p.get('id')), from, to)
    if (!st) return new Response('Not found', { status: 404 })
    return out(st.ledger.name.replace(/[^\w]+/g, '-'), [['Date', 'Voucher', 'Against', 'Narration', 'Debit', 'Credit', 'Balance (Dr +)'], ['', '', 'Opening balance', '', '', '', st.opening],
      ...st.rows.map((r) => [r.day, `${r.type} ${r.number}`, r.against, r.narration, r.amount > 0 ? r.amount : '', r.amount < 0 ? -r.amount : '', r.balance])])
  }
  if (kind === 'tb') {
    const t = await trialBalance(u.org_id, to)
    return out('trial-balance', [['Ledger', 'Group', 'Debit', 'Credit'], ...t.lines.map((l) => [l.name, l.grp, l.debit || '', l.credit || '']), ['Total', '', t.debit, t.credit]])
  }
  if (kind === 'pl') {
    const r = await profitLoss(u.org_id, from, to, u.branch_id ?? (Number(p.get('branch')) || null))
    return out('profit-and-loss', [['Particulars', 'Amount'], ['Opening stock', r.openingStock], ...r.purchases.map((x) => [x.name, x.amount]), ...r.direct.map((x) => [x.name, x.amount]),
      ...r.sales.map((x) => [x.name, x.amount]), ['Closing stock', r.closingStock], ['Gross profit', r.gross], ...r.indirect.map((x) => [x.name, -x.amount]), ...r.incomes.map((x) => [x.name, x.amount]), ['Net profit', r.net]])
  }
  if (kind === 'bs') {
    const b = await balanceSheet(u.org_id, to)
    return out('balance-sheet', [['Side', 'Group', 'Ledger', 'Amount'],
      ...b.liabilities.flatMap((g) => [['Liabilities', g.grp, '', g.total], ...g.ledgers.map((l) => ['', '', l.name, l.amount])]),
      ...b.assets.flatMap((g) => [['Assets', g.grp, '', g.total], ...g.ledgers.map((l) => ['', '', l.name, l.amount])]),
      ['Total liabilities', '', '', b.totalLiabilities], ['Total assets', '', '', b.totalAssets]])
  }
  if (kind === 'gstr1-b2b' || kind === 'gstr1-hsn') {
    const m = /^\d{4}-\d{2}$/.test(p.get('m') ?? '') ? p.get('m')! : to.slice(0, 7)
    const g = await gstSummary(u.org_id, m)
    return kind === 'gstr1-b2b'
      ? out(`gstr1-b2b-${m}`, [['GSTIN of recipient', 'Receiver name', 'Invoice number', 'Invoice date', 'Invoice value', 'Place of supply', 'Taxable value', 'CGST', 'SGST', 'IGST'],
        ...g.b2b.map((b) => [b.gstin, b.name, b.invoice_no, b.day, b.value, b.inter ? 'Other state' : org.state, b.taxable, b.cgst, b.sgst, b.igst])])
      : out(`gstr1-hsn-${m}`, [['HSN', 'UQC', 'Total quantity', 'Rate', 'Taxable value', 'IGST', 'CGST', 'SGST'], ...g.hsn.map((h) => [h.hsn, h.unit, h.qty, h.rate, h.taxable, h.igst, h.cgst, h.sgst])])
  }
  return new Response('Unknown export', { status: 400 })
}
