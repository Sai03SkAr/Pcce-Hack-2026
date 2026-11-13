// Insight engine: plain rules over the metrics layer. No model is involved in finding or sizing a problem.
import { q, tx } from './db'
import { addDays, daysBetween, fmtDay, inr, inrShort, today, weekdayName } from './format'
import { cashVariances, receivables, salesByDay, stockStatus, weekdayBaseline, type Scope } from './metrics'
import { expiring } from './stockplan'

export type Action =
  | { kind: 'transfer'; item_id: number; from: number; to: number; qty: number; label_en: string; label_hi: string }
  | { kind: 'reorder'; item_id: number; branch_id: number; qty: number; label_en: string; label_hi: string }
  | { kind: 'remind'; customer_ids: number[]; label_en: string; label_hi: string }
  | { kind: 'view'; href: string; label_en: string; label_hi: string }
export type Insight = {
  id?: number; key: string; type: string; severity: 'high' | 'med' | 'good'; branch_id: number | null; impact: number
  title_en: string; title_hi: string; detail_en: string; detail_hi: string; action: Action | null; status?: string
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export async function computeInsights(orgId: number): Promise<Insight[]> {
  const T = today()
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [orgId])
  const stock = await stockStatus({ orgId })
  const out: Insight[] = []

  // Stock: out, about to run out, and whether another branch can cover it
  for (const r of stock) {
    if (r.status !== 'out' && r.status !== 'low') continue
    const donor = stock.filter((x) => x.item_id === r.item_id && x.branch_id !== r.branch_id && (x.cover_days ?? 0) > 30)
      .sort((a, b) => b.cover_days! - a.cover_days!)[0]
    const need = Math.ceil(r.avg_daily * 7) - r.qty // a week of cover: enough to bridge until the next purchase
    const spare = donor ? Math.floor(donor.qty - donor.avg_daily * 20) : 0
    const qty = donor ? Math.min(need, spare) : Math.ceil(r.avg_daily * (r.lead_days + 14)) - r.qty
    if (qty <= 0) continue
    const perDay = Math.round(r.avg_daily * r.price)
    const action: Action = donor
      ? { kind: 'transfer', item_id: r.item_id, from: donor.branch_id, to: r.branch_id, qty,
          label_en: `Transfer ${qty} ${r.unit} from ${donor.branch}`, label_hi: `${donor.branch} se ${qty} ${r.unit} bhejo` }
      : { kind: 'reorder', item_id: r.item_id, branch_id: r.branch_id, qty,
          label_en: `Reorder ${qty} ${r.unit}`, label_hi: `${qty} ${r.unit} order karo` }
    const donorEn = donor ? ` ${donor.branch} has ${donor.qty} ${r.unit}, about ${Math.round(donor.cover_days!)} days' worth.` : ''
    const donorHi = donor ? ` ${donor.branch} mein ${donor.qty} ${r.unit} pada hai, lagbhag ${Math.round(donor.cover_days!)} din ka maal.` : ''
    out.push(r.status === 'out' ? {
      key: `out:${r.branch_id}:${r.item_id}`, type: 'stockout', severity: 'high', branch_id: r.branch_id, impact: perDay * 7,
      title_en: `${r.name} is out of stock at ${r.branch}`, title_hi: `${r.branch} mein ${r.name} khatam ho gaya hai`,
      detail_en: `It usually sells ${Math.round(r.avg_daily)} ${r.unit} a day there, so about ${inr(perDay)} of sales is lost daily.${donorEn}`,
      detail_hi: `Wahan roz lagbhag ${Math.round(r.avg_daily)} ${r.unit} bikta hai, yaani roz ${inr(perDay)} ki sale ja rahi hai.${donorHi}`, action,
    } : {
      key: `low:${r.branch_id}:${r.item_id}`, type: 'lowstock', severity: 'med', branch_id: r.branch_id, impact: perDay * 3,
      title_en: `${r.name} will run out at ${r.branch} in about ${Math.max(1, Math.round(r.cover_days!))} days`,
      title_hi: `${r.branch} mein ${r.name} lagbhag ${Math.max(1, Math.round(r.cover_days!))} din mein khatam hoga`,
      detail_en: `Only ${r.qty} ${r.unit} left and the supplier takes ${r.lead_days} days.${donorEn}`,
      detail_hi: `Sirf ${r.qty} ${r.unit} bacha hai aur supplier ${r.lead_days} din leta hai.${donorHi}`, action,
    })
  }

  // Sales: last four full days against the usual for those weekdays
  const days = [1, 2, 3, 4].map((n) => addDays(T, -n))
  const windows = [0, 7, 14, 21, 28].map((n) => [addDays(days[3], -n), addDays(days[0], -n)])
  for (const b of branches) {
    const s: Scope = { orgId, branchId: b.id }
    const actual = sum((await salesByDay(s, days[3], days[0])).map((d) => d.revenue))
    const base = sum(await Promise.all(days.map((d) => weekdayBaseline(s, d))))
    const p = base ? Math.round(((actual - base) / base) * 100) : 0
    if (p > -15) continue
    const drivers = await q<any>(
      `SELECT i.id, i.name, SUM(CASE WHEN x.day >= ? THEN si.qty*si.price ELSE 0 END) cur,
         SUM(CASE WHEN x.day < ? THEN si.qty*si.price ELSE 0 END)/4.0 prev
       FROM sale_items si JOIN sales x ON x.id=si.sale_id JOIN items i ON i.id=si.item_id
       WHERE x.branch_id=? AND (${windows.map(() => 'x.day BETWEEN ? AND ?').join(' OR ')})
       GROUP BY i.id ORDER BY prev-cur DESC LIMIT 2`, [days[3], days[3], b.id, ...windows.flat()])
    const top = drivers[0]
    const oosIdx = top ? out.findIndex((i) => i.key === `out:${b.id}:${top.id}`) : -1
    const oos = oosIdx >= 0 ? out.splice(oosIdx, 1)[0] : null // fold the stock-out into this insight: it is the cause
    out.push({
      key: `sales:${b.id}`, type: 'sales_drop', severity: p <= -20 ? 'high' : 'med', branch_id: b.id, impact: Math.max(base - actual, oos?.impact ?? 0),
      title_en: `${b.name} sales are down ${-p}% over the last 4 days`, title_hi: `${b.name} ki sale pichhle 4 din mein ${-p}% kam hai`,
      detail_en: `${inr(actual)} against a usual ${inr(base)}. ` + (oos ? `The cause: ${oos.title_en.replace(` at ${b.name}`, '')}. ${oos.detail_en}`
        : `Biggest drop: ${drivers.map((d) => d.name).join(' and ')}.`),
      detail_hi: `${inr(actual)} hui, aam taur par ${inr(base)} hoti hai. ` + (oos ? `Wajah: ${oos.title_hi.replace(`${b.name} mein `, '')}. ${oos.detail_hi}`
        : `Sabse zyada giravat: ${drivers.map((d) => d.name).join(' aur ')}.`),
      action: oos?.action ?? { kind: 'view', href: `/sales`, label_en: 'See the bills', label_hi: 'Bill dekho' },
    })
  }

  // Dead stock
  for (const r of stock) {
    if (r.status !== 'dead' || r.value < 15000) continue
    const since = r.days_since_sold === null ? 'over 90' : String(r.days_since_sold)
    out.push({
      key: `dead:${r.branch_id}:${r.item_id}`, type: 'deadstock', severity: 'med', branch_id: r.branch_id, impact: r.value,
      title_en: `${inrShort(r.value)} of ${r.name} has not sold in ${since} days`, title_hi: `${inrShort(r.value)} ka ${r.name} ${since} din se nahi bika`,
      detail_en: `${r.qty} ${r.unit} sitting at ${r.branch}. Consider a discount, a bundle with primer, or returning it to the supplier.`,
      detail_hi: `${r.branch} mein ${r.qty} ${r.unit} pada hai. Discount do, primer ke saath bundle karo, ya supplier ko wapas karo.`,
      action: { kind: 'view', href: '/inventory?f=dead', label_en: 'See dead stock', label_hi: 'Dead stock dekho' },
    })
  }

  // Expiring stock: one line per item and branch, the soonest delivery first
  const seen = new Set<string>()
  for (const x of await expiring({ orgId }, 30)) {
    const k = `${x.branch_id}:${x.item_id}`
    if (seen.has(k)) continue
    seen.add(k)
    const gone = x.days_left < 0
    const whenEn = gone ? `expired ${-x.days_left} days ago` : x.days_left === 0 ? 'expires today' : `expires in ${x.days_left} days`
    const whenHi = gone ? `${-x.days_left} din pehle expire ho gaya` : x.days_left === 0 ? 'aaj expire hoga' : `${x.days_left} din mein expire hoga`
    out.push({
      key: `exp:${k}:${x.expiry}`, type: 'expiry', severity: x.days_left <= 7 ? 'high' : 'med', branch_id: x.branch_id, impact: x.value,
      title_en: `${x.qty} ${x.unit} ${x.name} at ${x.branch} ${whenEn}`, title_hi: `${x.branch} mein ${x.qty} ${x.unit} ${x.name} ${whenHi}`,
      detail_en: gone ? `${inr(x.value)} of stock. Keep it off the counter and ask the supplier about a return.`
        : `${inr(x.value)} of stock, use-by ${fmtDay(x.expiry)}. Sell it first: offer it on the next site orders or move it to the busiest branch.`,
      detail_hi: gone ? `${inr(x.value)} ka maal. Counter se hatao aur supplier se return ki baat karo.`
        : `${inr(x.value)} ka maal, ${fmtDay(x.expiry)} tak. Pehle yahi becho: agle site order mein do ya sabse busy branch mein bhejo.`,
      action: { kind: 'view', href: '/inventory/plan#expiry', label_en: 'See expiring stock', label_hi: 'Expiry wala maal dekho' },
    })
  }

  // Overdue udhaar, per branch
  const rec = await receivables({ orgId })
  const overdue = rec.filter((c) => c.overdue > 0)
  for (const b of branches) {
    const cs = overdue.filter((c) => c.branch_id === b.id)
    if (!cs.length) continue
    const total = sum(cs.map((c) => c.overdue))
    const list = cs.map((c) => `${c.name} ${inr(c.outstanding)} (${c.oldest_days} days${c.outstanding > c.credit_limit ? ', over limit' : ''})`).join('; ')
    const listHi = cs.map((c) => `${c.name} ${inr(c.outstanding)} (${c.oldest_days} din${c.outstanding > c.credit_limit ? ', limit se upar' : ''})`).join('; ')
    out.push({
      key: `overdue:${b.id}`, type: 'overdue', severity: cs.some((c) => c.oldest_days > c.credit_days + 15) ? 'high' : 'med', branch_id: b.id, impact: total,
      title_en: `${inr(total)} of udhaar is overdue at ${b.name}`, title_hi: `${b.name} mein ${inr(total)} ka udhaar atka hua hai`,
      detail_en: list + '.', detail_hi: listHi + '.',
      action: { kind: 'remind', customer_ids: cs.map((c) => c.customer_id), label_en: cs.length > 1 ? `Send ${cs.length} reminders` : 'Send reminder', label_hi: 'Reminder bhejo' },
    })
  }

  // Margin leak: sold below landed cost this week
  const leaks = await q<any>(
    `SELECT x.branch_id, b.name branch, u.name user, i.name item, COUNT(DISTINCT x.id) bills, SUM(si.qty*(si.cost-si.price)) loss
     FROM sale_items si JOIN sales x ON x.id=si.sale_id JOIN items i ON i.id=si.item_id JOIN branches b ON b.id=x.branch_id
     LEFT JOIN users u ON u.id=x.user_id
     WHERE x.org_id=? AND x.day >= ? AND si.price < si.cost GROUP BY x.branch_id, x.user_id, i.id`, [orgId, addDays(T, -7)])
  for (const l of leaks) out.push({
    key: `leak:${l.branch_id}:${l.item}`, type: 'margin_leak', severity: 'med', branch_id: l.branch_id, impact: l.loss,
    title_en: `${l.item} was sold below cost ${l.bills} times at ${l.branch}`, title_hi: `${l.branch} mein ${l.item} ${l.bills} baar cost se kam mein bika`,
    detail_en: `${l.user} billed it under the landed cost. ${inr(l.loss)} lost this week.`,
    detail_hi: `${l.user} ne cost se kam rate lagaya. Is hafte ${inr(l.loss)} ka nuksaan.`,
    action: { kind: 'view', href: '/sales', label_en: 'See the bills', label_hi: 'Bill dekho' },
  })

  // Cash that did not match at closing
  const shorts = await cashVariances({ orgId }, addDays(T, -21))
  for (const b of branches) {
    const cs = shorts.filter((c) => c.branch_id === b.id)
    if (!cs.length) continue
    const total = sum(cs.map((c) => c.expected - c.counted))
    const sameDay = new Set(cs.map((c) => weekdayName(c.day))).size === 1
    const sameUser = new Set(cs.map((c) => c.user)).size === 1
    out.push({
      key: `cash:${b.id}`, type: 'cash_short', severity: cs.length >= 2 ? 'high' : 'med', branch_id: b.id, impact: total,
      title_en: `Cash was short ${cs.length} times at ${b.name}: ${inr(total)}`, title_hi: `${b.name} mein ${cs.length} baar cash kam nikla: ${inr(total)}`,
      detail_en: `On ${cs.map((c) => fmtDay(c.day)).join(', ')}.` + (sameDay && cs.length > 1 ? ` Every time a ${weekdayName(cs[0].day)}` + (sameUser ? `, closed by ${cs[0].user}.` : '.') : ''),
      detail_hi: `${cs.map((c) => fmtDay(c.day)).join(', ')} ko.` + (sameDay && cs.length > 1 ? ` Har baar ${weekdayName(cs[0].day)}` + (sameUser ? `, closing ${cs[0].user} ne ki.` : '.') : ''),
      action: null,
    })
  }

  // Regular customers who went quiet (and do not simply owe us money)
  const quiet = await q<any>(
    `SELECT c.id, c.name, c.branch_id, COUNT(x.id) n, SUM(x.total) rev, MAX(x.day) last
     FROM customers c JOIN sales x ON x.customer_id=c.id WHERE c.org_id=? AND x.day >= ?
     GROUP BY c.id HAVING n >= 6 AND last < ?`, [orgId, addDays(T, -60), addDays(T, -21)])
  for (const c of quiet) {
    if (overdue.some((o) => o.customer_id === c.id)) continue
    const gap = daysBetween(c.last, T)
    const weekly = Math.round(c.rev / ((60 - gap) / 7))
    out.push({
      key: `quiet:${c.id}`, type: 'quiet_customer', severity: 'med', branch_id: c.branch_id, impact: weekly,
      title_en: `${c.name} has not ordered in ${gap} days`, title_hi: `${c.name} ne ${gap} din se order nahi diya`,
      detail_en: `They were buying about ${inr(weekly)} a week. Worth a call before a competitor settles in.`,
      detail_hi: `Pehle hafte mein lagbhag ${inr(weekly)} ka maal lete the. Ek phone kar lo.`,
      action: { kind: 'view', href: `/customers/${c.id}`, label_en: 'Open customer', label_hi: 'Customer kholo' },
    })
  }

  // One piece of good news, always
  const best = (await q<any>(
    `SELECT x.day, x.branch_id, b.name branch, SUM(x.total) rev FROM sales x JOIN branches b ON b.id=x.branch_id
     WHERE x.org_id=? AND x.day < ? GROUP BY x.day, x.branch_id ORDER BY rev DESC LIMIT 1`, [orgId, T]))[0]
  if (best && best.day >= addDays(T, -14)) out.push({
    key: 'good:record', type: 'good', severity: 'good', branch_id: best.branch_id, impact: 0,
    title_en: `${best.branch} had its best day in three months`, title_hi: `${best.branch} ka teen mahine ka sabse accha din`,
    detail_en: `${inr(best.rev)} on ${fmtDay(best.day)}.`, detail_hi: `${fmtDay(best.day)} ko ${inr(best.rev)} ki sale.`, action: null,
  })
  else {
    const g = (await q<any>(
      `SELECT i.name, SUM(CASE WHEN x.day >= ? THEN si.qty*si.price ELSE 0 END) cur, SUM(CASE WHEN x.day < ? THEN si.qty*si.price ELSE 0 END) prev
       FROM sale_items si JOIN sales x ON x.id=si.sale_id JOIN items i ON i.id=si.item_id
       WHERE x.org_id=? AND x.day >= ? AND x.day < ? GROUP BY i.id HAVING prev > 20000 ORDER BY cur*1.0/prev DESC LIMIT 1`,
      [addDays(T, -14), addDays(T, -14), orgId, addDays(T, -28), T]))[0]
    if (g) out.push({
      key: 'good:growth', type: 'good', severity: 'good', branch_id: null, impact: 0,
      title_en: `${g.name} is growing fast`, title_hi: `${g.name} tezi se bik raha hai`,
      detail_en: `${inr(g.cur)} in the last two weeks, up from ${inr(g.prev)}.`, detail_hi: `Pichhle do hafte mein ${inr(g.cur)}, pehle ${inr(g.prev)} tha.`, action: null,
    })
  }

  const weight = { high: 1.5, med: 1, good: 0 }
  return out.sort((a, b) => b.impact * weight[b.severity] - a.impact * weight[a.severity])
}

