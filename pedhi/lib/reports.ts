// Tally's reports, computed from voucher lines. Stock is valued at item cost excluding GST (the GST is input credit).
import { one, q } from './db'
import { addDays } from './format'
import { GROUPS, gstSplit } from './books'

export const booksFrom = async (orgId: number) => (await one<any>('SELECT books_from FROM orgs WHERE id=?', [orgId]))?.books_from as string

/** Closing stock value on a date: quantity from stock movements up to that day × cost before GST. */
export async function stockValue(orgId: number, asOf: string, branchId?: number | null) {
  const rows = await q<any>(
    `SELECT i.cost, i.gst_rate, SUM(m.qty) qty FROM stock_moves m JOIN items i ON i.id=m.item_id
     WHERE m.org_id=? AND m.day <= ?${branchId ? ` AND m.branch_id=${Number(branchId)}` : ''} GROUP BY m.item_id`, [orgId, asOf])
  return rows.reduce((s, r) => s + Math.round((Math.max(0, r.qty) * r.cost * 100) / (100 + r.gst_rate)), 0)
}

export type Bal = { id: number; name: string; grp: string; kind: string; opening: number; dr: number; cr: number; closing: number }
/** Every ledger: opening (before `from`), debits and credits in the period, closing. */
export async function ledgerBalances(orgId: number, from: string, to: string, branchId?: number | null): Promise<Bal[]> {
  return q<Bal>(
    `SELECT l.id, l.name, l.grp, l.kind, l.opening + COALESCE(a.before,0) opening, COALESCE(a.dr,0) dr, COALESCE(a.cr,0) cr,
       l.opening + COALESCE(a.total,0) closing
     FROM ledgers l LEFT JOIN (
       SELECT vl.ledger_id, SUM(CASE WHEN v.day < ? THEN vl.amount ELSE 0 END) before,
         SUM(CASE WHEN v.day >= ? AND vl.amount > 0 THEN vl.amount ELSE 0 END) dr,
         SUM(CASE WHEN v.day >= ? AND vl.amount < 0 THEN -vl.amount ELSE 0 END) cr, SUM(vl.amount) total
       FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id WHERE v.org_id=? AND v.day <= ?${branchId ? ` AND v.branch_id=${Number(branchId)}` : ''} GROUP BY vl.ledger_id) a ON a.ledger_id=l.id
     WHERE l.org_id=? ORDER BY l.grp, l.name`, [from, from, from, orgId, to, orgId])
}

export async function trialBalance(orgId: number, to: string) {
  const start = await booksFrom(orgId)
  const rows = (await ledgerBalances(orgId, start, to)).filter((r) => r.closing !== 0)
  const openingStock = await stockValue(orgId, addDays(start, -1))
  const lines = [
    ...rows.map((r) => ({ id: r.id, name: r.name, grp: r.grp, debit: r.closing > 0 ? r.closing : 0, credit: r.closing < 0 ? -r.closing : 0 })),
    { id: 0, name: 'Opening Stock', grp: 'Stock-in-Hand', debit: openingStock, credit: 0 },
  ].sort((a, b) => (GROUPS[a.grp]?.order ?? 6.5) - (GROUPS[b.grp]?.order ?? 6.5) || a.name.localeCompare(b.name))
  return { lines, debit: lines.reduce((s, l) => s + l.debit, 0), credit: lines.reduce((s, l) => s + l.credit, 0) }
}

/** With a branch: that branch's sales, purchases, stock and its own expenses. Costs not tied to a branch
 *  (head-office rent, the owner's phone bill) are reported separately as common costs. */
export async function profitLoss(orgId: number, from: string, to: string, branchId?: number | null) {
  const bal = await ledgerBalances(orgId, from, to, branchId)
  const move = (g: string) => bal.filter((b) => b.grp === g).map((b) => ({ id: b.id, name: b.name, amount: b.dr - b.cr })).filter((b) => b.amount)
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0)
  const sales = move('Sales Accounts').map((x) => ({ ...x, amount: -x.amount }))
  const purchases = move('Purchase Accounts'), direct = move('Direct Expenses'), indirect = move('Indirect Expenses')
  const incomes = move('Indirect Incomes').map((x) => ({ ...x, amount: -x.amount }))
  const openingStock = await stockValue(orgId, addDays(from, -1), branchId), closingStock = await stockValue(orgId, to, branchId)
  const common = branchId ? ((await one<any>(`SELECT COALESCE(SUM(vl.amount),0) s FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id JOIN ledgers l ON l.id=vl.ledger_id
     WHERE v.org_id=? AND v.branch_id IS NULL AND v.day BETWEEN ? AND ? AND l.grp IN ('Indirect Expenses','Direct Expenses')`, [orgId, from, to]))!.s as number) : 0
  const gross = sum(sales) + closingStock - openingStock - sum(purchases) - sum(direct)
  const net = gross + sum(incomes) - sum(indirect)
  return { from, to, sales, purchases, direct, indirect, incomes, openingStock, closingStock, gross, net, common,
    totals: { sales: sum(sales), purchases: sum(purchases), direct: sum(direct), indirect: sum(indirect), incomes: sum(incomes) } }
}

