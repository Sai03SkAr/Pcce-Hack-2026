// What to order, what is expiring and which items earn: plain rules over sales, stock and supplier bills.
import { q } from './db'
import { addDays, daysBetween, today } from './format'
import { stockStatus, type Scope } from './metrics'

const bf = (s: Scope, col = 'branch_id') => (s.branchId ? ` AND ${col}=${Number(s.branchId)}` : '')

export type Batch = { item_id: number; name: string; unit: string; branch_id: number; branch: string; qty: number; expiry: string; days_left: number; value: number }

/** Shelf stock split into the deliveries it came from. Goods sell oldest first, so what is left is the newest stock.
 *  shortcut: estimated from bills (FIFO), not counted per batch; good enough to warn, add batch counts if a shop needs it. */
export async function shelfBatches(s: Scope): Promise<Batch[]> {
  const T = today()
  const stock = await q<any>(`SELECT st.item_id, st.branch_id, st.qty, i.name, i.unit, i.cost, b.name branch FROM stock st
    JOIN items i ON i.id=st.item_id JOIN branches b ON b.id=st.branch_id WHERE i.org_id=? AND st.qty > 0${bf(s, 'st.branch_id')}`, [s.orgId])
  const bills = await q<any>(`SELECT pi.item_id, p.branch_id, pi.qty, pi.expiry FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id
    WHERE p.org_id=?${bf(s, 'p.branch_id')} ORDER BY p.day DESC, pi.id DESC`, [s.orgId])
  const byKey = new Map<string, any[]>()
  for (const b of bills) { const k = `${b.item_id}|${b.branch_id}`; byKey.set(k, [...(byKey.get(k) ?? []), b]) }
  const out: Batch[] = []
  for (const st of stock) {
    let left = st.qty
    for (const b of byKey.get(`${st.item_id}|${st.branch_id}`) ?? []) {
      if (left <= 0) break
      const qty = Math.min(left, b.qty)
      left -= qty
      if (b.expiry) out.push({ item_id: st.item_id, name: st.name, unit: st.unit, branch_id: st.branch_id, branch: st.branch, qty, expiry: b.expiry, days_left: daysBetween(T, b.expiry), value: qty * st.cost })
    }
  }
  return out.sort((a, b) => a.expiry.localeCompare(b.expiry))
}

export const expiring = async (s: Scope, within = 30) => (await shelfBatches(s)).filter((b) => b.days_left <= within)

export type ItemPerf = {
  item_id: number; name: string; category: string; unit: string; qty: number; prev_qty: number; revenue: number; profit: number
  margin_pct: number; trend: 'up' | 'down' | 'flat'; stock: number; cover_days: number | null; days_since_sold: number | null
  tag: 'star' | 'crowd' | 'push' | 'review' | 'dead'
}

