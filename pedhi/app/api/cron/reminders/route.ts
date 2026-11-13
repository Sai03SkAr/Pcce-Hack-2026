import { q } from '@/lib/db'
import { runReminders } from '@/lib/reminders'

// Called daily by the scheduler (vercel.json). Set CRON_SECRET; the scheduler sends it as a bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  const orgs = await q<{ id: number }>('SELECT id FROM orgs WHERE remind_after_days IS NOT NULL')
  const results = []
  for (const o of orgs) results.push({ org: o.id, reminders: (await runReminders(o.id, null)).map((r) => ({ name: r.name, amount: r.amount, sent: r.sent })) })
  return Response.json({ ok: true, results })
}
