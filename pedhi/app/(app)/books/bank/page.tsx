import Link from 'next/link'
import { fmtDay, inr, today } from '@/lib/format'
import { accounts } from '@/lib/books'
import { bankReco } from '@/lib/reports'
import { getUser } from '@/lib/session'
import { ClearLine } from './ClearLine'

export default async function Bank({ searchParams }: PageProps<'/books/bank'>) {
  const u = await getUser()
  const sp = await searchParams
  const banks = (await accounts(u.org_id)).filter((a) => a.grp === 'Bank Accounts')
  const id = Number(sp.l) || banks[0]?.id
  const to = typeof sp.to === 'string' ? sp.to : today()
  const r = id ? await bankReco(u.org_id, id, to) : null
  const canEdit = u.role !== 'staff'
  return (
    <div className="space-y-5">
      <div><h1 className="display text-[26px] font-semibold">Bank reconciliation</h1>
        <p className="max-w-2xl text-[13.5px] text-muted">Match your books with the bank statement. Tick each entry when it shows in the bank. What is left explains why the bank balance differs from the books.</p></div>
      <div className="flex flex-wrap gap-1.5">
        {banks.map((b) => <Link key={b.id} href={`/books/bank?l=${b.id}`} className={`chip h-8 px-3 text-[13px] ${b.id === id ? 'bg-ink text-paper' : 'chip-grey'}`}>{b.name}</Link>)}
      </div>
      {r && (
        <>
          <div className="grid gap-2.5 sm:grid-cols-4">
            {[['Balance in the books', r.books, ''], ['Deposits not yet in bank', r.pendingIn, 'less'], ['Payments not yet in bank', r.pendingOut, 'add'], ['Should match the bank statement', r.bank, '']].map(([l, v, s]) => (
              <div key={l as string} className={`card p-4 ${l === 'Should match the bank statement' ? 'bg-gold-soft/50' : ''}`}>
                <div className="eyebrow">{l}</div><div className="num mt-1 text-[20px] font-semibold">{s === 'less' ? '− ' : s === 'add' ? '+ ' : ''}{inr(v as number)}</div></div>))}
          </div>
          <section>
            <h2 className="mb-2 font-semibold">Not yet in the bank statement ({r.open.length})</h2>
            <ul className="card divide-y divide-line">
              {r.open.slice(0, 60).map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13.5px]">
                  <span className="w-14 text-muted num">{fmtDay(x.day)}</span>
                  <span className="min-w-0 flex-1 truncate">{x.narration}</span>
                  <span className={`num font-semibold ${x.amount > 0 ? 'text-leaf' : ''}`}>{x.amount > 0 ? '+' : '−'}{inr(Math.abs(x.amount))}</span>
                  {canEdit && <ClearLine id={x.id} day={x.day} />}
                </li>
              ))}
              {!r.open.length && <li className="p-6 text-center text-leaf">Everything in the books is in the bank. The balances match.</li>}
            </ul>
          </section>
          {r.cleared.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Recently matched</h2>
              <ul className="card divide-y divide-line text-[13px]">
                {r.cleared.map((x) => <li key={x.id} className="flex items-center gap-3 px-4 py-2"><span className="w-28 text-muted num">bank {fmtDay(x.bank_date)}</span><span className="min-w-0 flex-1 truncate">{x.narration}</span>
                  <span className="num">{inr(Math.abs(x.amount))}</span>{canEdit && <ClearLine id={x.id} day={x.day} cleared />}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
