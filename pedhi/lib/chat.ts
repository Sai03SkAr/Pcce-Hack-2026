// "Ask your business". The model chooses which metric to run and words the answer; our code produces every number.
import type Anthropic from '@anthropic-ai/sdk'
import { q } from './db'
import { addDays, fmtDay, inr, L, today, weekdayName, type Lang } from './format'
import { getBrief } from './brief'
import { listInsights } from './insights'
import { ai, aiEnabled, MAIN, textOf } from './llm'
import { loadCatalogue, parseMessage } from './match'
import { branchComparison, customerLedger, receivables, salesByDay, salesSummary, stockStatus, topItems, type Scope } from './metrics'
import { seesMoney, type User } from './session'
import { expiring, itemPerformance, reorderList } from './stockplan'

type Ctx = { user: User; scope: Scope; branches: { id: number; name: string }[] }
export type Evidence = { tool: string; input: any; result: any }
export type Answer = { text: string; evidence: Evidence[]; source: 'ai' | 'rules' }

const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
function period(input: any) {
  const T = today()
  const to = isDay(input?.to) ? input.to : T
  return { from: isDay(input?.from) ? input.from : addDays(to, -6), to }
}
/** A user pinned to one branch can never query another, whatever the model asks for. */
function scopeFor(ctx: Ctx, branch: unknown): Scope {
  if (ctx.scope.branchId) return ctx.scope
  const b = typeof branch === 'string' ? ctx.branches.find((x) => x.name.toLowerCase() === branch.toLowerCase()) : undefined
  return { orgId: ctx.scope.orgId, branchId: b?.id ?? null }
}

const DATES = {
  from: { type: 'string', description: 'First day, YYYY-MM-DD' },
  to: { type: 'string', description: 'Last day, YYYY-MM-DD (inclusive)' },
}
const BRANCH = { branch: { type: 'string', description: 'Branch name. Leave out for all branches.' } }

