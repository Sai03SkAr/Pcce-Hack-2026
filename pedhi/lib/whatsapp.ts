// Meta WhatsApp Cloud API. With no token configured, messages only go to the in-app simulator.
const GRAPH = 'https://graph.facebook.com/v23.0'

export const waEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

/** Plain text works inside the 24-hour window after the user last wrote; outside it Meta requires an approved template. */
export async function sendText(to: string, body: string) {
  if (!waEnabled()) return { sent: false as const, reason: 'WhatsApp is not configured' }
  const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4096), preview_url: false } }),
  })
  if (!r.ok) {
    const err = await r.text()
    console.error('whatsapp send failed', r.status, err)
    return { sent: false as const, reason: `WhatsApp returned ${r.status}` }
  }
  return { sent: true as const }
}
