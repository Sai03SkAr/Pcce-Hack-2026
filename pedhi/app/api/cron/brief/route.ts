import { sendMorningBriefs } from '@/lib/morning'

// Called at 7:00 IST by the scheduler (vercel.json on Vercel; instrumentation.ts when running on your own computer).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  return Response.json({ ok: true, results: await sendMorningBriefs() })
}