const TOOLS: Record<string, { description: string; properties: any; required?: string[]; run: (ctx: Ctx, i: any) => Promise<any> }> = {
  sales_summary: {
    description: 'Revenue, number of bills, gross margin, average bill, the cash / UPI / udhaar split and udhaar collected, for a date range.',
    properties: { ...DATES, ...BRANCH }, required: ['from', 'to'],
    run: (ctx, i) => { const p = period(i); return salesSummary(scopeFor(ctx, i.branch), p.from, p.to) },
  },
  sales_by_day: {
    description: 'Revenue, bills and margin for each day in a date range. Use for trends.',
    properties: { ...DATES, ...BRANCH }, required: ['from', 'to'],
    run: (ctx, i) => { const p = period(i); return salesByDay(scopeFor(ctx, i.branch), p.from, p.to) },
  },
  branch_comparison: {
    description: 'Revenue, bills and margin percent for every branch side by side, for a date range.',
    properties: DATES, required: ['from', 'to'],
    run: async (ctx, i) => {
      const p = period(i)
      const rows = await branchComparison(ctx.scope.orgId, p.from, p.to)
      return ctx.scope.branchId ? rows.filter((r) => r.branch_id === ctx.scope.branchId) : rows
    },
  },
  top_items: {
    description: 'Best-selling items in a date range, ranked by revenue, quantity or margin.',
    properties: { ...DATES, ...BRANCH, by: { type: 'string', enum: ['revenue', 'qty', 'margin'] }, limit: { type: 'integer' } }, required: ['from', 'to'],
    run: (ctx, i) => {
      const p = period(i)
      const by = ['revenue', 'qty', 'margin'].includes(i.by) && (i.by !== 'margin' || seesMoney(ctx.user)) ? i.by : 'revenue'
      return topItems(scopeFor(ctx, i.branch), p.from, p.to, Math.min(Math.max(+i.limit || 5, 1), 15), by)
    },
  },
  stock_status: {
    description: 'Current stock per item per branch: quantity, average daily sale, days of cover and status. Filter by a search word and/or status: out (zero stock on a selling item), low (will run out before the supplier can deliver), dead (not sold in 60+ days).',
    properties: { search: { type: 'string', description: 'Part of an item name, e.g. "cement"' }, ...BRANCH, status: { type: 'string', enum: ['out', 'low', 'dead', 'any'] } },
    run: async (ctx, i) => {
      const rows = (await stockStatus(scopeFor(ctx, i.branch)))
        .filter((r) => !i.search || r.name.toLowerCase().includes(String(i.search).toLowerCase()))
        .filter((r) => !i.status || i.status === 'any' || r.status === i.status)
      return rows.slice(0, 30).map(({ name, branch, qty, unit, avg_daily, cover_days, days_since_sold, status, value }) =>
        ({ name, branch, qty, unit, avg_daily, cover_days, days_since_sold, status, value }))
    },
  },
  receivables: {
    description: 'Udhaar (credit) outstanding per customer with age of the oldest unpaid bill and ageing buckets. Set overdue_only for bills older than 30 days.',
    properties: { ...BRANCH, overdue_only: { type: 'boolean' } },
    run: async (ctx, i) => {
      const all = (await receivables(scopeFor(ctx, i.branch))).filter((r) => r.outstanding > 0)
      const rows = all.filter((r) => !i.overdue_only || r.overdue > 0)
      return {
        total_outstanding: all.reduce((s, r) => s + r.outstanding, 0), customers_shown: rows.length,
        customers: rows.slice(0, 15).map(({ name, branch, outstanding, oldest_days, credit_limit, last_payment }) => ({ name, branch, outstanding, oldest_days, credit_limit, last_payment })),
      }
    },
  },
  customer_profile: {
    description: 'One customer: what they owe, their credit limit, the owner\'s notes about them, and their last few bills and payments.',
    properties: { name: { type: 'string', description: 'Customer name or part of it' } }, required: ['name'],
    run: async (ctx, i) => {
      const r = (await receivables(ctx.scope)).find((c) => c.name.toLowerCase().includes(String(i.name).toLowerCase()))
      if (!r) return { error: 'No customer by that name' }
      const ledger = (await customerLedger(ctx.scope.orgId, r.customer_id)).slice(-6)
        .map(({ day, type, narration, amount, balance }) => ({ day, entry: type, narration, amount, balance }))
      return { ...r, recent: ledger }
    },
  },
  business_alerts: {
    description: 'Today\'s open problems found by the insight engine (stock-outs, sales drops, overdue udhaar, dead stock, cash shortages) with the suggested action for each.',
    properties: {},
    run: async (ctx) => (await listInsights(ctx.scope)).filter((x) => x.status === 'open')
      .map((x) => ({ severity: x.severity, title: x.title_en, detail: x.detail_en, suggested_action: x.action?.label_en ?? null })),
  },
  expiring_stock: {
    description: 'Stock still on the shelf whose use-by date (from supplier bills) falls within the next N days, soonest first. Negative days_left means already expired.',
    properties: { within_days: { type: 'integer', description: 'Look this many days ahead, default 30' }, ...BRANCH },
    run: (ctx, i) => expiring(scopeFor(ctx, i.branch), Math.min(Math.max(+i.within_days || 30, 1), 365)),
  },
  reorder_list: {
    description: 'Items that will run out before a new delivery could arrive, with how much to order, grouped by the supplier who last sent each one.',
    properties: { ...BRANCH },
    run: (ctx, i) => reorderList(scopeFor(ctx, i.branch)),
  },
  item_performance: {
    description: 'Last 30 days per item: quantity sold, sales, profit, margin, demand trend against the 30 days before (up / down / flat), stock and days it lasts, and a tag: star (sells a lot, good margin), crowd (sells a lot, thin margin), push (good margin, slow), review, dead (no sale in 60 days).',
    properties: { ...BRANCH },
    run: (ctx, i) => itemPerformance(scopeFor(ctx, i.branch)),
  },
}

