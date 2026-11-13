import Link from 'next/link'
import { inr, today } from '@/lib/format'
import { GROUPS } from '@/lib/books'
import { booksFrom, ledgerBalances } from '@/lib/reports'
import { getUser } from '@/lib/session'

const PLAIN: Record<string, string> = {
  'Capital Account': 'Owner’s money in the business', 'Sundry Creditors': 'Suppliers we owe', 'Duties & Taxes': 'GST collected and paid',
  'Sundry Debtors': 'Customers who owe us', 'Cash-in-Hand': 'Cash boxes', 'Bank Accounts': 'Bank accounts', 'Sales Accounts': 'Sales, by GST rate',
  'Purchase Accounts': 'Purchases, by GST rate', 'Direct Expenses': 'Costs of getting goods in', 'Indirect Expenses': 'Running costs', 'Indirect Incomes': 'Other income',
}

export default async function Ledgers({ searchParams }: PageProps<'/books/ledgers'>) {
  const u = await getUser()
  const sp = await searchParams
  const bal = await ledgerBalances(u.org_id, await booksFrom(u.org_id), today())
  const only = typeof sp.g === 'string' ? sp.g : null
  const groups = Object.keys(GROUPS).filter((g) => !only || g === only).map((g) => ({ g, ls: bal.filter((b) => b.grp === g && (b.closing || b.dr || b.cr)) })).filter((x) => x.ls.length)
  return (
    <div className="space-y-4">
      <div><h1 className="display text-[26px] font-semibold">Ledgers</h1><p className="text-[13.5px] text-muted">Every account Pedhi keeps for you, under the same group Tally would put it in. You never had to choose the group.</p></div>
      {only && <Link href="/books/ledgers" className="chip chip-grey h-7 px-3">Showing {only} · show all</Link>}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(({ g, ls }) => (
          <section key={g} className="card overflow-hidden">
            <div className="flex items-baseline border-b border-line bg-paper-2/50 px-4 py-2.5"><h2 className="font-semibold">{g}</h2><span className="ml-2 text-[12.5px] text-muted">{PLAIN[g]}</span>
              <span className="num ml-auto text-[13px] font-semibold">{inr(Math.abs(ls.reduce((s, l) => s + l.closing, 0)))} {ls.reduce((s, l) => s + l.closing, 0) >= 0 ? 'Dr' : 'Cr'}</span></div>
            <ul className="max-h-80 divide-y divide-line overflow-auto">
              {ls.sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing)).map((l) => (
                <li key={l.id}><Link href={`/books/ledgers/${l.id}`} className="flex px-4 py-2 text-[13.5px] hover:bg-paper-2/60"><span className="flex-1 truncate">{l.name}</span>
                  <span className="num font-medium">{inr(Math.abs(l.closing))} <span className="text-muted">{l.closing >= 0 ? 'Dr' : 'Cr'}</span></span></Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
