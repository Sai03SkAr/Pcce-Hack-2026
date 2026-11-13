import { redirect } from 'next/navigation'
import { q } from '@/lib/db'
import { today } from '@/lib/format'
import { accounts } from '@/lib/books'
import { booksFrom, ledgerBalances } from '@/lib/reports'
import { receivables } from '@/lib/metrics'
import { getScope, getUser } from '@/lib/session'
import { EntryForm } from './EntryForm'

export default async function NewEntry({ searchParams }: PageProps<'/books/new'>) {
  const u = await getUser()
  if (u.role === 'ca') redirect('/books')
  const sp = await searchParams
  const scope = await getScope(u)
  const T = today()
  const [accs, bal, rec, suppliers, items, branches, expenses] = await Promise.all([
    accounts(u.org_id), ledgerBalances(u.org_id, await booksFrom(u.org_id), T), receivables(scope),
    q<any>(`SELECT s.id, s.name, s.state, s.gstin, l.id ledger_id FROM suppliers s JOIN ledgers l ON l.supplier_id=s.id WHERE s.org_id=? ORDER BY s.name`, [u.org_id]),
    q<any>('SELECT id, name, aliases, unit, cost, gst_rate FROM items WHERE org_id=? ORDER BY name', [u.org_id]),
    q<any>('SELECT id, name FROM branches WHERE org_id=? AND (? IS NULL OR id=?) ORDER BY id', [u.org_id, u.branch_id, u.branch_id]),
    q<any>(`SELECT id, name, grp FROM ledgers WHERE org_id=? AND grp IN ('Indirect Expenses','Direct Expenses') ORDER BY id`, [u.org_id]),
  ])
  const balOf = (id: number) => bal.find((b) => b.id === id)?.closing ?? 0
  let draft: any = null
  try { draft = typeof sp.d === 'string' ? JSON.parse(sp.d) : null } catch {}
  const pre = { item: Number(sp.item) || undefined, branch: Number(sp.branch) || undefined, qty: Number(sp.qty) || undefined }
  return (
    <EntryForm
      action={typeof sp.a === 'string' ? sp.a : 'expense'} draft={draft} pre={pre}
      accounts={accs.filter((a) => !u.branch_id || a.grp === 'Bank Accounts' || a.branch_id === u.branch_id).map((a) => ({ id: a.id, name: a.name, bank: a.grp === 'Bank Accounts', branch_id: a.branch_id, balance: balOf(a.id) }))}
      customers={rec.map((r) => ({ id: r.customer_id, name: r.name, owes: r.outstanding }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, state: s.state, owes: -balOf(s.ledger_id) }))}
      items={items} branches={branches} defaultBranch={scope.branchId ?? u.branch_id ?? 1} expenses={expenses}
      isFamily={u.role === 'owner' || u.role === 'family'}
    />
  )
}
