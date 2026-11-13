import { createHmac, timingSafeEqual } from 'node:crypto'
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

// Meta signs every POST with the app secret; without WHATSAPP_APP_SECRET set, anyone could post fake messages.
function signed(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // dev and demo only
  const want = Buffer.from('sha256=' + createHmac('sha256', secret).update(raw).digest('hex'))
  const got = Buffer.from(header ?? '')
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!signed(raw, req.headers.get('x-hub-signature-256'))) return new Response('Bad signature', { status: 401 })
  await ready()
  let body: any = null
  try { body = JSON.parse(raw) } catch {}
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