export async function balanceSheet(orgId: number, to: string) {
  const start = await booksFrom(orgId)
  const bal = await ledgerBalances(orgId, start, to)
  const pl = await profitLoss(orgId, start, to)
  const groups = new Map<string, { name: string; amount: number }[]>()
  for (const b of bal) {
    const g = GROUPS[b.grp]
    if (!g || g.nature === 'income' || g.nature === 'expense' || !b.closing) continue
    groups.set(b.grp, [...(groups.get(b.grp) ?? []), { name: b.name, amount: b.closing }])
  }
  const side = (dr: boolean) => [...groups].map(([grp, ls]) => ({ grp, total: ls.reduce((s, l) => s + l.amount, 0), ledgers: ls }))
    .filter((g) => (dr ? g.total > 0 : g.total < 0)).map((g) => ({ ...g, total: Math.abs(g.total), ledgers: g.ledgers.map((l) => ({ ...l, amount: dr ? l.amount : -l.amount })) }))
    .sort((a, b) => GROUPS[a.grp].order - GROUPS[b.grp].order)
  const liabilities = side(false), assets = side(true)
  assets.push({ grp: 'Closing Stock', total: pl.closingStock, ledgers: [] })
  liabilities.push({ grp: pl.net >= 0 ? 'Profit & Loss A/c (profit)' : 'Profit & Loss A/c (loss)', total: pl.net, ledgers: [] })
  const total = (xs: { total: number }[]) => xs.reduce((s, x) => s + x.total, 0)
  return { to, assets, liabilities, totalAssets: total(assets), totalLiabilities: total(liabilities), profit: pl.net }
}

export async function dayBook(orgId: number, from: string, to: string, type?: string, branchId?: number | null) {
  const vs = await q<any>(
    `SELECT v.*, pl.name party, u.name user, b.name branch FROM vouchers v LEFT JOIN ledgers pl ON pl.id=v.party_ledger_id
     LEFT JOIN users u ON u.id=v.user_id LEFT JOIN branches b ON b.id=v.branch_id
     WHERE v.org_id=? AND v.day BETWEEN ? AND ?${type ? ' AND v.type=?' : ''}${branchId ? ` AND v.branch_id=${Number(branchId)}` : ''}
     ORDER BY v.day DESC, v.id DESC LIMIT 500`, type ? [orgId, from, to, type] : [orgId, from, to])
  if (!vs.length) return []
  const lines = await q<any>(`SELECT vl.voucher_id, vl.amount, l.id ledger_id, l.name, l.grp FROM voucher_lines vl JOIN ledgers l ON l.id=vl.ledger_id
     WHERE vl.voucher_id IN (${vs.map((v) => v.id).join(',')}) ORDER BY vl.amount DESC`)
  return vs.map((v) => {
    const ls = lines.filter((l) => l.voucher_id === v.id)
    return { ...v, lines: ls, amount: ls.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0) }
  })
}

export async function ledgerStatement(orgId: number, ledgerId: number, from: string, to: string) {
  const l = await one<any>('SELECT * FROM ledgers WHERE id=? AND org_id=?', [ledgerId, orgId])
  if (!l) return null
  const opening = l.opening + ((await one<any>(`SELECT COALESCE(SUM(vl.amount),0) s FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
     WHERE vl.ledger_id=? AND v.day < ?`, [ledgerId, from]))!.s as number)
  const rows = await q<any>(
    `SELECT v.id, v.day, v.type, v.number, v.narration, vl.amount,
       (SELECT GROUP_CONCAT(l2.name, ', ') FROM voucher_lines o JOIN ledgers l2 ON l2.id=o.ledger_id WHERE o.voucher_id=v.id AND o.ledger_id != ? AND (o.amount > 0) != (vl.amount > 0)) against
     FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id WHERE vl.ledger_id=? AND v.day BETWEEN ? AND ? ORDER BY v.day, v.id`,
    [ledgerId, ledgerId, from, to])
  let bal = opening
  return { ledger: l, opening, rows: rows.map((r) => ({ ...r, balance: (bal += r.amount) })), closing: bal }
}

