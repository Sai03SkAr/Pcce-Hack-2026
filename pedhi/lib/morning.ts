// The 7 am brief, sent on WhatsApp to every owner and family member who has a number. Once per person per day.
import { one, q, run } from './db'
import { nowTs, today } from './format'
import { getBrief } from './brief'
import { userById } from './session'
import { sendText, waEnabled } from './whatsapp'

export async function sendMorningBriefs() {
  const out: { name: string; sent: boolean; reason?: string }[] = []
  if (!waEnabled()) return out
  const T = today()
  for (const { id } of await q<{ id: number }>(`SELECT id FROM users WHERE role IN ('owner','family') AND phone IS NOT NULL AND phone <> ''`)) {
    const u = (await userById(id))!
    if (await one(`SELECT 1 FROM messages WHERE user_id=? AND dir='out' AND ts >= ? AND meta LIKE '%"morning"%'`, [u.id, T])) continue
    const b = await getBrief(u, { orgId: u.org_id, branchId: u.branch_id }, u.lang)
    const r = await sendText(u.phone, b.body)
    await run('INSERT INTO messages (org_id, user_id, dir, body, ts, meta) VALUES (?,?,?,?,?,?)', [u.org_id, u.id, 'out', b.body, nowTs(), JSON.stringify({ kind: 'brief', morning: true, sent: r.sent })])
    out.push({ name: u.name, sent: r.sent, reason: r.sent ? undefined : r.reason })
  }
  return out
}
