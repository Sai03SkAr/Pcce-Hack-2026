// Turns the seeded shop history into complete books: every bill and payment as a voucher, plus the
// purchases, supplier payments, expenses, bank deposits and owner drawings a real business would have.
import type { Transaction } from '@libsql/client'
import { q, tx } from './db'
import { addDays, weekday } from './format'
import { ensureChart, gstLines, ledgerMap, receiptLines, receiptNarration, saleLines, saleNarration } from './books'
import { stockValue } from './reports'

const SUPPLIERS: [string, string, string, string | null][] = [
  // name, category, state, GSTIN
  ['Goa Cement Agencies', 'Cement', 'Goa', '30AAGFG2231K1Z4'],
  ['Konkan Steel Traders', 'Steel', 'Goa', '30AAKFK8840M1Z9'],
  ['Asian Paints Distributor - Panaji', 'Paint', 'Goa', '30AABCA6612P1Z2'],
  ['Supreme Pipes Depot', 'Plumbing', 'Goa', '30AAMFS4107Q1Z6'],
  ['Finolex Electricals Goa', 'Electrical', 'Goa', '30AAJFF9025R1Z1'],
  ['Kajaria Tiles Distributor', 'Tiles', 'Goa', '30AADFK3318S1Z8'],
  ['Hubli Hardware Mart', 'Hardware', 'Karnataka', '29AAHFH5530T1Z3'],
  ['Sanguem Sand & Metal Suppliers', 'Aggregates', 'Goa', '30AAPFS7764U1Z5'],
]
// Registered businesses among the customers (B2B in GSTR-1); one is across the border in Karnataka (IGST).
const CUSTOMER_GST: Record<string, [string, string]> = {
  "D'Souza Builders": ['30AAKFD1203B1Z7', 'Goa'], 'Shree Datta Constructions': ['30AAMFS5521C1Z2', 'Goa'],
  'Kamat Infra': ['30AACCK8812D1Z9', 'Goa'], 'Borkar Developers': ['30AAJFB2209E1Z4', 'Goa'],
  'Bardez Constructions': ['30AAEFB6610F1Z1', 'Goa'], 'Calangute Villas Pvt Ltd': ['30AAFCC4471G1Z6', 'Goa'],
  'Dhavalikar Constructions': ['30AAGFD9932H1Z3', 'Goa'], 'Shantadurga Builders': ['30AAHFS1145J1Z8', 'Goa'],
  'Gauns Engineering': ['29AAKFG4521K1Z3', 'Karnataka'],
}
const RENT = [45000, 30000, 25000], SALARY = [62000, 38000, 31000]

type V = { day: string; type: string; number?: string; branch: number | null; narration: string; party: number | null; lines: { ledgerId: number; amount: number }[]; sale?: number; payment?: number; purchase?: number; user?: number | null; source?: string }

