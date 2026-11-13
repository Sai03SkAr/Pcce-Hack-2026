import { handleInbound } from '@/lib/ingest'
import { ready } from '@/lib/seed'
import { userByPhone } from '@/lib/session'
import { sendText } from '@/lib/whatsapp'

// Meta calls GET once to verify the webhook.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  return new Response('Forbidden', { status: 403 })
}

// shortcut: no X-Hub-Signature-256 check yet; add it with the app secret before using a production number.
export async function POST(req: Request) {
  await ready()
  const body = await req.json().catch(() => null)
  const msgs = body?.entry?.flatMap((e: any) => e.changes?.flatMap((c: any) => c.value?.messages ?? []) ?? []) ?? []
  for (const m of msgs) {
    if (m.type !== 'text' || !m.from) continue
    const u = await userByPhone(String(m.from))
    if (!u) continue // unknown numbers are ignored: only the business's own people can write to the books
    const r = await handleInbound(u, String(m.text?.body ?? ''))
    await sendText(u.phone, r.reply)
  }
  return Response.json({ ok: true })
}
