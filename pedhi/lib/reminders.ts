// Automatic udhaar reminders: customers past their credit days get a WhatsApp reminder, then again every N days.
import { one, q, run } from './db'
import { addDays, today } from './format'
import { receivables } from './metrics'
import { audit, reminderFor } from './ops'
import type { User } from './session'
import { sendText } from './whatsapp'
import { OpError } from './errors'

export async function reminderSettings(orgId: number) {
  return (await one<{ remind_after_days: number | null; remind_every_days: number }>('SELECT remind_after_days, remind_every_days FROM orgs WHERE id=?', [orgId]))!
}

export async function saveReminderSettings(u: User, on: boolean, afterDays: number, everyDays: number) {
  if (u.role !== 'owner' && u.role !== 'family') throw new OpError('Only the family can change automatic reminders.')
  if (!Number.isInteger(afterDays) || afterDays < 0 || afterDays > 90 || !Number.isInteger(everyDays) || everyDays < 1 || everyDays > 60) throw new OpError('Pick 0-90 days after due, repeating every 1-60 days.')
  await run('UPDATE orgs SET remind_after_days=?, remind_every_days=? WHERE id=?', [on ? afterDays : null, everyDays, u.org_id])
  await audit(u, u.org_id, 'reminder_settings', on ? `Automatic reminders on: ${afterDays} days after due, every ${everyDays} days` : 'Automatic reminders off')
}

/** Who is due a reminder today, and (unless dryRun) send them. Without the WhatsApp API the messages are prepared, not sent. */
export async function runReminders(orgId: number, by: User | null, dryRun = false) {
  const set = await reminderSettings(orgId)
  const after = set.remind_after_days ?? 0
  const T = today()
  const last = new Map((await q<any>('SELECT id, last_reminded FROM customers WHERE org_id=?', [orgId])).map((c) => [c.id, c.last_reminded as string | null]))
  const due = (await receivables({ orgId })).filter((r) => r.overdue > 0 && r.oldest_days >= r.credit_days + after && r.phone
    && (!last.get(r.customer_id) || last.get(r.customer_id)! <= addDays(T, -set.remind_every_days)))
  const actor = by ?? ({ id: 0, org_id: orgId } as User)
  const out = []
  for (const r of due) {
    const m = await reminderFor(actor, r.customer_id, 'hi')
    const sent = dryRun ? { sent: false } : await sendText(m.phone, m.text)
    if (!dryRun) {
      await run('UPDATE customers SET last_reminded=? WHERE id=?', [T, r.customer_id])
      await audit(by, orgId, 'auto_reminder', `Reminder for ₹${m.amount} to ${m.name}${sent.sent ? ' sent on WhatsApp' : ' prepared (WhatsApp not connected)'}`)
    }
    out.push({ ...m, sent: sent.sent })
  }
  return out
}
