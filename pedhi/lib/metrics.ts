// The metrics layer: every number the app or the AI shows comes from one of these functions.
// The model picks a function and filters; it never does the arithmetic itself.
import { q, one } from './db'
import { addDays, daysBetween, today } from './format'

export type Scope = { orgId: number; branchId?: number | null }
const bf = (s: Scope, col = 's.branch_id') => (s.branchId ? ` AND ${col} = ${Number(s.branchId)}` : '')

export async function salesSummary(s: Scope, from: string, to: string) {
  const r = (await one<any>(
    `SELECT COALESCE(SUM(total),0) revenue, COUNT(*) bills, COALESCE(SUM(cost_total),0) cost,
       COALESCE(SUM(CASE WHEN mode='cash' THEN total END),0) cash,
       COALESCE(SUM(CASE WHEN mode='upi' THEN total END),0) upi,
       COALESCE(SUM(CASE WHEN mode='credit' THEN total END),0) credit
     FROM sales s WHERE s.org_id=? AND s.day BETWEEN ? AND ?${bf(s)}`, [s.orgId, from, to]))!
  const p = await one<any>(
    `SELECT COALESCE(SUM(amount),0) collected FROM payments s WHERE s.org_id=? AND s.day BETWEEN ? AND ?${bf(s)}`, [s.orgId, from, to])
  // Goods brought back in the period come off sales and cost
  const ret = (await one<any>(
    `SELECT COALESCE(SUM(ri.qty*ri.price),0) total,
       COALESCE(SUM(ri.qty*(SELECT si.cost FROM sale_items si WHERE si.sale_id=s.sale_id AND si.item_id=ri.item_id LIMIT 1)),0) cost
     FROM returns s JOIN return_items ri ON ri.return_id=s.id WHERE s.org_id=? AND s.kind='sale' AND s.day BETWEEN ? AND ?${bf(s)}`, [s.orgId, from, to]))!
  r.revenue -= ret.total; r.cost -= ret.cost
  const margin = r.revenue - r.cost
  return {
    from, to, revenue: r.revenue, bills: r.bills, margin, margin_pct: r.revenue ? +((margin / r.revenue) * 100).toFixed(1) : 0,
    avg_bill: r.bills ? Math.round(r.revenue / r.bills) : 0, cash: r.cash, upi: r.upi, credit: r.credit, collected: p!.collected,
  }
}

export const salesByDay = (s: Scope, from: string, to: string) =>
  q<{ day: string; revenue: number; bills: number; margin: number }>(
    `SELECT day, SUM(total) revenue, COUNT(*) bills, SUM(total-cost_total) margin
     FROM sales s WHERE s.org_id=? AND s.day BETWEEN ? AND ?${bf(s)} GROUP BY day ORDER BY day`, [s.orgId, from, to])

/** One row per day with a revenue column per branch name, for stacked charts. */
export async function salesByDayBranch(s: Scope, from: string, to: string) {
  const rows = await q<any>(
    `SELECT s.day, b.name branch, SUM(s.total) revenue FROM sales s JOIN branches b ON b.id=s.branch_id
     WHERE s.org_id=? AND s.day BETWEEN ? AND ?${bf(s)} GROUP BY s.day, b.name ORDER BY s.day`, [s.orgId, from, to])
  const byDay = new Map<string, any>()
  for (const r of rows) byDay.set(r.day, { ...(byDay.get(r.day) ?? { day: r.day }), [r.branch]: r.revenue })
  return [...byDay.values()]
}

export async function branchComparison(orgId: number, from: string, to: string) {
  const rows = await q<any>(
    `SELECT b.id branch_id, b.name branch, COALESCE(SUM(s.total),0) revenue, COUNT(s.id) bills,
       COALESCE(SUM(s.total-s.cost_total),0) margin
     FROM branches b LEFT JOIN sales s ON s.branch_id=b.id AND s.day BETWEEN ? AND ?
     WHERE b.org_id=? GROUP BY b.id ORDER BY revenue DESC`, [from, to, orgId])
  return rows.map((r) => ({ ...r, margin_pct: r.revenue ? +((r.margin / r.revenue) * 100).toFixed(1) : 0 }))
}