// Counter staff never see cost, margin or stock value, including through the assistant.
const HIDDEN = new Set(['margin', 'margin_pct', 'cost', 'value', 'profit'])
const redact = (v: any): any => Array.isArray(v) ? v.map(redact)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !HIDDEN.has(k)).map(([k, x]) => [k, redact(x)])) : v

async function runTool(ctx: Ctx, name: string, input: any, evidence: Evidence[]) {
  const t = TOOLS[name]
  if (!t) throw new Error(`Unknown tool ${name}`)
  const raw = await t.run(ctx, input ?? {})
  const result = seesMoney(ctx.user) ? raw : redact(raw)
  evidence.push({ tool: name, input: input ?? {}, result })
  return result
}

export async function answer(user: User, scope: Scope, question: string): Promise<Answer> {
  const ctx: Ctx = { user, scope, branches: await q('SELECT id, name FROM branches WHERE org_id=?', [user.org_id]) }
  if (aiEnabled()) try {
    return await aiAnswer(ctx, question)
  } catch (e) {
    console.error('ask: model call failed, answering with rules', e)
  }
  return ruleAnswer(ctx, question)
}

async function aiAnswer(ctx: Ctx, question: string): Promise<Answer> {
  const T = today()
  const u = ctx.user
  const system = `You are Pedhi, the business assistant for ${u.org}, a family-run building materials business in Goa with branches ${ctx.branches.map((b) => b.name).join(', ')}.
Today is ${weekdayName(T)} ${T}. You are talking to ${u.name} (${u.title})${u.branch ? `, who only has access to the ${u.branch} branch` : ''}.

Every figure you state must come from a tool result in this conversation. Do not estimate, and do no arithmetic beyond adding or comparing figures the tools returned. If the tools cannot answer the question, say so and say what you can answer instead.
${seesMoney(u) ? '' : 'This person is counter staff: cost prices, margins and profit are not available to them. If asked, say those figures are for the owners.\n'}Answer in the language the question was asked in (English, Hindi, or Hinglish in Latin script). Be brief: two to five sentences, the answer first, then the reason if the data shows one. Write rupee amounts the Indian way (₹1,25,000). Plain text, no tables or headings.`
  const tools: Anthropic.Tool[] = Object.entries(TOOLS).map(([name, t]) => ({
    name, description: t.description, input_schema: { type: 'object', properties: t.properties, required: t.required ?? [] },
  }))
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }]
  const evidence: Evidence[] = []
  for (let turn = 0; turn < 6; turn++) {
    const m = await ai().messages.create({ model: MAIN, max_tokens: 4000, system, tools, messages, output_config: { effort: 'low' } })
    if (m.stop_reason === 'refusal') throw new Error('model declined')
    if (m.stop_reason !== 'tool_use') return { text: textOf(m), evidence, source: 'ai' }
    messages.push({ role: 'assistant', content: m.content })
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      m.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use').map(async (b) => {
        try {
          return { type: 'tool_result' as const, tool_use_id: b.id, content: JSON.stringify(await runTool(ctx, b.name, b.input, evidence)) }
        } catch (e) {
          return { type: 'tool_result' as const, tool_use_id: b.id, content: String(e), is_error: true }
        }
      }))
    messages.push({ role: 'user', content: results })
  }
  throw new Error('too many tool turns')
}

// ---- No-key path: keyword routing onto the same tools --------------------------------------

function parsePeriod(t: string) {
  const T = today()
  if (/\b(today|aaj)\b/.test(t)) return { from: T, to: T, en: 'today', hi: 'aaj' }
  if (/\b(yesterday|kal)\b/.test(t)) return { from: addDays(T, -1), to: addDays(T, -1), en: 'yesterday', hi: 'kal' }
  if (/\b(month|mahine|mahina)\b/.test(t)) return { from: T.slice(0, 8) + '01', to: T, en: 'this month', hi: 'is mahine' }
  return { from: addDays(T, -6), to: T, en: 'in the last 7 days', hi: 'pichhle 7 din mein' }
}

