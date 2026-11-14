import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

// Brief and chat run on the main model; high-volume message parsing runs on the small one.
export const MAIN = process.env.PEDHI_MODEL || 'claude-opus-5-5'
export const FAST = process.env.PEDHI_FAST_MODEL || 'claude-haiku-5-5'

/** Claude when there is an Anthropic key, else Groq (OpenAI-style API) when there is a Groq key, else none. */
export const provider = () =>
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? 'anthropic' : process.env.GROQ_API_KEY ? 'groq' : null

/** Without a key every AI feature falls back to its rule-based path, so the app never depends on the network. */
export const aiEnabled = () => !!provider()

let client: Anthropic | undefined
export const ai = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }))

export const textOf = (m: Anthropic.Message) =>
  m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim()

// ---- Groq --------------------------------------------------------------------------------------
export const groqModel = (model: string) =>
  model === FAST ? process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b' : process.env.GROQ_MODEL || 'openai/gpt-oss-120b'

export type GroqMsg = { role: string; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]; tool_call_id?: string }

export async function groq(body: Record<string, unknown>): Promise<GroqMsg> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reasoning_effort: 'low', ...body }),
  })
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return (await r.json()).choices[0].message
}

// ---- The two shapes every feature uses ----------------------------------------------------------
export async function complete(system: string, user: string, model = MAIN, max_tokens = 2000) {
  if (provider() === 'groq') {
    const m = await groq({ model: groqModel(model), max_completion_tokens: max_tokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    if (!m.content?.trim()) throw new Error('empty answer')
    return m.content.trim()
  }
  const m = await ai().messages.create({
    model, max_tokens, system, output_config: { effort: 'low' }, messages: [{ role: 'user', content: user }],
  })
  if (m.stop_reason === 'refusal') throw new Error('model declined')
  return textOf(m)
}

/** A typed answer: the model's JSON, checked against the schema. Null when it doesn't fit, so callers fall back to rules. */
export async function parseWith<T extends z.ZodType>(schema: T, o: { model: string; max_tokens: number; system: string; user: string }): Promise<z.infer<T> | null> {
  if (provider() === 'groq') {
    const m = await groq({
      model: groqModel(o.model), max_completion_tokens: o.max_tokens, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: `${o.system}\n\nReply with only a JSON object that matches this JSON schema:\n${JSON.stringify(z.toJSONSchema(schema))}` }, { role: 'user', content: o.user }],
    })
    try {
      const r = schema.safeParse(JSON.parse(m.content ?? ''))
      return r.success ? r.data : null
    } catch { return null }
  }
  const m = await ai().messages.parse({
    model: o.model, max_tokens: o.max_tokens, system: o.system, messages: [{ role: 'user', content: o.user }],
    output_config: { format: zodOutputFormat(schema as any), effort: 'low' },
  })
  return (m.parsed_output as z.infer<T>) ?? null
}