export const topItems = (s: Scope, from: string, to: string, limit = 8, by: 'revenue' | 'qty' | 'margin' = 'revenue') =>
  q<{ item_id: number; name: string; unit: string; qty: number; revenue: number; margin: number }>(
    `SELECT i.id item_id, i.name, i.unit, SUM(si.qty) qty, SUM(si.qty*si.price) revenue, SUM(si.qty*(si.price-si.cost)) margin
     FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN items i ON i.id=si.item_id
     WHERE s.org_id=? AND s.day BETWEEN ? AND ?${bf(s)} GROUP BY i.id ORDER BY ${by} DESC LIMIT ?`, [s.orgId, from, to, limit])

export type StockRow = {
  item_id: number; name: string; category: string; unit: string; cost: number; price: number; lead_days: number
  branch_id: number; branch: string; qty: number; reorder_level: number; value: number
  avg_daily: number; cover_days: number | null; last_sold: string | null; days_since_sold: number | null
  status: 'out' | 'low' | 'dead' | 'ok'
}
export async function stockStatus(s: Scope): Promise<StockRow[]> {
  const T = today()
  const rows = await q<any>(
    `SELECT i.id item_id, i.name, i.category, i.unit, i.cost, i.price, i.lead_days, st.branch_id, b.name branch,
       st.qty, st.reorder_level, st.qty*i.cost value, COALESCE(v.q28,0)/28.0 avg_daily, v.last_sold
     FROM stock st JOIN items i ON i.id=st.item_id JOIN branches b ON b.id=st.branch_id
     LEFT JOIN (SELECT si.item_id, x.branch_id, SUM(CASE WHEN x.day >= ? AND x.day < ? THEN si.qty END) q28, MAX(x.day) last_sold
                FROM sale_items si JOIN sales x ON x.id=si.sale_id WHERE x.org_id=? GROUP BY si.item_id, x.branch_id) v
       ON v.item_id=st.item_id AND v.branch_id=st.branch_id
     WHERE i.org_id=?${bf(s, 'st.branch_id')} ORDER BY i.category, i.name, st.branch_id`, [addDays(T, -28), T, s.orgId, s.orgId])
  return rows.map((r) => {
    const cover = r.avg_daily > 0 ? +(r.qty / r.avg_daily).toFixed(1) : null
    const since = r.last_sold ? daysBetween(r.last_sold, T) : null
    const status = r.qty <= 0 && r.avg_daily > 0 ? 'out'
      : cover !== null && cover < r.lead_days + 1 ? 'low'
      : r.qty > 0 && (since === null || since >= 60) ? 'dead' : 'ok'
    return { ...r, avg_daily: +r.avg_daily.toFixed(2), cover_days: cover, days_since_sold: since, status }
  })
}

export type Receivable = {
  customer_id: number; ledger_id: number; name: string; phone: string; branch_id: number; branch: string; credit_limit: number; credit_days: number
  notes: string; outstanding: number; overdue: number; oldest_days: number; b0_30: number; b31_60: number; b60p: number; last_payment: string | null
}
/** Udhaar per customer, read from the customer's own ledger in the books: opening dues, credit bills, money given,
 *  charges (debits) against payments, returns and discounts (credits). Credits settle the oldest debits first. */
