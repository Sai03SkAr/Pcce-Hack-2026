import { q } from '@/lib/db'
import { today } from '@/lib/format'
import { TABLES } from '@/lib/schema'
import { getUser } from '@/lib/session'

// Everything in one file: the owner keeps it safe, and can restore it on any machine.
export async function GET() {
  const u = await getUser()
  if (u.role !== 'owner' && u.role !== 'family') return new Response('Only the family can download a backup.', { status: 403 })
  const tables: Record<string, unknown[]> = {}
  for (const t of TABLES) tables[t] = await q(`SELECT * FROM ${t}`)
  const body = JSON.stringify({ app: 'pedhi', version: 1, exported_at: new Date().toISOString(), org: u.org, tables })
  return new Response(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="pedhi-backup-${today()}.json"` } })
}
