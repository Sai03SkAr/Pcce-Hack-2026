import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { getBrief } from '@/lib/brief'
import { addDays, fmtDayLong, inr, inrShort, today } from '@/lib/format'
import { listInsights } from '@/lib/insights'
import { branchComparison, receivables, salesByDay, salesByDayBranch, salesSummary, stockStatus, topItems } from '@/lib/metrics'
import { getScope, getUser, seesMoney } from '@/lib/session'
import { getLang } from '../actions'
import { BriefCard } from '@/components/BriefCard'
import { InsightList } from '@/components/Insights'
import { SalesChart, Spark } from '@/components/Charts'
import { BRANCH_COLORS } from '@/components/colors'

export default async function Today() {
  const u = await getUser()
  if (u.role === 'staff') redirect('/bill')
  if (u.role === 'ca') redirect('/books')
  const scope = await getScope(u)
  const lang = await getLang()
  const T = today(), Y = addDays(T, -1), W = addDays(T, -7), M = addDays(T, -29)
  const money = seesMoney(u)

  const brief = await getBrief(u, scope, lang) // refreshes today's insights, so it runs first
  const [insights, now, week, prevWeek, rec, stock, byBranch, branches, spark, top] = await Promise.all([
    listInsights(scope, { refresh: false }), salesSummary(scope, T, T), salesSummary(scope, W, Y),
    salesSummary(scope, addDays(W, -7), addDays(Y, -7)), receivables(scope), stockStatus(scope),
    salesByDayBranch(scope, M, T), scope.branchId ? Promise.resolve([]) : branchComparison(u.org_id, W, Y), salesByDay(scope, addDays(T, -13), T),
    topItems(scope, W, Y, 6),
  ])
  const outstanding = rec.reduce((s, r) => s + r.outstanding, 0)
  const overdue = rec.reduce((s, r) => s + r.overdue, 0)
  const stockValue = stock.reduce((s, r) => s + r.value, 0)
  const outCount = stock.filter((r) => r.status === 'out').length
  const lowCount = stock.filter((r) => r.status === 'low').length
  const wk = prevWeek.revenue ? Math.round(((week.revenue - prevWeek.revenue) / prevWeek.revenue) * 100) : 0
  const keys = scope.branchId ? [scope.branchName!] : ['Margao', 'Mapusa', 'Ponda']
  const hour = +new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(11, 13)
  const greet = hour < 4 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' // 2 am isn't morning
  const t = (en: string, hi: string) => (lang === 'hi' ? hi : en)

  const kpis = [
    { label: t('Today so far', 'Aaj ab tak'), value: inr(now.revenue), sub: `${now.bills} ${t('bills', 'bill')} · ${t('cash', 'cash')} ${inrShort(now.cash)} · UPI ${inrShort(now.upi)}`, href: '/sales' },
    { label: t('Last 7 days', 'Pichhle 7 din'), value: inr(week.revenue), sub: <span className={wk >= 0 ? 'text-leaf' : 'text-bahi'}>{wk >= 0 ? '▲' : '▼'} {Math.abs(wk)}% {t('vs the week before', 'pichhle hafte se')}</span>, spark: true, href: '/sales' },
    money ? { label: t('Gross margin, 7 days', 'Margin, 7 din'), value: inr(week.margin), sub: `${week.margin_pct}% ${t('of sales', 'sale ka')}`, href: '/sales' } : null,
    { label: t('Udhaar outstanding', 'Udhaar baki'), value: inr(outstanding), sub: <span className={overdue ? 'text-bahi' : ''}>{inr(overdue)} {t('past credit days', 'samay se upar')}</span>, href: '/customers' },
    { label: t('Stock', 'Stock'), value: money ? inr(stockValue) : `${stock.length} lines`, sub: <span className={outCount ? 'text-bahi' : ''}>{outCount} {t('out', 'khatam')} · {lowCount} {t('running low', 'kam')}</span>, href: '/inventory' },
  ].filter(Boolean) as { label: string; value: string; sub: React.ReactNode; spark?: boolean; href: string }[]

  return (
    <div className="space-y-7">
      <section className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">{fmtDayLong(T)} · {scope.branchName ?? t('All branches', 'Sab branch')}</p>
          <h1 className="display mt-1 text-[32px] font-semibold leading-tight sm:text-[38px]">{greet}, {u.name.split(' ')[0]}{lang === 'hi' ? ' ji' : ''}.</h1>
        </div>
        <p className="pb-1.5 text-[14px] text-muted">{insights.filter((i) => i.status === 'open' && i.severity !== 'good').length} {t('things need you today', 'cheezein aaj aapka dhyan maangti hain')}</p>
      </section>

      <section className={`grid grid-cols-2 gap-2.5 ${kpis.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {kpis.map((k, i) => (
          <Link key={k.label} href={k.href} className={`card rise group p-4 transition hover:shadow-[var(--shadow-lg)] ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-center"><span className="eyebrow">{k.label}</span><ArrowUpRight className="ml-auto size-3.5 text-muted opacity-0 transition group-hover:opacity-100" /></div>
            <div className="num mt-2 text-[24px] font-semibold leading-none tracking-tight">{k.value}</div>
            <div className="mt-2 text-[12.5px] text-muted">{k.sub}</div>
            {k.spark && <div className="mt-1.5"><Spark data={spark} /></div>}
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <div className="mb-2.5 flex items-baseline"><h2 className="display text-[22px] font-semibold">{t("This morning's brief", 'Aaj subah ka brief')}</h2><Link href="/whatsapp" className="ml-auto text-[13px] text-muted hover:text-ink">{t('Open WhatsApp →', 'WhatsApp kholo →')}</Link></div>
          <BriefCard body={brief.body} source={brief.source} lang={lang} />
        </div>
        <div>
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3"><h2 className="display text-[22px] font-semibold">{t('Needs attention', 'Dhyan dein')}</h2><span className="text-[13px] text-muted sm:ml-auto">{t('ranked by rupees at stake', 'paise ke hisaab se')}</span></div>
          <InsightList items={insights} lang={lang} canAct />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="display text-[20px] font-semibold">{t('Sales, last 30 days', 'Sale, pichhle 30 din')}</h2>
            <div className="ml-auto flex gap-3 text-[12.5px] text-ink-2">{keys.map((k, i) => <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: BRANCH_COLORS[i] }} />{k}</span>)}</div>
          </div>
          <div className="mt-4"><SalesChart data={byBranch} keys={keys} /></div>
        </div>
        <div className="card p-5">
          <h2 className="display text-[20px] font-semibold">{t('Top sellers this week', 'Is hafte sabse zyada bika')}</h2>
          <ol className="mt-3 space-y-2.5">
            {top.map((it, i) => {
              const w = Math.max(6, Math.round((it.revenue / top[0].revenue) * 100))
              return (
                <li key={it.item_id}>
                  <div className="flex items-baseline gap-2 text-[13.5px]"><span className="w-4 text-muted num">{i + 1}</span><span className="truncate font-medium">{it.name}</span><span className="ml-auto num font-semibold">{inrShort(it.revenue)}</span></div>
                  <div className="ml-6 mt-1 flex items-center gap-2"><span className="h-1.5 rounded-full bg-gold/70" style={{ width: `${w}%` }} /><span className="shrink-0 text-[11.5px] text-muted num">{it.qty} {it.unit}{money ? ` · ${Math.round((it.margin / it.revenue) * 100)}% margin` : ''}</span></div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {branches.length > 0 && (
        <section>
          <h2 className="display mb-2.5 text-[22px] font-semibold">{t('Branches this week', 'Is hafte branch')}</h2>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {branches.map((b, i) => {
              const issues = insights.filter((x) => x.branch_id === b.branch_id && x.status === 'open' && x.severity !== 'good')
              return (
                <div key={b.branch_id} className="card relative overflow-hidden p-4">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: BRANCH_COLORS[i] }} />
                  <div className="flex items-center"><h3 className="font-semibold">{b.branch}</h3>
                    {issues.length ? <span className={`chip ml-auto ${issues.some((x) => x.severity === 'high') ? 'chip-red' : 'chip-amber'}`}>{issues.length} {t('issues', 'dikkat')}</span> : <span className="chip chip-green ml-auto">{t('All good', 'Sab theek')}</span>}</div>
                  <div className="num mt-2 text-[22px] font-semibold">{inr(b.revenue)}</div>
                  <div className="mt-1 text-[12.5px] text-muted num">{b.bills} {t('bills', 'bill')}{money ? ` · ${b.margin_pct}% margin` : ''}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