/** Last 30 days per item: how much sold, what it earned, whether demand is rising, and what to do about it. */
export async function itemPerformance(s: Scope): Promise<ItemPerf[]> {
  const T = today(), from = addDays(T, -29), prevFrom = addDays(T, -59)
  const sold = await q<any>(`SELECT si.item_id, SUM(CASE WHEN x.day >= ? THEN si.qty END) qty, SUM(CASE WHEN x.day < ? THEN si.qty END) prev_qty,
      SUM(CASE WHEN x.day >= ? THEN si.qty*si.price END) revenue, SUM(CASE WHEN x.day >= ? THEN si.qty*(si.price-si.cost) END) profit
    FROM sale_items si JOIN sales x ON x.id=si.sale_id WHERE x.org_id=? AND x.day BETWEEN ? AND ?${bf(s, 'x.branch_id')} GROUP BY si.item_id`,
    [from, from, from, from, s.orgId, prevFrom, T])
  const stock = new Map<number, { qty: number; avg: number; since: number | null; dead: boolean; name: string; category: string; unit: string }>()
  for (const r of await stockStatus(s)) {
    const x = stock.get(r.item_id) ?? { qty: 0, avg: 0, since: null as number | null, dead: true, name: r.name, category: r.category, unit: r.unit }
    x.qty += r.qty; x.avg += r.avg_daily
    if (r.qty > 0 && r.status !== 'dead') x.dead = false
    if (r.days_since_sold !== null) x.since = x.since === null ? r.days_since_sold : Math.min(x.since, r.days_since_sold)
    stock.set(r.item_id, x)
  }
  const rows = [...stock].map(([id, st]) => {
    const r = sold.find((x) => x.item_id === id) ?? {}
    const qty = r.qty ?? 0, prev = r.prev_qty ?? 0, revenue = r.revenue ?? 0, profit = r.profit ?? 0
    return {
      item_id: id, name: st.name, category: st.category, unit: st.unit, qty, prev_qty: prev, revenue, profit,
      margin_pct: revenue ? +((profit / revenue) * 100).toFixed(1) : 0,
      trend: (prev && qty > prev * 1.2 ? 'up' : prev && qty < prev * 0.8 ? 'down' : !prev && qty ? 'up' : 'flat') as ItemPerf['trend'],
      stock: st.qty, cover_days: st.avg > 0 ? Math.round(st.qty / st.avg) : null, days_since_sold: st.since, dead: st.dead, tag: 'review' as ItemPerf['tag'],
    }
  })
  // "High" means at or above the middle item that sold, so the split adapts to any shop's size.
  const selling = rows.filter((r) => r.revenue > 0)
  const mid = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0
  const midRev = mid(selling.map((r) => r.revenue)), midMargin = mid(selling.map((r) => r.margin_pct))
  for (const r of rows) {
    const busy = r.revenue > 0 && r.revenue >= midRev, rich = r.margin_pct >= midMargin
    r.tag = !r.qty && r.stock > 0 && r.dead ? 'dead'
      : busy && rich ? 'star' : busy ? 'crowd' : r.qty && rich ? 'push' : 'review'
  }
  return rows.map(({ dead, ...r }) => r).sort((a, b) => b.profit - a.profit)
}

export type ReorderLine = { item_id: number; name: string; unit: string; branch_id: number; branch: string; have: number; per_day: number; order: number; cost: number }
export type ReorderGroup = { supplier_id: number | null; supplier: string; phone: string | null; lines: ReorderLine[]; total: number }

/** Everything that runs out before the next delivery could arrive, sized for two weeks after it, grouped by who supplies it. */
export async function reorderList(s: Scope): Promise<ReorderGroup[]> {
  const need = (await stockStatus(s)).filter((r) => r.status === 'out' || r.status === 'low')
  const last = await q<any>(`SELECT pi.item_id, p.supplier_id, sp.name, sp.phone FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id
    JOIN suppliers sp ON sp.id=p.supplier_id WHERE p.org_id=? ORDER BY p.day DESC, pi.id DESC`, [s.orgId])
  const groups = new Map<string, ReorderGroup>()
  for (const r of need) {
    const order = Math.ceil(r.avg_daily * (r.lead_days + 14)) - r.qty
    if (order <= 0) continue
    const sup = last.find((x) => x.item_id === r.item_id)
    const k = String(sup?.supplier_id ?? 'none')
    const g: ReorderGroup = groups.get(k) ?? { supplier_id: sup?.supplier_id ?? null, supplier: sup?.name ?? 'No supplier on record', phone: sup?.phone ?? null, lines: [], total: 0 }
    g.lines.push({ item_id: r.item_id, name: r.name, unit: r.unit, branch_id: r.branch_id, branch: r.branch, have: r.qty, per_day: r.avg_daily, order, cost: r.cost })
    g.total += order * r.cost
    groups.set(k, g)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

/** The order as a WhatsApp message the owner can forward to the supplier as is. */
export function orderMessage(g: ReorderGroup, shop: string) {
  const byBranch = new Map<string, ReorderLine[]>()
  for (const l of g.lines) byBranch.set(l.branch, [...(byBranch.get(l.branch) ?? []), l])
  return `Namaste ${g.supplier}, please send:\n` +
    [...byBranch].map(([b, ls]) => `\n${b}:\n` + ls.map((l) => `• ${l.order} ${l.unit} ${l.name}`).join('\n')).join('\n') +
    `\n\nPlease confirm rate and delivery date.\n${shop}`
}
