import { q } from '@/lib/db'
import { stockStatus } from '@/lib/metrics'
import { getScope, getUser, seesMoney } from '@/lib/session'
import { StockGrid } from './StockGrid'

export default async function Inventory({ searchParams }: PageProps<'/inventory'>) {
  const u = await getUser()
  const scope = await getScope(u)
  const sp = await searchParams
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [u.org_id])
  // Everyone sees stock in every branch (to know where to send a customer); only their own branch is actionable.
  const rows = await stockStatus({ orgId: u.org_id })
  const money = seesMoney(u)
  return (
    <StockGrid rows={rows.map((r) => ({ ...r, value: money ? r.value : 0, cost: money ? r.cost : 0 }))} branches={branches}
      focus={scope.branchId ?? null} canManage={u.role !== 'staff' && u.role !== 'ca'} myBranch={u.branch_id} money={money}
      filter={typeof sp.f === 'string' ? sp.f : 'all'} />
  )
}
