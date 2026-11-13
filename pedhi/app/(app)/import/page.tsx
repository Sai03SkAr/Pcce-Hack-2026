import Link from 'next/link'
import { redirect } from 'next/navigation'
import { q } from '@/lib/db'
import { aiEnabled } from '@/lib/llm'
import { getScope, getUser } from '@/lib/session'
import { Importer } from './Importer'
import { CustomerImporter } from './CustomerImporter'

export default async function Import({ searchParams }: PageProps<'/import'>) {
  const u = await getUser()
  if (u.role === 'staff' || u.role === 'ca') redirect('/bill')
  const scope = await getScope(u)
  const kind = (await searchParams).kind === 'customers' ? 'customers' : 'items'
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? AND (? IS NULL OR id=?) ORDER BY id', [u.org_id, u.branch_id, u.branch_id])
  const tab = (k: string, l: string) => <Link href={k === 'items' ? '/import' : '/import?kind=customers'} className={`rounded-[8px] px-3 py-1.5 ${kind === k ? 'bg-ink text-paper' : 'text-muted'}`}>{l}</Link>
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="display text-[30px] font-semibold leading-tight">Bring your data in</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">Move from Excel, a paper khata, Khatabook, Vyapar or Tally in minutes. Messy column names are fine; you check everything before it is saved.</p></div>
        <div className="ml-auto flex rounded-[10px] border border-line-2 bg-card p-0.5 text-[13px] font-semibold">{tab('items', 'Stock items')}{tab('customers', 'Customers & old udhaar')}</div>
      </div>
      {kind === 'items' ? <Importer branches={branches} defaultBranch={scope.branchId ?? branches[0].id} ai={aiEnabled()} />
        : <CustomerImporter branches={branches} defaultBranch={scope.branchId ?? branches[0].id} />}
    </div>
  )
}
