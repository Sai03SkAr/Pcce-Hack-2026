// The daily brief. Facts and wording are rule-built; the model (when there is a key) only rewrites the wording.
import { one, run } from './db'
import { addDays, fmtDayLong, inr, inrShort, L, today, weekdayName, type Lang } from './format'
import { listInsights, type Action, type Insight } from './insights'
import { aiEnabled, complete, MAIN } from './llm'
import { branchComparison, receivables, salesSummary, weekdayBaseline, type Scope } from './metrics'
import type { User } from './session'

export async function briefFacts(scope: Scope) {
  const T = today(), Y = addDays(T, -1)
  const y = await salesSummary(scope, Y, Y)
  const base = await weekdayBaseline(scope, Y)
  const branches = scope.branchId ? [] : await branchComparison(scope.orgId, Y, Y)
  const outstanding = (await receivables(scope)).reduce((s, r) => s + Math.max(0, r.outstanding), 0)
  const all = await listInsights(scope)
  const open = all.filter((i) => i.status === 'open' && i.severity !== 'good')

  // The owner gets one udhaar line for the whole business, not one per branch.
  const od = open.filter((i) => i.type === 'overdue')
  const merged: Insight[] = od.length < 2 ? open : open.flatMap((i) => {
    if (i.type !== 'overdue') return [i]
    if (i !== od[0]) return []
    const ids = od.flatMap((o) => (o.action as Extract<Action, { kind: 'remind' }>).customer_ids)
    const total = od.reduce((s, o) => s + o.impact, 0)
    return [{
      ...i, impact: total,
      title_en: `${inr(total)} of udhaar is overdue across ${ids.length} customers`, title_hi: `${ids.length} customer ka ${inr(total)} udhaar atka hua hai`,
      detail_en: od.map((o) => o.detail_en).join(' '), detail_hi: od.map((o) => o.detail_hi).join(' '),
      action: { kind: 'remind', customer_ids: ids, label_en: `Send ${ids.length} reminders`, label_hi: `${ids.length} reminder bhejo` },
    }]
  })
  return {
    day: T, yesterday: Y, y, base, delta: base ? Math.round(((y.revenue - base) / base) * 100) : 0,
    branches, outstanding, top: merged.slice(0, 3), good: all.find((i) => i.severity === 'good') ?? null,
  }
}
export type BriefFacts = Awaited<ReturnType<typeof briefFacts>>

export function renderBrief(f: BriefFacts, lang: Lang, u: User) {
  const first = u.name.split(' ')[0]
  const arrow = f.delta >= 0 ? '▲' : '▼'
  const wd = weekdayName(f.yesterday)
  const lines = [
    L(lang, `🙏 Good morning ${first}`, `🙏 Namaste ${first} ji`),
    `${u.org}, ${fmtDayLong(f.day)}` + (u.branch ? ` · ${u.branch}` : ''),
    '',
    L(lang, `*Yesterday:* ${inr(f.y.revenue)} from ${f.y.bills} bills (${arrow} ${Math.abs(f.delta)}% vs a usual ${wd})`,
      `*Kal:* ${f.y.bills} bill, ${inr(f.y.revenue)} ki sale (aam ${wd} se ${Math.abs(f.delta)}% ${f.delta >= 0 ? 'zyada' : 'kam'} ${arrow})`),
    `Cash ${inrShort(f.y.cash)} · UPI ${inrShort(f.y.upi)} · Udhaar ${inrShort(f.y.credit)}`,
    L(lang, `Collected ${inrShort(f.y.collected)} · Total udhaar pending ${inrShort(f.outstanding)}`,
      `Vasooli ${inrShort(f.y.collected)} · Kul udhaar baki ${inrShort(f.outstanding)}`),
  ]
  if (f.branches.length) lines.push(f.branches.map((b) => `${b.branch} ${inrShort(b.revenue)}`).join(' · '))
  if (f.top.length) {
    lines.push('', L(lang, '*Needs your attention*', '*Dhyan dein*'))
    f.top.forEach((i, n) => {
      lines.push(`${n + 1}. ${L(lang, i.title_en, i.title_hi)}. ${L(lang, i.detail_en, i.detail_hi)}`)
      if (i.action) lines.push(`   👉 ${L(lang, i.action.label_en, i.action.label_hi)}`)
    })
  } else lines.push('', L(lang, 'Nothing needs your attention today.', 'Aaj sab theek hai.'))
  if (f.good) lines.push('', L(lang, `*Good news:* ${f.good.title_en}. ${f.good.detail_en}`, `*Acchi khabar:* ${f.good.title_hi}. ${f.good.detail_hi}`))
  return lines.join('\n')
}

const STYLE = {
  en: 'Write in simple Indian English.',
  hi: 'Write in Hindi in Devanagari script, the way a shop owner texts: keep brand names, item names, branch names and all numbers in Latin script.',
}

export async function getBrief(u: User, scope: Scope, lang: Lang, force = false) {
  const facts = await briefFacts(scope)
  const key = `${u.id}:${scope.branchId ?? 'all'}`
  const saved = force ? undefined : await one<any>('SELECT body, source FROM briefs WHERE org_id=? AND day=? AND lang=? AND scope=?', [u.org_id, facts.day, lang, key])
  if (saved) return { ...saved, facts } as { body: string; source: string; facts: BriefFacts }

  let body = renderBrief(facts, lang, u), source = 'rules'
  if (aiEnabled()) try {
    body = await complete(
      `You write the morning business brief that an Indian family business owner reads on WhatsApp.
Rewrite the draft you are given so it reads naturally and warmly, like a trusted munim speaking to the owner.
Rules: use only the facts in the draft. Copy every number, name and date exactly. Add no advice that is not in the draft.
Keep the same order: greeting, yesterday's numbers, the things needing attention as a numbered list with each suggested action on its own line starting with 👉, then the good news.
Under 150 words. WhatsApp formatting only (*bold*). At most three emojis. ${STYLE[lang]}`,
      `Reader: ${u.name} (${u.title}).\n\nDraft:\n${renderBrief(facts, 'en', u)}`, MAIN, 1500)
    source = 'ai'
  } catch (e) {
    console.error('brief: model call failed, using the rule-built brief', e)
  }
  await run('DELETE FROM briefs WHERE org_id=? AND day=? AND lang=? AND scope=?', [u.org_id, facts.day, lang, key])
  await run('INSERT INTO briefs (org_id, day, lang, scope, body, source) VALUES (?,?,?,?,?,?)', [u.org_id, facts.day, lang, key, body, source])
  return { body, source, facts }
}
