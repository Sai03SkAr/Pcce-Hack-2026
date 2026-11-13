import { one } from '@/lib/db'
import { getUser } from '@/lib/session'

// Every write leaves an audit row, so its latest id says whether anything changed since the page loaded.
export async function GET() {
  const u = await getUser()
  const r = await one<{ v: number | null }>('SELECT MAX(id) v FROM audit WHERE org_id=?', [u.org_id])
  return Response.json({ v: r?.v ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}