/** GSTR-1 and GSTR-3B summaries for a month. Pedhi prepares the numbers; filing stays with the owner or CA. */
export async function gstSummary(orgId: number, month: string) {
  const from = `${month}-01`, to = addDays(addDays(from, 32).slice(0, 8) + '01', -1)
  const lines = await q<any>(
    `SELECT s.id, s.invoice_no, s.day, s.customer_id, c.name, c.gstin, c.state, o.state ostate, i.gst_rate rate, i.hsn, i.unit, si.qty, si.qty*si.price amount
     FROM sales s JOIN sale_items si ON si.sale_id=s.id JOIN items i ON i.id=si.item_id JOIN orgs o ON o.id=s.org_id LEFT JOIN customers c ON c.id=s.customer_id
     WHERE s.org_id=? AND s.day BETWEEN ? AND ?`, [orgId, from, to])
  // invoice × rate is how the vouchers split GST, so the totals here match the books exactly
  const inv = new Map<string, any>()
  for (const l of lines) {
    const k = `${l.id}:${l.rate}`
    const e = inv.get(k) ?? { id: l.id, invoice_no: l.invoice_no, day: l.day, name: l.name, gstin: l.gstin, rate: l.rate, inter: !!l.state && l.state !== l.ostate, amount: 0 }
    e.amount += l.amount
    inv.set(k, e)
  }
  const rows = [...inv.values()].map((e) => ({ ...e, ...gstSplit(e.amount, e.rate, e.inter) }))
  // Goods returned this month (credit notes): split like the voucher did, then subtract
  const neg = (x: { taxable: number; cgst: number; sgst: number; igst: number }) => ({ taxable: -x.taxable, cgst: -x.cgst, sgst: -x.sgst, igst: -x.igst })
  const rlines = await q<any>(
    `SELECT r.id rid, s.invoice_no, r.day, c.name, c.gstin, c.state, o.state ostate, i.gst_rate rate, i.hsn, i.unit, ri.qty, ri.qty*ri.price amount
     FROM returns r JOIN return_items ri ON ri.return_id=r.id JOIN sales s ON s.id=r.sale_id JOIN items i ON i.id=ri.item_id JOIN orgs o ON o.id=r.org_id
     LEFT JOIN customers c ON c.id=s.customer_id WHERE r.org_id=? AND r.kind='sale' AND r.day BETWEEN ? AND ?`, [orgId, from, to])
  const rinv = new Map<string, any>()
  for (const l of rlines) {
    const k = `${l.rid}:${l.rate}`
    const e = rinv.get(k) ?? { rid: l.rid, invoice_no: l.invoice_no, day: l.day, name: l.name, gstin: l.gstin, rate: l.rate, inter: !!l.state && l.state !== l.ostate, amount: 0 }
    e.amount += l.amount
    rinv.set(k, e)
  }
  const returnsRows = [...rinv.values()].map((e) => ({ ...e, ...neg(gstSplit(e.amount, e.rate, e.inter)) }))
  const add = (a: any, r: any) => ({ taxable: a.taxable + r.taxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst })
  const zero = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  const b2bMap = new Map<number, any>()
  for (const r of rows.filter((r) => r.gstin)) b2bMap.set(r.id, { invoice_no: r.invoice_no, day: r.day, name: r.name, gstin: r.gstin, inter: r.inter, ...add(b2bMap.get(r.id) ?? zero, r), value: (b2bMap.get(r.id)?.value ?? 0) + r.amount })
  const b2cs = new Map<number, any>()
  for (const r of [...rows, ...returnsRows].filter((r) => !r.gstin)) b2cs.set(r.rate, { rate: r.rate, ...add(b2cs.get(r.rate) ?? zero, r) })
  const cdnMap = new Map<number, any>()
  for (const r of returnsRows.filter((r) => r.gstin)) cdnMap.set(r.rid, { note: `CRN on ${r.invoice_no}`, invoice_no: r.invoice_no, day: r.day, name: r.name, gstin: r.gstin, inter: r.inter, ...add(cdnMap.get(r.rid) ?? zero, r) })
  const hsnMap = new Map<string, any>()
  for (const l of lines) {
    const k = `${l.hsn}:${l.rate}`
    const s = gstSplit(l.amount, l.rate, !!l.state && l.state !== l.ostate)
    const e = hsnMap.get(k) ?? { hsn: l.hsn, rate: l.rate, unit: l.unit, qty: 0, ...zero }
    hsnMap.set(k, { ...e, qty: e.qty + l.qty, ...add(e, s) })
  }
  for (const l of rlines) {
    const k = `${l.hsn}:${l.rate}`
    const s = neg(gstSplit(l.amount, l.rate, !!l.state && l.state !== l.ostate))
    const e = hsnMap.get(k) ?? { hsn: l.hsn, rate: l.rate, unit: l.unit, qty: 0, ...zero }
    hsnMap.set(k, { ...e, qty: e.qty - l.qty, ...add(e, s) })
  }

  const led = await ledgerBalances(orgId, from, to)
  const mv = (name: string) => { const b = led.find((x) => x.name === name); return b ? b.dr - b.cr : 0 }
  const out = { taxable: -led.filter((b) => b.grp === 'Sales Accounts').reduce((s, b) => s + b.dr - b.cr, 0), igst: -mv('Output IGST'), cgst: -mv('Output CGST'), sgst: -mv('Output SGST') }
  const itc = { igst: mv('Input IGST'), cgst: mv('Input CGST'), sgst: mv('Input SGST') }
  // Credit use order under GST law: IGST credit first against IGST, then CGST, then SGST; CGST and SGST credit never cross.
  let ig = itc.igst
  const pay = { igst: out.igst, cgst: out.cgst, sgst: out.sgst }
  const use = (k: 'igst' | 'cgst' | 'sgst') => { const u = Math.min(ig, pay[k]); pay[k] -= u; ig -= u }
  use('igst'); use('cgst'); use('sgst')
  const c = Math.min(itc.cgst, pay.cgst), sg = Math.min(itc.sgst, pay.sgst)
  pay.cgst -= c; pay.sgst -= sg
  const carry = { igst: ig, cgst: itc.cgst - c, sgst: itc.sgst - sg }

  const b2b = [...b2bMap.values()].sort((a, b) => a.day.localeCompare(b.day))
  return {
    month, from, to, b2b, b2cs: [...b2cs.values()].sort((a, b) => a.rate - b.rate), hsn: [...hsnMap.values()].sort((a, b) => a.hsn.localeCompare(b.hsn)),
    cdnr: [...cdnMap.values()], totals: [...rows, ...returnsRows].reduce(add, zero), r3b: { out, itc, pay, carry, cash: pay.igst + pay.cgst + pay.sgst },
  }
}

