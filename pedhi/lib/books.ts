// Pedhi Books: the owner picks a plain action, this module writes the Tally-style voucher.
// Ledgers sit under Tally's own group names; every voucher's lines sum to zero (debit +, credit −).
import type { Transaction } from '@libsql/client'
import { one, q, run, tx, type Row } from './db'
import { nowTs, today } from './format'
import { OpError, audit } from './errors'
import type { User } from './session'

type Exec = Transaction
export const RATES = [0, 5, 12, 18, 28]

/** Tally group → which side of the books it belongs to. */
export const GROUPS: Record<string, { nature: 'asset' | 'liability' | 'income' | 'expense'; primary: string; order: number }> = {
  'Capital Account': { nature: 'liability', primary: 'Capital Account', order: 1 },
  'Loans (Liability)': { nature: 'liability', primary: 'Loans (Liability)', order: 2 },
  'Sundry Creditors': { nature: 'liability', primary: 'Current Liabilities', order: 3 },
  'Duties & Taxes': { nature: 'liability', primary: 'Current Liabilities', order: 4 },
  'Fixed Assets': { nature: 'asset', primary: 'Fixed Assets', order: 5 },
  'Sundry Debtors': { nature: 'asset', primary: 'Current Assets', order: 6 },
  'Cash-in-Hand': { nature: 'asset', primary: 'Current Assets', order: 7 },
  'Bank Accounts': { nature: 'asset', primary: 'Current Assets', order: 8 },
  'Sales Accounts': { nature: 'income', primary: 'Sales Accounts', order: 9 },
  'Purchase Accounts': { nature: 'expense', primary: 'Purchase Accounts', order: 10 },
  'Direct Expenses': { nature: 'expense', primary: 'Direct Expenses', order: 11 },
  'Indirect Expenses': { nature: 'expense', primary: 'Indirect Expenses', order: 12 },
  'Indirect Incomes': { nature: 'income', primary: 'Indirect Incomes', order: 13 },
  'Provisions': { nature: 'liability', primary: 'Current Liabilities', order: 3.5 },
  'Investments': { nature: 'asset', primary: 'Investments', order: 5.5 },
  'Loans & Advances (Asset)': { nature: 'asset', primary: 'Current Assets', order: 5.7 },
  'Deposits (Asset)': { nature: 'asset', primary: 'Current Assets', order: 5.8 },
}
/** Groups a user may open a new ledger under. Customers, suppliers and banks have their own forms. */
export const OPEN_GROUPS = ['Fixed Assets', 'Loans (Liability)', 'Loans & Advances (Asset)', 'Deposits (Asset)', 'Investments', 'Capital Account',
  'Provisions', 'Duties & Taxes', 'Direct Expenses', 'Indirect Expenses', 'Indirect Incomes']

export const EXPENSES: { name: string; grp: string; words: string[] }[] = [
  { name: 'Rent', grp: 'Indirect Expenses', words: ['rent', 'kiraya', 'bhada'] },
  { name: 'Salaries & Wages', grp: 'Indirect Expenses', words: ['salary', 'salaries', 'wages', 'pagar', 'tankha', 'tankhwah'] },
  { name: 'Electricity', grp: 'Indirect Expenses', words: ['electricity', 'light bill', 'bijli', 'light'] },
  { name: 'Transport & Hamali', grp: 'Indirect Expenses', words: ['transport', 'tempo', 'hamali', 'auto', 'delivery', 'bhada gadi'] },
  { name: 'Freight Inward', grp: 'Direct Expenses', words: ['freight', 'truck', 'loading', 'unloading'] },
  { name: 'Telephone & Internet', grp: 'Indirect Expenses', words: ['phone', 'mobile', 'internet', 'wifi', 'recharge', 'telephone'] },
  { name: 'Repairs & Maintenance', grp: 'Indirect Expenses', words: ['repair', 'maintenance', 'mistri', 'service'] },
  { name: 'Office Expenses', grp: 'Indirect Expenses', words: ['office', 'stationery', 'chai', 'tea', 'cleaning', 'pooja'] },
  { name: 'Bank Charges', grp: 'Indirect Expenses', words: ['bank charges', 'bank charge', 'charges'] },
]

/** Creates the standard chart of accounts for a business. Idempotent. */
export async function ensureChart(orgId: number, t?: Exec) {
  const add = (name: string, grp: string, kind: string, extra: Record<string, unknown> = {}) =>
    run(`INSERT OR IGNORE INTO ledgers (org_id, name, grp, kind, branch_id, customer_id, supplier_id, rate) VALUES (?,?,?,?,?,?,?,?)`,
      [orgId, name, grp, kind, (extra.branch_id as number) ?? null, (extra.customer_id as number) ?? null, (extra.supplier_id as number) ?? null, (extra.rate as number) ?? null], t)
  const owner = await one<any>(`SELECT name FROM users WHERE org_id=? AND role='owner' ORDER BY id LIMIT 1`, [orgId], t)
  await add(`Capital - ${owner?.name ?? 'Owner'}`, 'Capital Account', 'capital')
  await add(`Drawings - ${owner?.name ?? 'Owner'}`, 'Capital Account', 'drawings')
  for (const b of await q<any>('SELECT id, name FROM branches WHERE org_id=?', [orgId], t)) await add(`Cash - ${b.name}`, 'Cash-in-Hand', 'cash', { branch_id: b.id })
  for (const r of RATES) {
    await add(`Sales @${r}%`, 'Sales Accounts', 'sales', { rate: r })
    await add(`Purchase @${r}%`, 'Purchase Accounts', 'purchase', { rate: r })
  }
  for (const k of ['CGST', 'SGST', 'IGST']) {
    await add(`Output ${k}`, 'Duties & Taxes', 'tax_out')
    await add(`Input ${k}`, 'Duties & Taxes', 'tax_in')
  }
  for (const e of EXPENSES) await add(e.name, e.grp, 'expense')
  await add('Discount Received', 'Indirect Incomes', 'income')
  await add('Cash Shortage & Excess', 'Indirect Expenses', 'cash_diff')
  await add('Discount Allowed', 'Indirect Expenses', 'expense')
  await add('Bad Debts Written Off', 'Indirect Expenses', 'expense')
  await add('Delivery & Other Charges', 'Indirect Incomes', 'income')
  await add('Interest Paid', 'Indirect Expenses', 'expense')
  await add('Depreciation', 'Indirect Expenses', 'expense')
  await add('Furniture & Fixtures', 'Fixed Assets', 'asset')
  await add('Computers & Equipment', 'Fixed Assets', 'asset')
  for (const c of await q<any>('SELECT id, name FROM customers WHERE org_id=?', [orgId], t)) await add(c.name, 'Sundry Debtors', 'customer', { customer_id: c.id })
  for (const s of await q<any>('SELECT id, name FROM suppliers WHERE org_id=?', [orgId], t)) await add(s.name, 'Sundry Creditors', 'supplier', { supplier_id: s.id })
}

