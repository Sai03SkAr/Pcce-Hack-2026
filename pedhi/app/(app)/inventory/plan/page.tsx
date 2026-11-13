import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, MessageCircle, PackagePlus, ShoppingCart, Sparkles } from 'lucide-react'
import { one } from '@/lib/db'
import { fmtDay, inr, inrShort } from '@/lib/format'
import { getScope, getUser } from '@/lib/session'
import { expiring, itemPerformance, orderMessage, reorderList, type ItemPerf } from '@/lib/stockplan'

const TAG: Record<ItemPerf['tag'], { label: string; chip: string; hint: string }> = {
  star: { label: 'Star', chip: 'chip-green', hint: 'Sells a lot and earns well. Never let it run out.' },
  crowd: { label: 'Crowd-puller', chip: 'chip-gold', hint: 'Sells a lot on a thin margin. It brings people in; ask suppliers for a better rate.' },
  push: { label: 'Push it', chip: 'chip-amber', hint: 'Good margin but slow. Suggest it at the counter and on site orders.' },
  review: { label: 'Review', chip: 'chip-grey', hint: 'Slow and thin. Keep less of it.' },
  dead: { label: 'Not moving', chip: 'chip-red', hint: 'No sale in 60 days. Discount it or send it back.' },
}

export default async function StockPlan() {
  const u = await getUser()
  if (u.role === 'staff') redirect('/inventory')
  const scope = await getScope(u)
  const [orders, soon, perf, org] = await Promise.all([reorderList(scope), expiring(scope, 30), itemPerformance(scope), one<{ name: string }>('SELECT name FROM orgs WHERE id=?', [u.org_id])])
  const orderValue = orders.reduce((s, g) => s + g.total, 0)
  const soonValue = soon.reduce((s, b) => s + b.value, 0)
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`
  const groups = (['star', 'crowd', 'push', 'dead'] as const).map((t) => ({ t, items: perf.filter((p) => p.tag === t) }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-3.5" />Stock</Link>
        <p className="eyebrow mt-2">{scope.branchName ?? 'All branches'} · last 30 days</p>
        <h1 className="display text-[30px] font-semibold leading-tight">Stock plan</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-2">What to order before it runs out, what is about to expire, and which items actually make you money.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [ShoppingCart, 'Order now', n(orders.reduce((s, g) => s + g.lines.length, 0), 'item'), `${inrShort(orderValue)} at cost`],
          [CalendarClock, 'Expiring in 30 days', n(soon.length, 'lot'), `${inrShort(soonValue)} of stock`],
          [Sparkles, 'Stars', n(groups[0].items.length, 'item'), `${inrShort(groups[0].items.reduce((s, p) => s + p.profit, 0))} profit`],
          [PackagePlus, 'Not moving', n(groups[3].items.length, 'item'), 'no sale in 60 days'],
        ].map(([I, l, v, sub]: any) => (
          <div key={l} className="card p-4"><div className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><I className="size-3.5" />{l}</div>
            <div className="num mt-1 text-[22px] font-semibold">{v}</div><div className="text-[12.5px] text-muted">{sub}</div></div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">Order now</h2>
        {!orders.length && <p className="card p-4 text-[14px] text-muted">Nothing will run out before a delivery could arrive.</p>}
        {orders.map((g) => {
          const msg = orderMessage(g, org?.name ?? '')
          return (
            <div key={g.supplier} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[14rem] flex-1"><h3 className="font-semibold">{g.supplier}</h3><p className="text-[12.5px] text-muted">About {inr(g.total)} at your last cost</p></div>
                {g.phone && <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${g.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`}><MessageCircle className="size-3.5" />Send order on WhatsApp</a>}
                {g.supplier_id && [...new Set(g.lines.map((l) => l.branch_id))].map((b) => (
                  <Link key={b} className="btn btn-sm" href={`/books/new?a=purchase&branch=${b}&d=${encodeURIComponent(JSON.stringify({ supplierId: g.supplier_id, lines: g.lines.filter((l) => l.branch_id === b).map((l) => ({ itemId: l.item_id, qty: l.order, rate: l.cost })) }))}`}>
                    Arrived{new Set(g.lines.map((l) => l.branch_id)).size > 1 ? ` at ${g.lines.find((l) => l.branch_id === b)!.branch}` : ''}? Record bill</Link>))}
              </div>
              <ul className="mt-3 divide-y divide-line text-[13.5px]">
                {g.lines.map((l) => (
                  <li key={`${l.item_id}:${l.branch_id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                    <span className="min-w-0 flex-1 font-medium">{l.name}<span className="ml-1.5 font-normal text-muted">{l.branch}</span></span>
                    <span className="num text-muted">has {l.have} · sells {l.per_day.toFixed(1)}/day</span>
                    <span className="num font-semibold">order {l.order} {l.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section id="expiry" className="scroll-mt-20 space-y-3">
        <h2 className="text-[18px] font-semibold">Expiring in the next 30 days</h2>
        <p className="-mt-2 text-[13px] text-muted">From the use-by dates entered on supplier bills. Older stock sells first, so this is what is still on the shelf.</p>
        {!soon.length ? <p className="card p-4 text-[14px] text-muted">Nothing on the shelf expires in the next 30 days.</p> : (
          <ul className="card divide-y divide-line">
            {soon.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[13.5px]">
                <span className={`chip ${b.days_left <= 7 ? 'chip-red' : b.days_left <= 30 ? 'chip-amber' : 'chip-grey'}`}>{b.days_left < 0 ? 'Expired' : b.days_left === 0 ? 'Today' : `${b.days_left} days`}</span>
                <span className="min-w-0 flex-1 font-medium">{b.qty} {b.unit} {b.name}<span className="ml-1.5 font-normal text-muted">{b.branch}</span></span>
                <span className="num text-muted">use by {fmtDay(b.expiry)} · {inr(b.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold">What sells, what earns</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(({ t, items }) => (
            <div key={t} className="card p-4">
              <div className="flex items-center gap-2"><span className={`chip ${TAG[t].chip}`}>{TAG[t].label}</span><span className="num text-[12.5px] text-muted">{n(items.length, 'item')}</span></div>
              <p className="mt-1.5 text-[13px] text-ink-2">{TAG[t].hint}</p>
              <ul className="mt-2 space-y-1 text-[13.5px]">
                {items.slice(0, 5).map((p) => (
                  <li key={p.item_id} className="flex gap-2"><span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="num text-muted">{t === 'dead' ? `${p.stock} ${p.unit} idle` : `${inr(p.profit)} · ${p.margin_pct}%`}</span></li>
                ))}
                {!items.length && <li className="text-muted">None right now.</li>}
              </ul>
            </div>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <table className="table min-w-[900px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead><tr><th>Item</th><th></th><th className="text-right">Sold</th><th>Demand</th><th className="text-right">Sales</th><th className="text-right">Profit</th><th className="text-right">Margin</th><th className="text-right">Stock lasts</th></tr></thead>
            <tbody>
              {perf.map((p) => (
                <tr key={p.item_id}>
                  <td className="min-w-[14rem] !whitespace-normal font-medium">{p.name}</td>
                  <td><span className={`chip ${TAG[p.tag].chip}`}>{TAG[p.tag].label}</span></td>
                  <td className="num text-right">{p.qty} {p.unit}</td>
                  <td className="num">{p.trend === 'up' ? <span className="inline-flex items-center gap-0.5 text-leaf"><ArrowUp className="size-3.5" />rising</span>
                    : p.trend === 'down' ? <span className="inline-flex items-center gap-0.5 text-bahi"><ArrowDown className="size-3.5" />falling</span> : <span className="text-muted">steady</span>}</td>
                  <td className="num text-right">{inr(p.revenue)}</td>
                  <td className="num text-right font-semibold">{inr(p.profit)}</td>
                  <td className="num text-right">{p.margin_pct}%</td>
                  <td className="num text-right text-ink-2">{p.cover_days === null ? '-' : `${p.cover_days} days`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
