import { redirect } from 'next/navigation'
import { q } from '@/lib/db'
import { today } from '@/lib/format'
import { OPEN_GROUPS } from '@/lib/books'
import { getUser } from '@/lib/session'
import { JournalForm } from './JournalForm'

export default async function Journal() {
  const u = await getUser()
  if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'ca') redirect('/books')
  const ledgers = await q<{ id: number; name: string; grp: string }>('SELECT id, name, grp FROM ledgers WHERE org_id=? ORDER BY grp, name', [u.org_id])
  return <JournalForm ledgers={ledgers} groups={OPEN_GROUPS} today={today()} />
}