export async function outstanding(orgId: number, grp: 'Sundry Debtors' | 'Sundry Creditors', to: string) {
  const start = await booksFrom(orgId)
  return (await ledgerBalances(orgId, start, to)).filter((b) => b.grp === grp && b.closing !== 0)
    .map((b) => ({ id: b.id, name: b.name, amount: grp === 'Sundry Creditors' ? -b.closing : b.closing })).sort((a, b) => b.amount - a.amount)
}

/** Bank reconciliation: entries in the books that the bank statement does not show yet (as on a date). */
export async function bankReco(orgId: number, ledgerId: number, to: string) {
  const l = await one<any>(`SELECT * FROM ledgers WHERE id=? AND org_id=? AND grp='Bank Accounts'`, [ledgerId, orgId])
  if (!l) return null
  const books = l.opening + ((await one<any>(`SELECT COALESCE(SUM(vl.amount),0) s FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id WHERE vl.ledger_id=? AND v.day <= ?`, [ledgerId, to]))!.s as number)
  const open = await q<any>(`SELECT vl.id, v.day, v.type, v.number, v.narration, vl.amount FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
     WHERE vl.ledger_id=? AND v.day <= ? AND (vl.bank_date IS NULL OR vl.bank_date > ?) ORDER BY v.day DESC, v.id DESC`, [ledgerId, to, to])
  const cleared = await q<any>(`SELECT vl.id, v.day, v.number, v.narration, vl.amount, vl.bank_date FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
     WHERE vl.ledger_id=? AND vl.bank_date IS NOT NULL AND vl.bank_date <= ? ORDER BY vl.bank_date DESC, v.id DESC LIMIT 15`, [ledgerId, to])
  const pendingIn = open.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0)
  const pendingOut = open.filter((x) => x.amount < 0).reduce((s, x) => s - x.amount, 0)
  return { ledger: l, books, pendingIn, pendingOut, bank: books - pendingIn + pendingOut, open, cleared }
}