export type Ledger = { id: number; name: string; grp: string; kind: string; branch_id: number | null; customer_id: number | null; supplier_id: number | null; rate: number | null; opening: number }
export async function ledgerMap(orgId: number, t?: Exec) {
  const rows = await q<Ledger>('SELECT * FROM ledgers WHERE org_id=?', [orgId], t)
  const byName = new Map(rows.map((r) => [r.name, r]))
  const get = (name: string) => {
    const l = byName.get(name)
    if (!l) throw new Error(`Missing ledger ${name}`)
    return l.id
  }
  return {
    rows, get,
    cash: (branchId: number) => rows.find((r) => r.kind === 'cash' && r.branch_id === branchId)!.id,
    bank: () => rows.find((r) => r.grp === 'Bank Accounts')!.id,
    customer: (id: number) => rows.find((r) => r.customer_id === id)!.id,
    supplier: (id: number) => rows.find((r) => r.supplier_id === id)!.id,
  }
}

/** Splits a GST-inclusive amount. Same state → CGST + SGST, other state → IGST. */
export function gstSplit(inclusive: number, rate: number, interState: boolean) {
  const taxable = Math.round((inclusive * 100) / (100 + rate))
  const tax = inclusive - taxable
  const cgst = interState ? 0 : Math.floor(tax / 2)
  return { taxable, cgst, sgst: interState ? 0 : tax - cgst, igst: interState ? tax : 0 }
}

/** Groups GST-inclusive line amounts by rate and returns the ledger lines for sales (credits) or purchases (debits). */
function gstLines(L: Awaited<ReturnType<typeof ledgerMap>>, kind: 'Sales' | 'Purchase', lines: { amount: number; rate: number }[], interState: boolean) {
  const byRate = new Map<number, number>()
  for (const l of lines) byRate.set(l.rate, (byRate.get(l.rate) ?? 0) + l.amount)
  const sign = kind === 'Sales' ? -1 : 1
  const pre = kind === 'Sales' ? 'Output' : 'Input'
  const out: { ledgerId: number; amount: number }[] = []
  const tax = { CGST: 0, SGST: 0, IGST: 0 }
  for (const [rate, amt] of byRate) {
    const s = gstSplit(amt, rate, interState)
    out.push({ ledgerId: L.get(`${kind} @${rate}%`), amount: sign * s.taxable })
    tax.CGST += s.cgst; tax.SGST += s.sgst; tax.IGST += s.igst
  }
  for (const [k, v] of Object.entries(tax)) if (v) out.push({ ledgerId: L.get(`${pre} ${k}`), amount: sign * v })
  return out
}

const PREFIX: Record<string, string> = { Receipt: 'RCT', Payment: 'PMT', Contra: 'CTR', Purchase: 'PUR', Journal: 'JRN', 'Credit Note': 'CRN', 'Debit Note': 'DBN' }

export type VoucherIn = {
  orgId: number; branchId?: number | null; type: string; day: string; narration: string; partyLedgerId?: number | null
  lines: { ledgerId: number; amount: number }[]; number?: string; saleId?: number; paymentId?: number; purchaseId?: number
  source?: string; userId?: number | null
}

export async function assertOpen(orgId: number, day: string, t?: Exec) {
  const lock = await one<any>('SELECT upto FROM period_locks WHERE org_id=? ORDER BY upto DESC LIMIT 1', [orgId], t)
  if (lock && day <= lock.upto) throw new OpError(`The books up to ${lock.upto} are signed off by your CA and locked. Ask the CA to reopen them first.`)
}

