import Anthropic from '@anthropic-ai/sdk'

// Brief and chat run on the main model; high-volume message parsing runs on the small one.
export const MAIN = process.env.PEDHI_MODEL ?? 'claude-opus-5-5'
export const FAST = process.env.PEDHI_FAST_MODEL ?? 'claude-haiku-5-5'

/** Without a key every AI feature falls back to its rule-based path, so the app never depends on the network. */
export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

let client: Anthropic | undefined
export const ai = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }))

export const textOf = (m: Anthropic.Message) =>
  m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()

export async function complete(system: string, user: string, model = MAIN, max_tokens = 2000) {
  const m = await ai().messages.create({
    model, max_tokens, system, output_config: { effort: 'low' }, messages: [{ role: 'user', content: user }],
  })
  if (m.stop_reason === 'refusal') throw new Error('model declined')
  return textOf(m)
}