async function ruleAnswer(ctx: Ctx, question: string): Promise<Answer> {
  const t = question.toLowerCase()
  const lang: Lang = /\b(kitn|kya|kaun|hai|ka|ki|ke|mein|batao|dikhao|kal|aaj|hafte|baki|udhaar|maal|bikri)\b/.test(t) ? 'hi' : 'en'
  const p = parsePeriod(t)
  const branch = ctx.branches.find((b) => t.includes(b.name.toLowerCase()))?.name
  const where = branch ?? ctx.user.branch ?? L(lang, 'all branches', 'sab branch')
  const evidence: Evidence[] = []
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  const say = (en: string, hi: string): Answer => ({ text: cap(L(lang, en, hi)), evidence, source: 'rules' })
  const money = seesMoney(ctx.user)

  if (/\b(brief|report|summary|haal)\b/.test(t))
    return { text: (await getBrief(ctx.user, ctx.scope, lang)).body, evidence, source: 'rules' }

  if (/\b(udhaar|udhar|baki|baaki|overdue|receivable|owe|owes|credit|outstanding|vasooli|pending)\b/.test(t)) {
    const name = (await loadCatalogue(ctx.scope.orgId)).customers.find((c) => [c.name.toLowerCase(), ...c.aliases.split(',')].some((a) => a && t.includes(a)))
    if (name) {
      const c = await runTool(ctx, 'customer_profile', { name: name.name }, evidence)
      return say(`${c.name} owes ${inr(c.outstanding)} against a limit of ${inr(c.credit_limit)}. Oldest unpaid bill: ${c.oldest_days} days.${c.notes ? ' Note: ' + c.notes : ''}`,
        `${c.name} ka ${inr(c.outstanding)} baki hai (limit ${inr(c.credit_limit)}). Sabse purana bill ${c.oldest_days} din ka.${c.notes ? ' Note: ' + c.notes : ''}`)
    }
    const r = await runTool(ctx, 'receivables', { branch, overdue_only: /overdue|purana|atka|late/.test(t) }, evidence)
    const list = r.customers.slice(0, 5).map((c: any) => `${c.name} ${inr(c.outstanding)} (${c.oldest_days}d)`).join(', ')
    return say(`Total udhaar outstanding for ${where}: ${inr(r.total_outstanding)}. Largest: ${list}.`, `${where} ka kul udhaar baki: ${inr(r.total_outstanding)}. Sabse bade: ${list}.`)
  }

  if (/\b(expir\w*|expire|kharab|use by|purana maal)\b/.test(t)) {
    const r = await runTool(ctx, 'expiring_stock', { branch, within_days: 30 }, evidence)
    const list = r.slice(0, 6).map((x: any) => `${x.qty} ${x.unit} ${x.name} at ${x.branch} (${x.days_left < 0 ? 'expired' : x.days_left + ' days'})`).join('; ')
    const listHi = r.slice(0, 6).map((x: any) => `${x.branch} mein ${x.qty} ${x.unit} ${x.name} (${x.days_left < 0 ? 'expire ho gaya' : x.days_left + ' din'})`).join('; ')
    return say(r.length ? `Expiring in the next 30 days: ${list}. Sell these first.` : 'Nothing on the shelf expires in the next 30 days.',
      r.length ? `Agle 30 din mein expire: ${listHi}. Pehle yahi becho.` : 'Agle 30 din mein kuch expire nahi ho raha.')
  }

  if (/\b(reorder|order|mangwa\w*|mangana|mangaye|purchase order)\b/.test(t)) {
    const r = await runTool(ctx, 'reorder_list', { branch }, evidence)
    const list = r.map((g: any) => `${g.supplier}: ${g.lines.map((l: any) => `${l.order} ${l.unit} ${l.name} (${l.branch})`).join(', ')}`).join('. ')
    return say(r.length ? `Order now. ${list}. Stock plan has a ready WhatsApp message for each supplier.` : 'Nothing needs ordering yet: every item lasts longer than its delivery time.',
      r.length ? `Abhi mangwao. ${list}. Stock plan mein har supplier ke liye WhatsApp message tayyar hai.` : 'Abhi kuch mangwane ki zaroorat nahi.')
  }

  if (/\b(demand|star|fast moving|slow moving|kaunsa item|which items?)\b/.test(t)) {
    const r = await runTool(ctx, 'item_performance', { branch }, evidence)
    const pick = (tag: string) => r.filter((x: any) => x.tag === tag).slice(0, 4).map((x: any) => x.name).join(', ') || 'none'
    const up = r.filter((x: any) => x.trend === 'up' && x.qty).slice(0, 4).map((x: any) => x.name).join(', ') || 'none'
    if (!money) return say(`Rising demand: ${up}.`, `Demand badh rahi hai: ${up}.`)
    return say(`Stars (sell a lot, good margin): ${pick('star')}. Sell a lot on thin margin: ${pick('crowd')}. Good margin but slow, push these: ${pick('push')}. Rising demand: ${up}.`,
      `Star (zyada bikta, accha munafa): ${pick('star')}. Zyada bikta par kam munafa: ${pick('crowd')}. Accha munafa par dheema, inko aage badhao: ${pick('push')}. Demand badh rahi: ${up}.`)
  }

  if (/\b(dead|not sold|nahi bik|pada hua)\b/.test(t)) {
    const r = await runTool(ctx, 'stock_status', { branch, status: 'dead' }, evidence)
    const list = r.slice(0, 5).map((x: any) => `${x.name} (${x.qty} ${x.unit}, ${x.branch})`).join('; ')
    return say(r.length ? `Not sold in 60+ days: ${list}.` : 'Nothing has been sitting unsold for 60 days.', r.length ? `60 din se nahi bika: ${list}.` : '60 din se pada hua koi maal nahi hai.')
  }

  if (/\b(stock|maal|inventory|bacha|khatam|low|kitna hai)\b/.test(t)) {
    const item = parseMessage(question, await loadCatalogue(ctx.scope.orgId)).lines[0]
    if (item) {
      const r = await runTool(ctx, 'stock_status', { search: item.name, branch }, evidence)
      const list = r.map((x: any) => `${x.branch} ${x.qty} ${x.unit}${x.cover_days !== null ? ` (${Math.round(x.cover_days)}d)` : ''}`).join(', ')
      return say(`${item.name}: ${list}. Days in brackets are how long it lasts at the current rate of sale.`, `${item.name}: ${list}. Bracket mein kitne din chalega.`)
    }
    const out = await runTool(ctx, 'stock_status', { branch, status: 'out' }, evidence)
    const low = await runTool(ctx, 'stock_status', { branch, status: 'low' }, evidence)
    const f = (xs: any[]) => xs.slice(0, 5).map((x) => `${x.name} (${x.branch}${x.qty ? ', ' + x.qty + ' left' : ''})`).join('; ') || 'none'
    return say(`Out of stock: ${f(out)}. Running low: ${f(low)}.`, `Khatam: ${f(out)}. Kam bacha: ${f(low)}.`)
  }

  if (/\b(which branch|kaunsi|kaun si|compare|branchwise|branch wise)\b/.test(t) || (/\bbranch\b/.test(t) && /\b(best|worst|sabse|lowest|highest)\b/.test(t))) {
    const r: any[] = await runTool(ctx, 'branch_comparison', p, evidence)
    const byMargin = money && /\b(margin|profit|munafa)\b/.test(t)
    const rows = [...r].sort((a, b) => (byMargin ? a.margin_pct - b.margin_pct : b.revenue - a.revenue))
    const list = rows.map((b) => `${b.branch} ${inr(b.revenue)}${money ? ` (${b.margin_pct}% margin)` : ''}`).join(', ')
    return say(byMargin ? `Lowest margin ${p.en}: ${rows[0].branch} at ${rows[0].margin_pct}%. All branches: ${list}.` : `${rows[0].branch} leads ${p.en}. ${list}.`,
      byMargin ? `${p.hi} sabse kam margin ${rows[0].branch} ka hai: ${rows[0].margin_pct}%. Sab branch: ${list}.` : `${p.hi} ${rows[0].branch} sabse aage hai. ${list}.`)
  }

  if (/\b(top|best sell|bestsell|sabse zyada|most sold|zyada bik)\b/.test(t)) {
    const r: any[] = await runTool(ctx, 'top_items', { ...p, branch, limit: 5 }, evidence)
    const list = r.map((x, n) => `${n + 1}. ${x.name} ${inr(x.revenue)}`).join('  ')
    return say(`Top sellers ${p.en} (${where}): ${list}`, `${p.hi} sabse zyada bika (${where}): ${list}`)
  }

  if (/\b(margin|profit|munafa|kamai)\b/.test(t)) {
    if (!money) return say('Margin and profit figures are for the owners.', 'Margin aur profit ki jaankari sirf maalik ke liye hai.')
    const s = await runTool(ctx, 'sales_summary', { ...p, branch }, evidence)
    return say(`Gross margin ${p.en} (${where}): ${inr(s.margin)}, which is ${s.margin_pct}% of ${inr(s.revenue)} in sales.`, `${p.hi} (${where}) margin ${inr(s.margin)} raha, yaani ${inr(s.revenue)} ki sale ka ${s.margin_pct}%.`)
  }

  if (/\b(sale|sales|bikri|revenue|kitni|kitna|how much|business|dhanda|collection)\b/.test(t)) {
    const s = await runTool(ctx, 'sales_summary', { ...p, branch }, evidence)
    return say(`Sales ${p.en} (${where}): ${inr(s.revenue)} from ${s.bills} bills. Cash ${inr(s.cash)}, UPI ${inr(s.upi)}, udhaar ${inr(s.credit)}. Collected ${inr(s.collected)}.`,
      `${p.hi} (${where}) ${s.bills} bill, ${inr(s.revenue)} ki sale. Cash ${inr(s.cash)}, UPI ${inr(s.upi)}, udhaar ${inr(s.credit)}. Vasooli ${inr(s.collected)}.`)
  }

  if (/\b(problem|alert|dhyan|attention|issue|kya chal|what.s wrong|dikkat)\b/.test(t)) {
    const r: any[] = await runTool(ctx, 'business_alerts', {}, evidence)
    return say(r.slice(0, 4).map((x, n) => `${n + 1}. ${x.title}`).join('\n') || 'Nothing needs attention right now.', r.slice(0, 4).map((x, n) => `${n + 1}. ${x.title}`).join('\n') || 'Abhi sab theek hai.')
  }

  return say(
    'I can answer questions about sales, stock, expiry, what to order, demand, udhaar, top items and branches. Try: "How were sales this week?", "ACC cement stock?", "Who owes us money?", "Which branch has the lowest margin?"',
    'Main sale, stock, udhaar, top items aur branch ke baare mein bata sakta hoon. Jaise: "Aaj kitni sale hui?", "ACC cement ka stock?", "Kiska udhaar baki hai?", "Kaunsi branch ka margin sabse kam hai?"')
}

export const SUGGESTIONS = {
  en: ['How were sales this week?', 'Which branch has the lowest margin this week?', 'Who owes us money?', 'ACC cement stock?', 'Top items this month', 'What needs my attention?'],
  hi: ['Aaj kitni sale hui?', 'Is hafte kaunsi branch ka margin sabse kam hai?', 'Kiska udhaar baki hai?', 'ACC cement ka stock kitna hai?', 'Is mahine sabse zyada kya bika?', 'Kya dikkat chal rahi hai?'],
}
export { fmtDay }