/** Recompute today's insights, keeping any the user already marked done or dismissed. */
export async function refreshInsights(orgId: number) {
  const T = today()
  const fresh = await computeInsights(orgId)
  await tx(async (t) => {
    const old = new Map((await q<any>('SELECT key, status FROM insights WHERE org_id=? AND day=?', [orgId, T], t)).map((r) => [r.key, r.status]))
    await t.execute({ sql: 'DELETE FROM insights WHERE org_id=? AND day=?', args: [orgId, T] })
    for (const i of fresh) await t.execute({
      sql: `INSERT INTO insights (org_id, day, key, type, severity, branch_id, impact, title_en, title_hi, detail_en, detail_hi, action, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [orgId, T, i.key, i.type, i.severity, i.branch_id, i.impact, i.title_en, i.title_hi, i.detail_en, i.detail_hi,
        i.action ? JSON.stringify(i.action) : null, old.get(i.key) ?? 'open'],
    })
  })
}

/** Today's insights in priority order (the insert order), limited to the caller's branch if they have one. */
export async function listInsights(s: Scope, opts: { refresh?: boolean } = {}): Promise<Insight[]> {
  if (opts.refresh !== false) await refreshInsights(s.orgId)
  const rows = await q<any>(
    `SELECT * FROM insights WHERE org_id=? AND day=?${s.branchId ? ` AND branch_id = ${Number(s.branchId)}` : ''} ORDER BY id`, [s.orgId, today()])
  return rows.map((r) => ({ ...r, action: r.action ? JSON.parse(r.action) : null }))
}