export async function receivables(s: Scope): Promise<Receivable[]> {
  const T = today()
  const custs = await q<any>(
    `SELECT c.id customer_id, l.id ledger_id, l.opening, c.opening_day, o.books_from, c.name, c.phone, c.branch_id, b.name branch,
       c.credit_limit, c.credit_days, c.notes
     FROM customers c JOIN branches b ON b.id=c.branch_id JOIN ledgers l ON l.customer_id=c.id JOIN orgs o ON o.id=c.org_id
     WHERE c.org_id=?${bf(s, 'c.branch_id')}`, [s.orgId])
  const lines = await q<any>(
    `SELECT l.customer_id, v.day, v.type, vl.amount FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id JOIN ledgers l ON l.id=vl.ledger_id
     WHERE l.org_id=? AND l.customer_id IS NOT NULL ORDER BY v.day, v.id`, [s.orgId])
  const byCust = new Map<number, any[]>()
  for (const l of lines) byCust.set(l.customer_id, [...(byCust.get(l.customer_id) ?? []), l])
  return custs.map((c) => {
    const ls = byCust.get(c.customer_id) ?? []
    const debits: { day: string; amount: number }[] = []
    let credit = 0
    if (c.opening > 0) debits.push({ day: c.opening_day ?? addDays(c.books_from, -1), amount: c.opening })
    else credit -= c.opening
    for (const l of ls) l.amount > 0 ? debits.push({ day: l.day, amount: l.amount }) : (credit -= l.amount)
    const out = { outstanding: 0, overdue: 0, oldest_days: 0, b0_30: 0, b31_60: 0, b60p: 0 }
    for (const d of debits) {
      const open = Math.max(0, d.amount - credit)
      credit = Math.max(0, credit - d.amount)
      if (!open) continue
      const age = daysBetween(d.day, T)
      out.outstanding += open
      out.oldest_days = Math.max(out.oldest_days, age)
      if (age > c.credit_days) out.overdue += open
      out[age <= 30 ? 'b0_30' : age <= 60 ? 'b31_60' : 'b60p'] += open
    }
    if (credit > 0) out.outstanding = -credit // paid in advance
    const last = ls.filter((l) => l.type === 'Receipt' && l.amount < 0).pop()
    const { opening, opening_day, books_from, ...rest } = c
    return { ...rest, ...out, last_payment: last?.day ?? null }
  }).sort((a, b) => b.outstanding - a.outstanding)
}

export type LedgerEntry = { day: string; type: string; number: string; narration: string; amount: number; sale_id: number | null; voucher_id: number | null; balance: number }
/** A customer's khata: opening dues and every voucher on their ledger, with a running balance (positive = they owe us). */
export async function customerLedger(orgId: number, customerId: number): Promise<LedgerEntry[]> {
  const l = await one<any>(`SELECT l.id, l.opening, c.opening_day, o.books_from FROM ledgers l JOIN customers c ON c.id=l.customer_id JOIN orgs o ON o.id=l.org_id
    WHERE l.org_id=? AND l.customer_id=?`, [orgId, customerId])
  if (!l) return []
  const rows = await q<any>(`SELECT v.id voucher_id, v.day, v.type, v.number, v.narration, v.sale_id, vl.amount FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id
    WHERE vl.ledger_id=? ORDER BY v.day, v.id`, [l.id])
  let bal = 0
  const opening = l.opening ? [{ day: l.opening_day ?? addDays(l.books_from, -1), type: 'Opening', number: '', narration: 'Old balance carried over', amount: l.opening, sale_id: null, voucher_id: null }] : []
  return [...opening, ...rows].map((r) => ({ ...r, balance: (bal += r.amount) }))
}

/** Median revenue on the same weekday over the previous four weeks. */
export async function weekdayBaseline(s: Scope, day: string) {
  const days = [7, 14, 21, 28].map((n) => addDays(day, -n))
  const rows = await q<any>(
    `SELECT day, SUM(total) revenue FROM sales s WHERE s.org_id=? AND s.day IN (?,?,?,?)${bf(s)} GROUP BY day`, [s.orgId, ...days])
  const v = days.map((d) => rows.find((r) => r.day === d)?.revenue ?? 0).sort((a, b) => a - b)
  return Math.round((v[1] + v[2]) / 2)
}

export const cashVariances = (s: Scope, from: string) =>
  q<{ branch_id: number; branch: string; day: string; expected: number; counted: number; user: string }>(
    `SELECT cc.branch_id, b.name branch, cc.day, cc.expected, cc.counted, u.name user
     FROM cash_closings cc JOIN branches b ON b.id=cc.branch_id LEFT JOIN users u ON u.id=cc.user_id
     WHERE b.org_id=? AND cc.day >= ? AND cc.counted - cc.expected < -500${bf(s, 'cc.branch_id')} ORDER BY cc.day`, [s.orgId, from])

export const recentSales = (s: Scope, limit = 50, from?: string) =>
  q<any>(
    `SELECT s.id, s.day, s.ts, s.invoice_no, s.total, s.mode, s.source, b.name branch, c.name customer, u.name user,
       (SELECT COUNT(*) FROM sale_items WHERE sale_id=s.id) lines
     FROM sales s JOIN branches b ON b.id=s.branch_id LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id
     WHERE s.org_id=?${from ? ' AND s.day >= ?' : ''}${bf(s)} ORDER BY s.ts DESC, s.id DESC LIMIT ?`,
    from ? [s.orgId, from, limit] : [s.orgId, limit])