/** Writes one balanced voucher. Same-ledger lines are merged; zero lines are dropped. */
export async function postVoucher(t: Exec, v: VoucherIn) {
  const merged = new Map<number, number>()
  for (const l of v.lines) merged.set(l.ledgerId, (merged.get(l.ledgerId) ?? 0) + l.amount)
  const lines = [...merged].filter(([, a]) => a !== 0)
  const sum = lines.reduce((s, [, a]) => s + a, 0)
  if (sum !== 0 || !lines.length) throw new Error(`Voucher does not balance (${v.type} ${v.narration}: ${sum})`)
  await assertOpen(v.orgId, v.day, t)
  const number = v.number ?? `${PREFIX[v.type] ?? 'VCH'}-${String(((await one<any>('SELECT COUNT(*) n FROM vouchers WHERE org_id=? AND type=?', [v.orgId, v.type], t))!.n) + 1).padStart(5, '0')}`
  const id = await run(
    `INSERT INTO vouchers (org_id, branch_id, type, number, day, narration, party_ledger_id, sale_id, payment_id, purchase_id, source, user_id, ts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [v.orgId, v.branchId ?? null, v.type, number, v.day, v.narration, v.partyLedgerId ?? null, v.saleId ?? null, v.paymentId ?? null, v.purchaseId ?? null, v.source ?? 'pos', v.userId ?? null, nowTs()], t)
  for (const [ledgerId, amount] of lines) await run('INSERT INTO voucher_lines (voucher_id, ledger_id, amount) VALUES (?,?,?)', [id, ledgerId, amount], t)
  return { id, number }
}

// ---- Postings for things that already happen in the shop --------------------------------------

type LMap = Awaited<ReturnType<typeof ledgerMap>>
/** Ledger lines for a bill. Cash goes to the branch cash box, UPI to the main bank, udhaar to the customer. */
export function saleLines(L: LMap, s: { mode: string; total: number; branch_id: number; customer_id: number | null }, lines: { amount: number; rate: number }[], interState: boolean) {
  const party = s.mode === 'credit' ? L.customer(s.customer_id!) : s.mode === 'upi' ? L.bank() : L.cash(s.branch_id)
  return [{ ledgerId: party, amount: s.total }, ...gstLines(L, 'Sales', lines, interState)]
}
export function receiptLines(L: LMap, p: { mode: string; amount: number; branch_id: number; customer_id: number }, into?: number) {
  return [{ ledgerId: into ?? (p.mode === 'cash' ? L.cash(p.branch_id) : L.bank()), amount: p.amount }, { ledgerId: L.customer(p.customer_id), amount: -p.amount }]
}
export { gstLines }

export async function postSale(t: Exec, saleId: number) {
  const s = (await one<any>(`SELECT s.*, c.name cname, c.state cstate, o.state ostate FROM sales s JOIN orgs o ON o.id=s.org_id
    LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=?`, [saleId], t))!
  const L = await ledgerMap(s.org_id, t)
  const lines = await q<any>('SELECT si.qty*si.price amount, i.gst_rate rate FROM sale_items si JOIN items i ON i.id=si.item_id WHERE si.sale_id=?', [saleId], t)
  const vl = saleLines(L, s, lines, !!s.cstate && s.cstate !== s.ostate)
  return postVoucher(t, {
    orgId: s.org_id, branchId: s.branch_id, type: 'Sales', number: s.invoice_no, day: s.day, saleId, userId: s.user_id, source: s.source,
    narration: saleNarration(s.invoice_no, s.cname, s.mode), partyLedgerId: vl[0].ledgerId, lines: vl,
  })
}

export async function postReceipt(t: Exec, paymentId: number, accountLedgerId?: number) {
  const p = (await one<any>('SELECT p.*, c.name FROM payments p JOIN customers c ON c.id=p.customer_id WHERE p.id=?', [paymentId], t))!
  const L = await ledgerMap(p.org_id, t)
  return postVoucher(t, {
    orgId: p.org_id, branchId: p.branch_id, type: 'Receipt', day: p.day, paymentId, userId: p.user_id, source: p.source,
    narration: receiptNarration(p.name, p.mode), partyLedgerId: L.customer(p.customer_id), lines: receiptLines(L, p, accountLedgerId),
  })
}

export const saleNarration = (inv: string, cname: string | null, mode: string) =>
  `Bill ${inv}${cname ? ' to ' + cname : ' (walk-in)'}, ${mode === 'credit' ? 'on udhaar' : mode.toUpperCase()}`
export const receiptNarration = (name: string, mode: string) => `${name} paid ${mode === 'cash' ? 'in cash' : 'by UPI/bank'}`

export async function unpost(t: Exec, where: 'sale_id' | 'payment_id', id: number) {
  for (const v of await q<any>(`SELECT id, org_id, day FROM vouchers WHERE ${where}=?`, [id], t)) {
    await assertOpen(v.org_id, v.day, t)
    await run('DELETE FROM voucher_lines WHERE voucher_id=?', [v.id], t)
    await run('DELETE FROM vouchers WHERE id=?', [v.id], t)
  }
}

// ---- The plain-language actions on the Books screen --------------------------------------------

const canBook = (u: User) => {
  if (u.role === 'ca') throw new OpError('The CA login can review and sign off, not enter transactions.')
}
async function account(u: User, id: number, t?: Exec) {
  const l = await one<Ledger>('SELECT * FROM ledgers WHERE id=? AND org_id=?', [id, u.org_id], t)
  if (!l || !['Cash-in-Hand', 'Bank Accounts'].includes(l.grp)) throw new OpError('Pick a cash box or bank account.')
  if (u.branch_id && l.grp === 'Cash-in-Hand' && l.branch_id !== u.branch_id) throw new OpError(`You can only use the ${u.branch} cash box.`)
  return l
}
const amountOk = (n: number) => { if (!Number.isInteger(n) || n <= 0) throw new OpError('Enter an amount above zero.') }

export type PurchaseIn = { branchId: number; supplierId: number; billNo?: string; mode: 'credit' | 'paid'; accountId?: number; lines: { itemId: number; qty: number; rate: number; expiry?: string | null }[]; day?: string; source?: string }

/** Bought stock: adds it to the branch, books the purchase with input GST, and owes the supplier (or pays now). */
export async function recordPurchase(u: User, p: PurchaseIn) {
  canBook(u)
  if (u.branch_id && u.branch_id !== p.branchId) throw new OpError(`You can only receive stock into ${u.branch}.`)
  if (!p.lines.length || p.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0 || !(l.rate > 0))) throw new OpError('Each item needs a quantity and a rate.')
  const day = p.day ?? today()
  if (p.lines.some((l) => l.expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(l.expiry) || l.expiry <= day))) throw new OpError('An expiry date must be after the day the stock came in.')
  return tx(async (t) => {
    const sup = await one<any>('SELECT s.*, o.state ostate FROM suppliers s JOIN orgs o ON o.id=s.org_id WHERE s.id=? AND s.org_id=?', [p.supplierId, u.org_id], t)
    if (!sup) throw new OpError('Pick a supplier.')
    const items = await q<any>(`SELECT id, name, unit, gst_rate FROM items WHERE org_id=? AND id IN (${p.lines.map(() => '?').join(',')})`, [u.org_id, ...p.lines.map((l) => l.itemId)], t)
    if (items.length !== new Set(p.lines.map((l) => l.itemId)).size) throw new OpError('Unknown item.')
    const total = p.lines.reduce((s, l) => s + Math.round(l.qty * l.rate), 0)
    const pid = await run('INSERT INTO purchases (org_id, branch_id, supplier_id, day, bill_no, total, user_id) VALUES (?,?,?,?,?,?,?)', [u.org_id, p.branchId, sup.id, day, p.billNo ?? null, total, u.id], t)
    for (const l of p.lines) {
      await run('INSERT INTO purchase_items (purchase_id, item_id, qty, rate, expiry) VALUES (?,?,?,?,?)', [pid, l.itemId, l.qty, l.rate, l.expiry || null], t)
      await run('INSERT INTO stock (item_id, branch_id, qty) VALUES (?,?,?) ON CONFLICT (item_id, branch_id) DO UPDATE SET qty = qty + excluded.qty', [l.itemId, p.branchId, l.qty], t)
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)', [u.org_id, l.itemId, p.branchId, day, 'purchase', l.qty, `Bill ${p.billNo ?? pid} · ${sup.name}`, u.id], t)
    }
    const L = await ledgerMap(u.org_id, t)
    const credit = p.mode === 'paid' ? (await account(u, p.accountId!, t)).id : L.supplier(sup.id)
    const gl = gstLines(L, 'Purchase', p.lines.map((l) => ({ amount: Math.round(l.qty * l.rate), rate: items.find((i) => i.id === l.itemId)!.gst_rate })), sup.state !== sup.ostate)
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: p.branchId, type: 'Purchase', day, purchaseId: pid, userId: u.id, source: p.source,
      narration: `Bought from ${sup.name}${p.billNo ? ', bill ' + p.billNo : ''}${p.mode === 'paid' ? ', paid now' : ', on credit'}`,
      partyLedgerId: L.supplier(sup.id), lines: [...gl, { ledgerId: credit, amount: -total }],
    })
    await audit(u, u.org_id, 'purchase', `Purchase ${v.number}: ₹${total} from ${sup.name} into branch ${p.branchId}`, t)
    return { ...v, total, supplier: sup.name }
  })
}

export async function paySupplier(u: User, supplierId: number, amount: number, accountId: number, note = '') {
  canBook(u); amountOk(amount)
  return tx(async (t) => {
    const acc = await account(u, accountId, t)
    const L = await ledgerMap(u.org_id, t)
    const sup = await one<any>('SELECT name FROM suppliers WHERE id=? AND org_id=?', [supplierId, u.org_id], t)
    if (!sup) throw new OpError('Pick a supplier.')
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: acc.branch_id ?? u.branch_id, type: 'Payment', day: today(), userId: u.id, partyLedgerId: L.supplier(supplierId),
      narration: `Paid ${sup.name} from ${acc.name}${note ? ' · ' + note : ''}`,
      lines: [{ ledgerId: L.supplier(supplierId), amount }, { ledgerId: acc.id, amount: -amount }],
    })
    await audit(u, u.org_id, 'payment_out', `${v.number}: ₹${amount} paid to ${sup.name} from ${acc.name}`, t)
    return v
  })
}

/** An expense, optionally on a GST bill (then the GST becomes input credit). */
export async function recordExpense(u: User, e: { ledgerId: number; amount: number; accountId: number; gstRate?: number; note?: string }) {
  canBook(u); amountOk(e.amount)
  return tx(async (t) => {
    const acc = await account(u, e.accountId, t)
    const exp = await one<Ledger>('SELECT * FROM ledgers WHERE id=? AND org_id=?', [e.ledgerId, u.org_id], t)
    if (!exp || !['Indirect Expenses', 'Direct Expenses'].includes(exp.grp)) throw new OpError('Pick what the money was spent on.')
    const L = await ledgerMap(u.org_id, t)
    const g = gstSplit(e.amount, e.gstRate ?? 0, false)
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: acc.branch_id ?? u.branch_id, type: 'Payment', day: today(), userId: u.id, partyLedgerId: exp.id,
      narration: `${exp.name}${e.note ? ' · ' + e.note : ''}, paid from ${acc.name}`,
      lines: [{ ledgerId: exp.id, amount: g.taxable }, { ledgerId: L.get('Input CGST'), amount: g.cgst }, { ledgerId: L.get('Input SGST'), amount: g.sgst }, { ledgerId: acc.id, amount: -e.amount }],
    })
    await audit(u, u.org_id, 'expense', `${v.number}: ₹${e.amount} ${exp.name} from ${acc.name}`, t)
    return v
  })
}

/** Contra: cash to bank, bank to cash, or bank to bank. */
export async function moveMoney(u: User, fromId: number, toId: number, amount: number) {
  canBook(u); amountOk(amount)
  if (fromId === toId) throw new OpError('Pick two different accounts.')
  return tx(async (t) => {
    const [a, b] = [await account(u, fromId, t), await account(u, toId, t)]
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: a.branch_id ?? b.branch_id, type: 'Contra', day: today(), userId: u.id,
      narration: `${a.name} → ${b.name}`, lines: [{ ledgerId: b.id, amount }, { ledgerId: a.id, amount: -amount }],
    })
    await audit(u, u.org_id, 'contra', `${v.number}: ₹${amount} moved ${a.name} → ${b.name}`, t)
    return v
  })
}

/** Owner takes money home (drawings) or puts money in (capital). */
export async function ownerMoney(u: User, dir: 'take' | 'add', amount: number, accountId: number) {
  canBook(u); amountOk(amount)
  if (u.role !== 'owner' && u.role !== 'family') throw new OpError('Only the family can record owner money.')
  return tx(async (t) => {
    const acc = await account(u, accountId, t)
    const L = await ledgerMap(u.org_id, t)
    const cap = L.rows.find((r) => r.kind === (dir === 'take' ? 'drawings' : 'capital'))!
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: acc.branch_id, type: dir === 'take' ? 'Payment' : 'Receipt', day: today(), userId: u.id, partyLedgerId: cap.id,
      narration: dir === 'take' ? `Owner took money from ${acc.name}` : `Owner added money to ${acc.name}`,
      lines: dir === 'take' ? [{ ledgerId: cap.id, amount }, { ledgerId: acc.id, amount: -amount }] : [{ ledgerId: acc.id, amount }, { ledgerId: cap.id, amount: -amount }],
    })
    await audit(u, u.org_id, 'owner_money', `${v.number}: owner ${dir === 'take' ? 'took' : 'added'} ₹${amount} (${acc.name})`, t)
    return v
  })
}

export async function addBank(u: User, name: string, opening: number) {
  canBook(u)
  if (u.role !== 'owner' && u.role !== 'family') throw new OpError('Only the family can add bank accounts.')
  const n = name.trim()
  if (n.length < 3) throw new OpError('Give the account a name, like "Axis Bank - Current".')
  return tx(async (t) => {
    const L = await ledgerMap(u.org_id, t)
    if (L.rows.some((r) => r.name.toLowerCase() === n.toLowerCase())) throw new OpError('An account with that name already exists.')
    const id = await run(`INSERT INTO ledgers (org_id, name, grp, kind) VALUES (?,?,?,?)`, [u.org_id, n, 'Bank Accounts', 'bank'], t)
    // An opening balance is the owner's own money already in the account: bank Dr, capital Cr.
    if (opening > 0) await postVoucher(t, {
      orgId: u.org_id, type: 'Receipt', day: today(), userId: u.id, narration: `Opening balance of ${n}`,
      lines: [{ ledgerId: id, amount: opening }, { ledgerId: L.rows.find((r) => r.kind === 'capital')!.id, amount: -opening }],
    })
    await audit(u, u.org_id, 'bank_added', `New bank account ${n}${opening ? ` with ₹${opening}` : ''}`, t)
    return id
  })
}

export async function addSupplier(u: User, s: { name: string; phone?: string; gstin?: string; state?: string }) {
  canBook(u)
  const name = s.name.trim()
  if (name.length < 2) throw new OpError('Enter the supplier name.')
  const g = checkGstin(s.gstin)
  const gstin = g.gstin, state = g.state ?? s.state ?? 'Goa' // a GSTIN's state code wins over the dropdown
  return tx(async (t) => {
    if (await one('SELECT 1 FROM ledgers WHERE org_id=? AND lower(name)=lower(?)', [u.org_id, name], t)) throw new OpError('A party with that name already exists.')
    const id = await run('INSERT INTO suppliers (org_id, name, aliases, phone, gstin, state) VALUES (?,?,?,?,?,?)', [u.org_id, name, name.toLowerCase().split(' ')[0], s.phone ?? null, gstin, state], t)
    await run(`INSERT INTO ledgers (org_id, name, grp, kind, supplier_id) VALUES (?,?,?,?,?)`, [u.org_id, name, 'Sundry Creditors', 'supplier', id], t)
    await audit(u, u.org_id, 'supplier_added', `New supplier ${name}`, t)
    return id
  })
}

export async function signOff(u: User, upto: string, note: string) {
  if (u.role !== 'ca' && u.role !== 'owner') throw new OpError('Only the CA (or the owner) can sign off the books.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(upto) || upto >= today()) throw new OpError('Pick a date before today.')
  await run('INSERT INTO period_locks (org_id, upto, user_id, ts, note) VALUES (?,?,?,?,?)', [u.org_id, upto, u.id, nowTs(), note.slice(0, 500)])
  await audit(u, u.org_id, 'sign_off', `${u.name} signed off the books up to ${upto}${note ? ': ' + note : ''}`)
}

export async function reopen(u: User) {
  if (u.role !== 'ca') throw new OpError('Only the CA can reopen signed-off books.')
  const last = await one<any>('SELECT id, upto FROM period_locks WHERE org_id=? ORDER BY upto DESC LIMIT 1', [u.org_id])
  if (!last) throw new OpError('Nothing is locked.')
  await run('DELETE FROM period_locks WHERE id=?', [last.id])
  await audit(u, u.org_id, 'reopen', `${u.name} reopened the books after ${last.upto}`)
}

// ---- Masters: customers and items, and the day-end cash count ------------------------------

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
// The first two digits of a GSTIN are the state code; it decides CGST+SGST versus IGST.
export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '03': 'Punjab', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
}
export function checkGstin(raw?: string) {
  const g = (raw ?? '').trim().toUpperCase()
  if (!g) return { gstin: null, state: null }
  if (!GSTIN.test(g)) throw new OpError('That GSTIN does not look right (15 characters, like 30ABCDE1234F1Z5).')
  return { gstin: g, state: STATE_CODES[g.slice(0, 2)] ?? 'Other' }
}

export type CustomerIn = { name: string; phone?: string; branchId?: number; creditLimit?: number; gstin?: string; notes?: string }

/** Counter staff can add a customer (cash-only until the family sets a credit limit); managers and family set the limit. */
export async function addCustomer(u: User, c: CustomerIn) {
  canBook(u)
  const name = c.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new OpError('Enter the customer name.')
  const digits = (c.phone ?? '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  if (digits && !/^[6-9]\d{9}$/.test(digits)) throw new OpError('Enter a 10-digit mobile number.')
  const branchId = u.branch_id ?? c.branchId
  if (!branchId) throw new OpError('Pick the branch this customer buys from.')
  const limit = u.role === 'staff' ? 0 : Math.max(0, Math.round(c.creditLimit ?? 0))
  const g = checkGstin(c.gstin)
  return tx(async (t) => {
    if (!(await one('SELECT 1 FROM branches WHERE id=? AND org_id=?', [branchId, u.org_id], t))) throw new OpError('Unknown branch.')
    if (await one('SELECT 1 FROM ledgers WHERE org_id=? AND lower(name)=lower(?)', [u.org_id, name], t)) throw new OpError('A customer or supplier with that name already exists.')
    const id = await run(`INSERT INTO customers (org_id, branch_id, name, aliases, phone, credit_limit, notes, gstin, state) VALUES (?,?,?,?,?,?,?,?,?)`,
      [u.org_id, branchId, name, name.toLowerCase().split(' ')[0], digits ? '91' + digits : null, limit, (c.notes ?? '').slice(0, 500) || null, g.gstin, g.state ?? 'Goa'], t)
    await run(`INSERT INTO ledgers (org_id, name, grp, kind, customer_id) VALUES (?,?,?,?,?)`, [u.org_id, name, 'Sundry Debtors', 'customer', id], t)
    await audit(u, u.org_id, 'customer_added', `New customer ${name}${limit ? `, credit limit ₹${limit}` : ', cash only'}`, t)
    return { id, name, branch_id: branchId, credit_limit: limit }
  })
}

export async function setCreditTerms(u: User, customerId: number, limit: number, days: number) {
  if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'manager') throw new OpError('Only the family or a manager can change credit terms.')
  if (!Number.isInteger(limit) || limit < 0) throw new OpError('Enter a limit of zero or more.')
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new OpError('Credit days must be between 0 and 365.')
  const c = await one<any>('SELECT name, credit_limit, credit_days, branch_id FROM customers WHERE id=? AND org_id=?', [customerId, u.org_id])
  if (!c) throw new OpError('Unknown customer.')
  if (u.branch_id && c.branch_id !== u.branch_id) throw new OpError(`You can only change customers of ${u.branch}.`)
  await run('UPDATE customers SET credit_limit=?, credit_days=? WHERE id=?', [limit, days, customerId])
  await audit(u, u.org_id, 'credit_terms', `${c.name}: limit ₹${c.credit_limit} → ₹${limit}, credit ${c.credit_days} → ${days} days`)
}

/** Old dues carried over from a paper khata or another app. Booked as the party's opening balance; the owner's
 *  capital takes the other side, so the Balance Sheet still balances. amount > 0: they owe us; < 0: we owe them. */
export async function setOpeningBalance(u: User, party: { customerId?: number; supplierId?: number }, amount: number, since?: string) {
  if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'manager') throw new OpError('Only the family or a manager can enter old balances.')
  if (!Number.isInteger(amount)) throw new OpError('Enter the amount in whole rupees.')
  if (since && (!/^\d{4}-\d{2}-\d{2}$/.test(since) || since > today())) throw new OpError('Pick a date that is not in the future.')
  const org = (await one<any>('SELECT books_from FROM orgs WHERE id=?', [u.org_id]))!
  await assertOpen(u.org_id, org.books_from)
  return tx(async (t) => {
    const l = await one<any>(`SELECT l.*, c.branch_id cbranch FROM ledgers l LEFT JOIN customers c ON c.id=l.customer_id
      WHERE l.org_id=? AND ${party.customerId ? 'l.customer_id=?' : 'l.supplier_id=?'}`, [u.org_id, party.customerId ?? party.supplierId!], t)
    if (!l) throw new OpError('Unknown customer or supplier.')
    if (u.branch_id && l.cbranch && l.cbranch !== u.branch_id) throw new OpError(`You can only change customers of ${u.branch}.`)
    const opening = party.supplierId ? -amount : amount // suppliers: what we owe them is a credit balance
    const delta = opening - l.opening
    const cap = await one<any>(`SELECT id FROM ledgers WHERE org_id=? AND kind='capital'`, [u.org_id], t)
    await run('UPDATE ledgers SET opening=? WHERE id=?', [opening, l.id], t)
    await run('UPDATE ledgers SET opening = opening - ? WHERE id=?', [delta, cap!.id], t)
    if (party.customerId) await run('UPDATE customers SET opening_day=? WHERE id=?', [since ?? null, party.customerId], t)
    await audit(u, u.org_id, 'opening_balance', `${l.name}: old balance set to ₹${amount}${since ? ` (since ${since})` : ''}`, t)
    return { ledger: l.name, amount }
  })
}

export type UdhaarKind = 'gave_money' | 'charge' | 'discount' | 'writeoff'
/** Khata entries that are not a bill: money lent to a customer, a charge added, a discount, or a bad debt written off. */
export async function udhaarEntry(u: User, customerId: number, kind: UdhaarKind, amount: number, accountId?: number, note = '') {
  canBook(u); amountOk(amount)
  if ((kind === 'discount' || kind === 'writeoff') && u.role === 'staff') throw new OpError('Discounts and write-offs need the family or a manager.')
  return tx(async (t) => {
    const c = await one<any>('SELECT id, name, branch_id FROM customers WHERE id=? AND org_id=?', [customerId, u.org_id], t)
    if (!c) throw new OpError('Unknown customer.')
    if (u.branch_id && c.branch_id !== u.branch_id) throw new OpError(`You can only work with customers of ${u.branch}.`)
    const L = await ledgerMap(u.org_id, t)
    const cust = L.customer(c.id)
    const other = kind === 'gave_money' ? (await account(u, accountId!, t)).id
      : L.get(kind === 'charge' ? 'Delivery & Other Charges' : kind === 'discount' ? 'Discount Allowed' : 'Bad Debts Written Off')
    const up = kind === 'gave_money' || kind === 'charge' // the customer owes more
    const what = { gave_money: 'Money given to', charge: 'Charge added for', discount: 'Discount given to', writeoff: 'Written off for' }[kind]
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: c.branch_id, type: kind === 'gave_money' ? 'Payment' : 'Journal', day: today(), userId: u.id, partyLedgerId: cust,
      narration: `${what} ${c.name}${note ? ' · ' + note : ''}`,
      lines: up ? [{ ledgerId: cust, amount }, { ledgerId: other, amount: -amount }] : [{ ledgerId: other, amount }, { ledgerId: cust, amount: -amount }],
    })
    await audit(u, u.org_id, 'udhaar_entry', `${v.number}: ${what.toLowerCase()} ${c.name} ₹${amount}${note ? ' (' + note + ')' : ''}`, t)
    return v
  })
}

// ---- Advanced: any ledger, any entry (what Tally calls a Journal) ---------------------------

const canAdjust = (u: User) => {
  if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'ca') throw new OpError('Advanced entries are for the family or your CA.')
}

export async function createLedger(u: User, name: string, grp: string) {
  canAdjust(u)
  const n = name.trim().replace(/\s+/g, ' ')
  if (n.length < 3) throw new OpError('Give the ledger a clear name, like "Car loan - HDFC".')
  if (!OPEN_GROUPS.includes(grp)) throw new OpError('Pick a group from the list.')
  if (await one('SELECT 1 FROM ledgers WHERE org_id=? AND lower(name)=lower(?)', [u.org_id, n])) throw new OpError('A ledger with that name already exists.')
  const kind = GROUPS[grp].nature === 'expense' ? 'expense' : GROUPS[grp].nature === 'income' ? 'income' : 'other'
  const id = await run('INSERT INTO ledgers (org_id, name, grp, kind) VALUES (?,?,?,?)', [u.org_id, n, grp, kind])
  await audit(u, u.org_id, 'ledger_added', `New ledger ${n} under ${grp}`)
  return { id, name: n, grp }
}

/** Any balanced entry across any ledgers. If cash or bank is involved it is filed as the Receipt or Payment Tally expects. */
export async function postJournal(u: User, j: { day: string; narration: string; lines: { ledgerId: number; dr: number; cr: number }[] }) {
  canAdjust(u)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j.day) || j.day > today()) throw new OpError('Pick a date that is not in the future.')
  const org = (await one<any>('SELECT books_from FROM orgs WHERE id=?', [u.org_id]))!
  if (j.day < org.books_from) throw new OpError(`The books start on ${org.books_from}. Use old balances for anything before that.`)
  const lines = j.lines.filter((l) => l.dr || l.cr)
  if (lines.length < 2) throw new OpError('An entry needs at least two lines.')
  if (lines.some((l) => !Number.isInteger(l.dr) || !Number.isInteger(l.cr) || l.dr < 0 || l.cr < 0 || (l.dr && l.cr))) throw new OpError('Each line is either a debit or a credit, in whole rupees.')
  const dr = lines.reduce((s, l) => s + l.dr, 0), cr = lines.reduce((s, l) => s + l.cr, 0)
  if (dr !== cr) throw new OpError(`Debits (₹${dr}) and credits (₹${cr}) must be equal.`)
  if (!j.narration.trim()) throw new OpError('Write what this entry is for.')
  return tx(async (t) => {
    const ls = await q<any>(`SELECT id, name, grp FROM ledgers WHERE org_id=? AND id IN (${lines.map(() => '?').join(',')})`, [u.org_id, ...lines.map((l) => l.ledgerId)], t)
    if (ls.length !== new Set(lines.map((l) => l.ledgerId)).size) throw new OpError('Unknown ledger.')
    const money = lines.filter((l) => ['Cash-in-Hand', 'Bank Accounts'].includes(ls.find((x) => x.id === l.ledgerId).grp))
    const net = money.reduce((s, l) => s + l.dr - l.cr, 0)
    const type = !money.length ? 'Journal' : money.length === lines.length ? 'Contra' : net > 0 ? 'Receipt' : 'Payment'
    const v = await postVoucher(t, {
      orgId: u.org_id, type, day: j.day, userId: u.id, narration: j.narration.trim().slice(0, 300),
      partyLedgerId: lines.find((l) => !money.includes(l))?.ledgerId ?? lines[0].ledgerId,
      lines: lines.map((l) => ({ ledgerId: l.ledgerId, amount: l.dr - l.cr })),
    })
    await audit(u, u.org_id, 'journal', `${v.number}: ${j.narration.trim().slice(0, 80)} (₹${dr})`, t)
    return v
  })
}

// ---- Returns: credit notes (customer brings goods back) and debit notes (we send goods back) --------

export async function returnable(saleId: number) {
  return q<{ item_id: number; name: string; unit: string; sold: number; returned: number; price: number }>(
    `SELECT si.item_id, i.name, i.unit, SUM(si.qty) sold, si.price,
       COALESCE((SELECT SUM(ri.qty) FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE r.sale_id=si.sale_id AND ri.item_id=si.item_id),0) returned
     FROM sale_items si JOIN items i ON i.id=si.item_id WHERE si.sale_id=? GROUP BY si.item_id`, [saleId])
}

/** Goods back from a customer: stock returns to the branch, GST is reversed, and the customer is credited
 *  (udhaar goes down) or refunded in cash/UPI. Tally: Credit Note. */
export async function returnSale(u: User, saleId: number, lines: { itemId: number; qty: number }[], refund: 'account' | 'cash' | 'upi', note = '') {
  canBook(u)
  const s = await one<any>(`SELECT s.*, c.name cname, c.state cstate, o.state ostate FROM sales s JOIN orgs o ON o.id=s.org_id
    LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=? AND s.org_id=?`, [saleId, u.org_id])
  if (!s) throw new OpError('Bill not found.')
  if (u.branch_id && u.branch_id !== s.branch_id) throw new OpError(`You can only take returns for ${u.branch}.`)
  if (refund === 'account' && !s.customer_id) throw new OpError('A walk-in customer is refunded in cash or UPI.')
  const can = await returnable(saleId)
  const want = lines.filter((l) => l.qty > 0)
  if (!want.length) throw new OpError('Pick what came back.')
  for (const l of want) {
    const r = can.find((x) => x.item_id === l.itemId)
    if (!r || !Number.isInteger(l.qty) || l.qty > r.sold - r.returned) throw new OpError(`Only ${r ? r.sold - r.returned : 0} ${r?.unit ?? ''} of ${r?.name ?? 'that item'} can still be returned on this bill.`)
  }
  const day = today()
  return tx(async (t) => {
    const priced = want.map((l) => ({ ...l, price: can.find((x) => x.item_id === l.itemId)!.price }))
    const total = priced.reduce((a, l) => a + l.qty * l.price, 0)
    const rid = await run('INSERT INTO returns (org_id, kind, branch_id, sale_id, day, total, refund, user_id, note) VALUES (?,?,?,?,?,?,?,?,?)',
      [u.org_id, 'sale', s.branch_id, saleId, day, total, refund, u.id, note || null], t)
    const rates = new Map((await q<any>(`SELECT id, gst_rate FROM items WHERE id IN (${priced.map(() => '?').join(',')})`, priced.map((l) => l.itemId), t)).map((i) => [i.id, i.gst_rate]))
    for (const l of priced) {
      await run('INSERT INTO return_items (return_id, item_id, qty, price) VALUES (?,?,?,?)', [rid, l.itemId, l.qty, l.price], t)
      await run('UPDATE stock SET qty = qty + ? WHERE item_id=? AND branch_id=?', [l.qty, l.itemId, s.branch_id], t)
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
        [u.org_id, l.itemId, s.branch_id, day, 'return', l.qty, `Return on ${s.invoice_no}`, u.id], t)
    }
    const L = await ledgerMap(u.org_id, t)
    const to = refund === 'account' ? L.customer(s.customer_id) : refund === 'upi' ? L.bank() : L.cash(s.branch_id)
    const gl = gstLines(L, 'Sales', priced.map((l) => ({ amount: l.qty * l.price, rate: rates.get(l.itemId)! })), !!s.cstate && s.cstate !== s.ostate)
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: s.branch_id, type: 'Credit Note', day, userId: u.id, partyLedgerId: to,
      narration: `Goods returned on bill ${s.invoice_no}${s.cname ? ' by ' + s.cname : ''}, ${refund === 'account' ? 'credited to their account' : 'refunded ' + refund.toUpperCase()}${note ? ' · ' + note : ''}`,
      lines: [...gl.map((g) => ({ ...g, amount: -g.amount })), { ledgerId: to, amount: -total }],
    })
    await run('UPDATE returns SET voucher_id=? WHERE id=?', [v.id, rid], t)
    await audit(u, u.org_id, 'sale_return', `${v.number}: ₹${total} returned on ${s.invoice_no}`, t)
    return { ...v, total }
  })
}

/** Goods sent back to a supplier: stock leaves the branch, input GST is reversed, and we owe the supplier less
 *  (or get a refund). Tally: Debit Note. */
export async function returnPurchase(u: User, p: { branchId: number; supplierId: number; lines: { itemId: number; qty: number; rate: number }[]; refundAccountId?: number; note?: string }) {
  canBook(u)
  if (u.branch_id && u.branch_id !== p.branchId) throw new OpError(`You can only send back stock from ${u.branch}.`)
  if (!p.lines.length || p.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0 || !(l.rate > 0))) throw new OpError('Each item needs a quantity and a rate.')
  const day = today()
  return tx(async (t) => {
    const sup = await one<any>('SELECT s.*, o.state ostate FROM suppliers s JOIN orgs o ON o.id=s.org_id WHERE s.id=? AND s.org_id=?', [p.supplierId, u.org_id], t)
    if (!sup) throw new OpError('Pick a supplier.')
    const items = await q<any>(`SELECT i.id, i.name, i.unit, i.gst_rate, COALESCE(st.qty,0) stock FROM items i LEFT JOIN stock st ON st.item_id=i.id AND st.branch_id=?
      WHERE i.org_id=? AND i.id IN (${p.lines.map(() => '?').join(',')})`, [p.branchId, u.org_id, ...p.lines.map((l) => l.itemId)], t)
    for (const l of p.lines) {
      const it = items.find((i) => i.id === l.itemId)
      if (!it) throw new OpError('Unknown item.')
      if (it.stock < l.qty) throw new OpError(`Only ${it.stock} ${it.unit} of ${it.name} in stock to send back.`)
    }
    const total = p.lines.reduce((a, l) => a + Math.round(l.qty * l.rate), 0)
    const rid = await run('INSERT INTO returns (org_id, kind, branch_id, supplier_id, day, total, refund, user_id, note) VALUES (?,?,?,?,?,?,?,?,?)',
      [u.org_id, 'purchase', p.branchId, sup.id, day, total, p.refundAccountId ? 'refund' : 'account', u.id, p.note || null], t)
    for (const l of p.lines) {
      await run('INSERT INTO return_items (return_id, item_id, qty, price) VALUES (?,?,?,?)', [rid, l.itemId, l.qty, l.rate], t)
      await run('UPDATE stock SET qty = qty - ? WHERE item_id=? AND branch_id=?', [l.qty, l.itemId, p.branchId], t)
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
        [u.org_id, l.itemId, p.branchId, day, 'purchase_return', -l.qty, `Returned to ${sup.name}`, u.id], t)
    }
    const L = await ledgerMap(u.org_id, t)
    const from = p.refundAccountId ? (await account(u, p.refundAccountId, t)).id : L.supplier(sup.id)
    const gl = gstLines(L, 'Purchase', p.lines.map((l) => ({ amount: Math.round(l.qty * l.rate), rate: items.find((i) => i.id === l.itemId)!.gst_rate })), sup.state !== sup.ostate)
    const v = await postVoucher(t, {
      orgId: u.org_id, branchId: p.branchId, type: 'Debit Note', day, userId: u.id, partyLedgerId: L.supplier(sup.id),
      narration: `Goods returned to ${sup.name}${p.refundAccountId ? ', refund received' : ', adjusted against what we owe'}${p.note ? ' · ' + p.note : ''}`,
      lines: [{ ledgerId: from, amount: total }, ...gl.map((g) => ({ ...g, amount: -g.amount }))],
    })
    await run('UPDATE returns SET voucher_id=? WHERE id=?', [v.id, rid], t)
    await audit(u, u.org_id, 'purchase_return', `${v.number}: ₹${total} of goods returned to ${sup.name}`, t)
    return { ...v, total }
  })
}

/** A private link the customer can open on their phone to see their khata. Making a new one cancels the old. */
export async function shareToken(u: User, customerId: number, renew = false) {
  canBook(u)
  const c = await one<any>('SELECT share_token, branch_id FROM customers WHERE id=? AND org_id=?', [customerId, u.org_id])
  if (!c) throw new OpError('Unknown customer.')
  if (u.branch_id && c.branch_id !== u.branch_id) throw new OpError(`You can only share customers of ${u.branch}.`)
  if (c.share_token && !renew) return c.share_token as string
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  await run('UPDATE customers SET share_token=? WHERE id=?', [token, customerId])
  await audit(u, u.org_id, 'statement_link', `${renew ? 'New' : 'Created'} statement link for customer #${customerId}`)
  return token
}

export type ItemIn = { name: string; category?: string; unit?: string; hsn?: string; gstRate: number; cost: number; price: number; aliases?: string }

/** A new item starts at zero stock everywhere; stock arrives through a purchase (so the books stay right). */
export async function addItem(u: User, i: ItemIn) {
  if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'manager') throw new OpError('Only the family or a manager can add items.')
  const name = i.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new OpError('Enter the item name.')
  if (!RATES.includes(i.gstRate)) throw new OpError('Pick a GST rate: 0, 5, 12, 18 or 28%.')
  if (!Number.isInteger(i.price) || i.price <= 0) throw new OpError('Enter the selling price.')
  if (!Number.isInteger(i.cost) || i.cost < 0) throw new OpError('Enter the purchase price (it can be 0 if unknown).')
  if (i.cost > i.price) throw new OpError('The purchase price is higher than the selling price. Check both.')
  const hsn = (i.hsn ?? '').trim()
  if (hsn && !/^\d{4,8}$/.test(hsn)) throw new OpError('HSN is 4 to 8 digits.')
  return tx(async (t) => {
    if (await one('SELECT 1 FROM items WHERE org_id=? AND lower(name)=lower(?)', [u.org_id, name], t)) throw new OpError('An item with that name already exists.')
    const aliases = [...new Set([name.toLowerCase().split(' ').slice(0, 2).join(' '), ...(i.aliases ?? '').toLowerCase().split(',').map((a) => a.trim())])].filter(Boolean).join(',')
    const id = await run(`INSERT INTO items (org_id, name, aliases, category, unit, hsn, gst_rate, cost, price) VALUES (?,?,?,?,?,?,?,?,?)`,
      [u.org_id, name, aliases, (i.category ?? '').trim() || 'General', (i.unit ?? '').trim() || 'pc', hsn || null, i.gstRate, i.cost, i.price], t)
    for (const b of await q<any>('SELECT id FROM branches WHERE org_id=?', [u.org_id], t)) await run('INSERT INTO stock (item_id, branch_id, qty) VALUES (?,?,0)', [id, b.id], t)
    await audit(u, u.org_id, 'item_added', `New item ${name}: sells ₹${i.price}, cost ₹${i.cost}, GST ${i.gstRate}%`, t)
    return { id, name }
  })
}