async function bulk(t: Transaction, table: string, cols: string[], rows: any[][]) {
  const per = Math.floor(900 / cols.length)
  const tuple = `(${cols.map(() => '?').join(',')})`
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per)
    await t.execute({ sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES ${chunk.map(() => tuple).join(',')}`, args: chunk.flat() })
  }
}

export async function seedBooks(orgId: number, day0: string, T: string) {
  await tx(async (t) => {
    await t.execute({ sql: `UPDATE orgs SET gstin='30ABCPN1234F1Z5', state='Goa', books_from=? WHERE id=?`, args: [day0, orgId] })
    for (const [name, [gstin, state]] of Object.entries(CUSTOMER_GST))
      await t.execute({ sql: 'UPDATE customers SET gstin=?, state=? WHERE org_id=? AND name=?', args: [gstin, state, orgId, name] })
    await bulk(t, 'suppliers', ['org_id', 'name', 'aliases', 'category', 'state', 'gstin', 'phone'],
      SUPPLIERS.map(([n, c, s, g], i) => [orgId, n, n.toLowerCase().split(' ')[0], c, s, g, `9198260${String(20011 + i * 211).slice(0, 5)}`]))
    // The first bank account is where UPI lands by default.
    await bulk(t, 'ledgers', ['org_id', 'name', 'grp', 'kind'], [[orgId, 'HDFC Bank - Current', 'Bank Accounts', 'bank'], [orgId, 'SBI - Current', 'Bank Accounts', 'bank']])
    await ensureChart(orgId, t)
  })

  const L = await ledgerMap(orgId)
  const HDFC = L.get('HDFC Bank - Current'), SBI = L.get('SBI - Current')
  const branches = await q<any>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [orgId])
  const owner = L.rows.find((r) => r.kind === 'drawings')!.id
  const vs: V[] = []

  // Bills and payments already in the books of original entry
  const sales = await q<any>(`SELECT s.*, c.name cname, c.state cstate FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.org_id=? ORDER BY s.id`, [orgId])
  const sl = await q<any>('SELECT si.sale_id, si.qty*si.price amount, i.gst_rate rate FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN items i ON i.id=si.item_id WHERE s.org_id=?', [orgId])
  const bySale = new Map<number, { amount: number; rate: number }[]>()
  for (const l of sl) bySale.set(l.sale_id, [...(bySale.get(l.sale_id) ?? []), l])
  for (const s of sales) {
    const lines = saleLines(L, s, bySale.get(s.id)!, !!s.cstate && s.cstate !== 'Goa')
    vs.push({ day: s.day, type: 'Sales', number: s.invoice_no, branch: s.branch_id, narration: saleNarration(s.invoice_no, s.cname, s.mode), party: lines[0].ledgerId, lines, sale: s.id, user: s.user_id, source: s.source })
  }
  for (const p of await q<any>('SELECT p.*, c.name FROM payments p JOIN customers c ON c.id=p.customer_id WHERE p.org_id=?', [orgId]))
    vs.push({ day: p.day, type: 'Receipt', branch: p.branch_id, narration: receiptNarration(p.name, p.mode), party: L.customer(p.customer_id), lines: receiptLines(L, p), payment: p.id, user: p.user_id })

  // Purchases: the stock that came in, billed by the supplier for its category, on credit
  const sup = await q<any>('SELECT * FROM suppliers WHERE org_id=?', [orgId])
  const moves = await q<any>(`SELECT m.branch_id, m.day, m.item_id, m.qty, i.cost, i.gst_rate, i.category FROM stock_moves m JOIN items i ON i.id=m.item_id
    WHERE m.org_id=? AND m.type='purchase' AND m.qty > 0 ORDER BY m.day, m.branch_id`, [orgId])
  const groups = new Map<string, any[]>()
  for (const m of moves) { const k = `${m.day}|${m.branch_id}|${m.category}`; groups.set(k, [...(groups.get(k) ?? []), m]) }
  const purchases: any[][] = [], pitems: any[][] = []
  let pid = 0
  for (const [k, ms] of groups) {
    const [day, branch, cat] = k.split('|')
    const s = sup.find((x) => x.category === cat)
    const total = ms.reduce((a, m) => a + m.qty * m.cost, 0)
    const billNo = `${s.name.split(' ')[0].slice(0, 3).toUpperCase()}/${day.slice(5, 7)}${day.slice(8)}/${branch}`
    purchases.push([++pid, orgId, +branch, s.id, day, billNo, total, null])
    ms.forEach((m) => pitems.push([pid, m.item_id, m.qty, m.cost]))
    vs.push({ day, type: 'Purchase', branch: +branch, purchase: pid, party: L.supplier(s.id), narration: `Bought from ${s.name}, bill ${billNo}, on credit`,
      lines: [...gstLines(L, 'Purchase', ms.map((m) => ({ amount: m.qty * m.cost, rate: m.gst_rate })), s.state !== 'Goa'), { ledgerId: L.supplier(s.id), amount: -total }] })
    const payDay = addDays(day, 18) // suppliers give ~18 days' credit; the latest bills are still unpaid
    if (payDay < T) vs.push({ day: payDay, type: 'Payment', branch: null, party: L.supplier(s.id), narration: `Paid ${s.name} by NEFT, bill ${billNo}`,
      lines: [{ ledgerId: L.supplier(s.id), amount: total }, { ledgerId: HDFC, amount: -total }] })
  }

  // Running costs of a three-branch business
  const exp = (day: string, name: string, amount: number, from: number, branch: number | null, note: string, gst = 0) => {
    const tax = amount - Math.round((amount * 100) / (100 + gst))
    vs.push({ day, type: 'Payment', branch, party: L.get(name), narration: `${name} · ${note}`,
      lines: [{ ledgerId: L.get(name), amount: amount - tax }, { ledgerId: L.get('Input CGST'), amount: Math.floor(tax / 2) }, { ledgerId: L.get('Input SGST'), amount: tax - Math.floor(tax / 2) }, { ledgerId: from, amount: -amount }] })
  }
  for (let d = day0; d < T; d = addDays(d, 1)) {
    const dom = +d.slice(8)
    branches.forEach((b, i) => {
      if (dom === 1) exp(d, 'Rent', RENT[i], HDFC, b.id, `${b.name} shop, ${d.slice(0, 7)}`)
      if (dom === 2) exp(d, 'Salaries & Wages', SALARY[i], SBI, b.id, `${b.name} staff, ${d.slice(0, 7)}`)
      if (dom === 10) exp(d, 'Electricity', 5200 + i * 900 + ((+d.slice(5, 7) * 37) % 9) * 110, HDFC, b.id, `${b.name} meter`)
      if (weekday(d) === 1) exp(d, 'Transport & Hamali', 1400 + ((dom * 53 + i * 17) % 13) * 100, L.cash(b.id), b.id, 'tempo and loading')
    })
    if (dom === 5) exp(d, 'Telephone & Internet', 3540, HDFC, null, 'Airtel business plan, all branches', 18)
    if (dom === 1) vs.push({ day: d, type: 'Payment', branch: null, party: owner, narration: 'Owner took money for household',
      lines: [{ ledgerId: owner, amount: 40000 }, { ledgerId: HDFC, amount: -40000 }] })
    if (addDays(d, 1).slice(8) === '01') for (const bank of [HDFC, SBI])
      vs.push({ day: d, type: 'Payment', branch: null, party: L.get('Bank Charges'), narration: 'Bank charges for the month',
        lines: [{ ledgerId: L.get('Bank Charges'), amount: 354 }, { ledgerId: bank, amount: -354 }] })
  }

  // Saturday: each branch deposits cash above a ₹15,000 float (Ponda banks with SBI). Needs balances day by day.
  const delta = new Map<string, number>()
  for (const v of vs) for (const l of v.lines) delta.set(`${l.ledgerId}|${v.day}`, (delta.get(`${l.ledgerId}|${v.day}`) ?? 0) + l.amount)
  const cash = branches.map((b) => ({ id: L.cash(b.id), branch: b.id, bank: b.id === 3 ? SBI : HDFC, bal: 15000 }))
  const banks = new Map([[HDFC, 0], [SBI, 0]]), low = new Map([[HDFC, 0], [SBI, 0]])
  for (let d = day0; d < T; d = addDays(d, 1)) {
    for (const c of cash) c.bal += delta.get(`${c.id}|${d}`) ?? 0
    for (const [b] of banks) banks.set(b, banks.get(b)! + (delta.get(`${b}|${d}`) ?? 0))
    if (weekday(d) === 6) for (const c of cash) {
      const amt = Math.floor((c.bal - 15000) / 1000) * 1000
      if (amt <= 0) continue
      vs.push({ day: d, type: 'Contra', branch: c.branch, party: null, narration: `Cash deposited: ${L.rows.find((r) => r.id === c.id)!.name} → ${L.rows.find((r) => r.id === c.bank)!.name}`,
        lines: [{ ledgerId: c.bank, amount: amt }, { ledgerId: c.id, amount: -amt }] })
      c.bal -= amt
      banks.set(c.bank, banks.get(c.bank)! + amt)
    }
    for (const [b, v] of banks) low.set(b, Math.min(low.get(b)!, v))
  }

  // Opening balances: enough in each bank never to go overdrawn; capital is everything the owner brought in.
  const round = (n: number) => Math.ceil(n / 50000) * 50000
  const opening = new Map<number, number>([[HDFC, round(-low.get(HDFC)! + 250000)], [SBI, round(-low.get(SBI)! + 150000)], ...cash.map((c) => [c.id, 15000] as [number, number])])
  const openingStock = await stockValue(orgId, addDays(day0, -1))
  const capital = [...opening.values()].reduce((a, b) => a + b, 0) + openingStock

  await tx(async (t) => {
    for (const [id, amt] of opening) await t.execute({ sql: 'UPDATE ledgers SET opening=? WHERE id=?', args: [amt, id] })
    await t.execute({ sql: `UPDATE ledgers SET opening=? WHERE org_id=? AND kind='capital'`, args: [-capital, orgId] })
    await bulk(t, 'purchases', ['id', 'org_id', 'branch_id', 'supplier_id', 'day', 'bill_no', 'total', 'user_id'], purchases)
    await bulk(t, 'purchase_items', ['purchase_id', 'item_id', 'qty', 'rate'], pitems)
    vs.sort((a, b) => a.day.localeCompare(b.day))
    const seq: Record<string, number> = {}
    const PRE: Record<string, string> = { Receipt: 'RCT', Payment: 'PMT', Contra: 'CTR', Purchase: 'PUR' }
    const vrows: any[][] = [], lrows: any[][] = []
    vs.forEach((v, i) => {
      const merged = new Map<number, number>()
      for (const l of v.lines) merged.set(l.ledgerId, (merged.get(l.ledgerId) ?? 0) + l.amount)
      if ([...merged.values()].reduce((a, b) => a + b, 0) !== 0) throw new Error(`Seed voucher does not balance: ${v.narration}`)
      const number = v.number ?? `${PRE[v.type]}-${String((seq[v.type] = (seq[v.type] ?? 0) + 1)).padStart(5, '0')}`
      vrows.push([i + 1, orgId, v.branch, v.type, number, v.day, v.narration, v.party, v.sale ?? null, v.payment ?? null, v.purchase ?? null, v.source ?? 'pos', v.user ?? null, `${v.day} 18:00:00`])
      for (const [ledgerId, amount] of merged) if (amount) lrows.push([i + 1, ledgerId, amount])
    })
    await bulk(t, 'vouchers', ['id', 'org_id', 'branch_id', 'type', 'number', 'day', 'narration', 'party_ledger_id', 'sale_id', 'payment_id', 'purchase_id', 'source', 'user_id', 'ts'], vrows)
    await bulk(t, 'voucher_lines', ['voucher_id', 'ledger_id', 'amount'], lrows)
    // The bank statement shows everything a day later, except the last three days (left to reconcile)
    await t.execute({ sql: `UPDATE voucher_lines SET bank_date = (SELECT date(v.day, '+1 day') FROM vouchers v WHERE v.id=voucher_lines.voucher_id)
      WHERE ledger_id IN (?,?) AND voucher_id IN (SELECT id FROM vouchers WHERE org_id=? AND day < ?)`, args: [HDFC, SBI, orgId, addDays(T, -3)] })
    for (const [name, days] of [['Kamat Infra', 45], ['Calangute Villas Pvt Ltd', 60], ['Lobo Contractors', 15]] as const)
      await t.execute({ sql: 'UPDATE customers SET credit_days=? WHERE org_id=? AND name=?', args: [days, orgId, name] })
  })
  return { vouchers: vs.length }
}
