import Link from 'next/link'
import { inr, today } from '@/lib/format'
import { balanceSheet, booksFrom, profitLoss, trialBalance } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { q } from '@/lib/db'
import { RangeForm } from '@/components/RangeForm'

const Row = ({ label, amount, bold, indent, href }: { label: string; amount: number; bold?: boolean; indent?: boolean; href?: string }) => (
  <div className={`flex py-1.5 text-[13.5px] ${bold ? 'border-t border-line font-semibold' : ''} ${indent ? 'pl-4 text-ink-2' : ''}`}>
    {href ? <Link href={href} className="hover:text-bahi">{label}</Link> : <span>{label}</span>}<span className="num ml-auto">{inr(amount)}</span>
  </div>
)

export default async function Reports({ searchParams }: PageProps<'/books/reports'>) {
  const u = await getUser()
  const sp = await searchParams
  const r = sp.r === 'tb' || sp.r === 'bs' ? sp.r : 'pl'
  const start = await booksFrom(u.org_id)
  const to = typeof sp.to === 'string' ? sp.to : today(), from = typeof sp.from === 'string' ? sp.from : start
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [u.org_id])
  const branch = u.branch_id ?? (Number(sp.branch) || null)
  const tab = (k: string, l: string) => <Link href={`/books/reports?r=${k}`} className={`whitespace-nowrap rounded-[8px] px-2 py-1.5 text-center sm:px-3 ${r === k ? 'bg-ink text-paper' : 'text-muted'}`}>{l}</Link>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="display text-[26px] font-semibold">{r === 'pl' ? 'Profit & Loss' : r === 'bs' ? 'Balance Sheet' : 'Trial Balance'}</h1>
        <div className="grid w-full grid-cols-3 rounded-[10px] border border-line-2 bg-card p-0.5 text-[13px] font-semibold sm:ml-auto sm:flex sm:w-auto print:hidden">{tab('pl', 'P & L')}{tab('bs', 'Balance Sheet')}{tab('tb', 'Trial Balance')}</div>
      </div>
      <RangeForm from={r === 'pl' ? from : undefined} to={to} extra={{ r }} csv={`/api/export?kind=${r}&from=${from}&to=${to}${branch ? `&branch=${branch}` : ''}`}>
        {r === 'pl' && !u.branch_id && <label className="text-[12.5px] font-medium text-ink-2">Branch<select name="branch" defaultValue={branch ?? ''} className="input mt-1 h-10 sm:h-9 sm:w-auto"><option value="">Whole business</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      </RangeForm>
      {r === 'pl' && <PL orgId={u.org_id} from={from} to={to} branch={branch} branchName={branches.find((b) => b.id === branch)?.name} />}
      {r === 'bs' && <BS orgId={u.org_id} to={to} />}
      {r === 'tb' && <TB orgId={u.org_id} to={to} />}
    </div>
  )
}

async function PL({ orgId, from, to, branch, branchName }: { orgId: number; from: string; to: string; branch: number | null; branchName?: string }) {
  const p = await profitLoss(orgId, from, to, branch)
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="eyebrow mb-2">Trading account</h2>
          <Row label="Opening stock" amount={p.openingStock} />
          <Row label="Purchases (before GST)" amount={p.totals.purchases} />
          {p.purchases.map((x) => <Row key={x.id} label={x.name} amount={x.amount} indent href={`/books/ledgers/${x.id}`} />)}
          {p.direct.map((x) => <Row key={x.id} label={x.name} amount={x.amount} href={`/books/ledgers/${x.id}`} />)}
          <Row label="Gross profit" amount={p.gross} bold />
        </section>
        <section className="card p-5">
          <h2 className="eyebrow mb-2">&nbsp;</h2>
          <Row label="Sales (before GST)" amount={p.totals.sales} />
          {p.sales.map((x) => <Row key={x.id} label={x.name} amount={x.amount} indent href={`/books/ledgers/${x.id}`} />)}
          <Row label="Closing stock (at cost)" amount={p.closingStock} />
          <Row label="Total" amount={p.totals.sales + p.closingStock} bold />
        </section>
        <section className="card p-5">
          <h2 className="eyebrow mb-2">Running costs (indirect expenses)</h2>
          {p.indirect.map((x) => <Row key={x.id} label={x.name} amount={x.amount} href={`/books/ledgers/${x.id}`} />)}
          <Row label="Total expenses" amount={p.totals.indirect} bold />
        </section>
        <section className={`card p-5 ${p.net >= 0 ? 'bg-leaf-soft/40' : 'bg-bahi-soft/40'}`}>
          <h2 className="eyebrow mb-2">Result</h2>
          <Row label="Gross profit" amount={p.gross} />
          {p.incomes.map((x) => <Row key={x.id} label={x.name} amount={x.amount} />)}
          <Row label="Less: running costs" amount={-p.totals.indirect} />
          <div className="mt-2 flex border-t-2 border-line-2 pt-2.5 text-[18px] font-semibold"><span>{p.net >= 0 ? 'Net profit' : 'Net loss'}</span><span className="num ml-auto">{inr(p.net)}</span></div>
          {branch && <p className="mt-2 text-[12.5px] text-amber">{branchName} only. Common costs not tied to a branch ({inr(p.common)}, e.g. phone and bank charges) are left out. Stock moved between branches shifts profit between them.</p>}
          <p className="mt-2 text-[12.5px] text-muted">Gross margin {p.totals.sales ? ((p.gross / p.totals.sales) * 100).toFixed(1) : 0}% · net margin {p.totals.sales ? ((p.net / p.totals.sales) * 100).toFixed(1) : 0}% of sales before GST.</p>
        </section>
      </div>
    </>
  )
}

