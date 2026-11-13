import { redirect } from 'next/navigation'
import { q } from '@/lib/db'
import { addDays, today } from '@/lib/format'
import { expectedCash } from '@/lib/books'
import { getScope, getUser } from '@/lib/session'
import { CloseDay } from './CloseDay'

export default async function Closing() {
  const u = await getUser()
  if (u.role === 'ca') redirect('/books')
  const scope = await getScope(u)
  const T = today()
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? AND (? IS NULL OR id=?) ORDER BY id', [u.org_id, u.branch_id, u.branch_id])
  const rows = await Promise.all(branches.map(async (b) => {
    const done = (await q<any>(`SELECT c.*, us.name user FROM cash_closings c LEFT JOIN users us ON us.id=c.user_id WHERE c.branch_id=? AND c.day=?`, [b.id, T]))[0] ?? null
    return { ...b, expected: (await expectedCash(u.org_id, b.id))?.expected ?? 0, done }
  }))
  const history = await q<any>(`SELECT c.day, c.expected, c.counted, b.name branch, us.name user FROM cash_closings c JOIN branches b ON b.id=c.branch_id
    LEFT JOIN users us ON us.id=c.user_id WHERE b.org_id=? AND c.day >= ? AND c.day < ?${u.branch_id ? ` AND c.branch_id=${Number(u.branch_id)}` : ''}
    ORDER BY c.day DESC, b.id`, [u.org_id, addDays(T, -7), T])
  return <CloseDay branches={rows} focus={scope.branchId ?? rows[0].id} history={history} />
}