/** What the drawer should hold: the branch cash box balance in the books. */
export async function expectedCash(orgId: number, branchId: number) {
  const r = await one<any>(`SELECT l.id, l.opening + COALESCE((SELECT SUM(vl.amount) FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
      WHERE vl.ledger_id=l.id AND v.day <= ?),0) bal FROM ledgers l WHERE l.org_id=? AND l.kind='cash' AND l.branch_id=?`, [today(), orgId, branchId])
  return r ? { ledgerId: r.id as number, expected: r.bal as number } : null
}

/** Day-end count. A difference is booked to "Cash Shortage & Excess" so the books match the drawer, and the
 *  insight engine picks up repeated shortfalls. */
export async function closeDay(u: User, branchId: number, counted: number, note = '') {
  canBook(u)
  if (u.branch_id && u.branch_id !== branchId) throw new OpError(`You can only close ${u.branch}.`)
  if (!Number.isInteger(counted) || counted < 0) throw new OpError('Enter the cash you counted.')
  const day = today()
  await ensureChart(u.org_id)
  return tx(async (t) => {
    const done = await one<any>(`SELECT us.name FROM cash_closings c LEFT JOIN users us ON us.id=c.user_id WHERE c.branch_id=? AND c.day=?`, [branchId, day], t)
    if (done) throw new OpError(`Today is already closed for this branch${done.name ? ` by ${done.name}` : ''}.`)
    const L = await ledgerMap(u.org_id, t)
    const cashId = L.cash(branchId)
    const expected = (await one<any>(`SELECT l.opening + COALESCE((SELECT SUM(vl.amount) FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
        WHERE vl.ledger_id=l.id AND v.day <= ?),0) bal FROM ledgers l WHERE l.id=?`, [day, cashId], t))!.bal as number
    await run('INSERT INTO cash_closings (branch_id, day, expected, counted, user_id) VALUES (?,?,?,?,?)', [branchId, day, expected, counted, u.id], t)
    const diff = counted - expected
    if (diff) await postVoucher(t, {
      orgId: u.org_id, branchId, type: 'Journal', day, userId: u.id, partyLedgerId: cashId,
      narration: `Day-end count: cash ${diff < 0 ? 'short' : 'excess'} by ₹${Math.abs(diff)}${note ? ' · ' + note : ''}`,
      lines: [{ ledgerId: cashId, amount: diff }, { ledgerId: L.get('Cash Shortage & Excess'), amount: -diff }],
    })
    await audit(u, u.org_id, 'day_close', `Cash counted ₹${counted} against ₹${expected} expected (${diff === 0 ? 'matches' : diff < 0 ? `short ₹${-diff}` : `excess ₹${diff}`})`, t)
    return { expected, counted, diff }
  })
}

export const accounts = (orgId: number) =>
  q<Ledger>(`SELECT * FROM ledgers WHERE org_id=? AND grp IN ('Cash-in-Hand','Bank Accounts') ORDER BY grp DESC, id`, [orgId])
export type { Row }
