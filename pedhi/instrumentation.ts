// Runs once when the server starts. On a laptop or office PC there is no cloud scheduler, so the server itself
// sends the 7:00 am brief: it checks every minute and sends once a day (sendMorningBriefs skips anyone already sent).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VERCEL || process.env.PEDHI_SCHEDULER === 'off') return
  const { sendMorningBriefs } = await import('./lib/morning')
  const { nowTs } = await import('./lib/format')
  let last = ''
  setInterval(() => {
    const ts = nowTs() // India time
    const day = ts.slice(0, 10), hour = +ts.slice(11, 13)
    if (hour !== 7 || last === day) return
    last = day
    sendMorningBriefs().then((r) => r.length && console.log('morning brief', r)).catch((e) => console.error('morning brief failed', e))
  }, 60_000)
}
