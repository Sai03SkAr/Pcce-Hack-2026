import { q } from '@/lib/db'
import { aiEnabled } from '@/lib/llm'
import { getScope, getUser } from '@/lib/session'
import { getLang } from '../actions'
import { Shell } from '@/components/Shell'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const u = await getUser()
  const scope = await getScope(u)
  const branches = await q<{ id: number; name: string }>('SELECT id, name FROM branches WHERE org_id=? ORDER BY id', [u.org_id])
  return (
    <Shell user={{ name: u.name, role: u.role, title: u.title, branch: u.branch, org: u.org, demo: u.org_id === 1 }} branches={branches}
      branchId={scope.branchId ?? null} lang={await getLang()} ai={aiEnabled()}>
      {children}
    </Shell>
  )
}
