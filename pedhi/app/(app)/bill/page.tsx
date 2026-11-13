import { redirect } from 'next/navigation'
import { q } from '@/lib/db'
import { receivables } from '@/lib/metrics'
import { getScope, getUser, seesMoney } from '@/lib/session'
import { BillForm } from './BillForm'

export default async function Bill() {
  const u = await getUser()
  if (u.role === 'ca') redirect('/books')
  const scope = await getScope(u)
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? AND (? IS NULL OR id=?) ORDER BY id', [u.org_id, u.branch_id, u.branch_id])
  const items = await q<any>(
    `SELECT i.id, i.name, i.aliases, i.category, i.unit, i.price, i.gst_rate, st.branch_id, st.qty,
       (SELECT COUNT(*) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.item_id=i.id AND s.day >= date('now','-30 day')) pop
     FROM items i JOIN stock st ON st.item_id=i.id WHERE i.org_id=? ORDER BY pop DESC, i.name`, [u.org_id])
  const rec = await receivables({ orgId: u.org_id })
  const customers = rec.map((r) => ({ id: r.customer_id, name: r.name, branch_id: r.branch_id, owes: r.outstanding, limit: r.credit_limit, oldest: r.oldest_days }))
  return (
    <BillForm branches={branches} defaultBranch={scope.branchId ?? u.branch_id ?? branches[0].id} items={items} customers={customers}
      canEditPrice={seesMoney(u)} isFamily={u.role === 'owner' || u.role === 'family'} />
  )
}