async function BS({ orgId, to }: { orgId: number; to: string }) {
  const b = await balanceSheet(orgId, to)
  const Side = ({ title, groups, total }: { title: string; groups: typeof b.assets; total: number }) => (
    <section className="card p-5">
      <h2 className="eyebrow mb-2">{title}</h2>
      {groups.map((g) => (
        <div key={g.grp} className="py-1">
          <div className="flex text-[14px] font-semibold"><span>{g.grp}</span><span className="num ml-auto">{inr(g.total)}</span></div>
          {g.ledgers.length > 1 && g.ledgers.length <= 6 && g.ledgers.map((l) => <div key={l.name} className="flex pl-4 text-[12.5px] text-ink-2"><span className="truncate">{l.name}</span><span className="num ml-auto">{inr(l.amount)}</span></div>)}
          {g.ledgers.length > 6 && <div className="pl-4 text-[12.5px] text-muted">{g.ledgers.length} accounts · <Link className="underline" href={`/books/ledgers?g=${encodeURIComponent(g.grp)}`}>see all</Link></div>}
        </div>
      ))}
      <div className="mt-2 flex border-t-2 border-line-2 pt-2.5 text-[17px] font-semibold"><span>Total</span><span className="num ml-auto">{inr(total)}</span></div>
    </section>
  )
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Side title="What the business owes (liabilities)" groups={b.liabilities} total={b.totalLiabilities} />
        <Side title="What the business owns (assets)" groups={b.assets} total={b.totalAssets} />
      </div>
      <p className={`text-center text-[13px] ${b.totalAssets === b.totalLiabilities ? 'text-leaf' : 'text-bahi'}`}>{b.totalAssets === b.totalLiabilities ? '✓ Both sides match to the rupee.' : `Difference of ${inr(b.totalAssets - b.totalLiabilities)}. Tell your CA.`}</p>
    </>
  )
}

async function TB({ orgId, to }: { orgId: number; to: string }) {
  const t = await trialBalance(orgId, to)
  let grp = ''
  return (
    <div className="card overflow-x-auto">
      <table className="table min-w-[560px]">
        <thead><tr><th>Ledger</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
        <tbody className="num">
          {t.lines.flatMap((l) => {
            const head = l.grp !== grp ? (grp = l.grp, [<tr key={'g' + l.grp}><td colSpan={3} className="bg-paper-2/50 text-[12px] font-semibold uppercase tracking-wide text-muted">{l.grp}</td></tr>]) : []
            return [...head, <tr key={l.id + l.name}><td>{l.id ? <Link href={`/books/ledgers/${l.id}`} className="hover:text-bahi">{l.name}</Link> : l.name}</td><td className="text-right">{l.debit ? inr(l.debit) : ''}</td><td className="text-right">{l.credit ? inr(l.credit) : ''}</td></tr>]
          })}
          <tr className="font-semibold"><td>Total</td><td className="text-right">{inr(t.debit)}</td><td className="text-right">{inr(t.credit)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}
