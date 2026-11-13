// Turning a typed or spoken message into items, quantities, a customer and a payment mode, without a model.
import { q } from './db'

export type Named = { id: number; name: string; aliases: string }
export type Catalogue = { items: (Named & { unit: string; price: number })[]; customers: (Named & { branch_id: number })[] }

export async function loadCatalogue(orgId: number): Promise<Catalogue> {
  return {
    items: await q('SELECT id, name, aliases, unit, price FROM items WHERE org_id=?', [orgId]),
    customers: await q('SELECT id, name, aliases, branch_id FROM customers WHERE org_id=?', [orgId]),
  }
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ')
const blank = (s: string, i: number, n: number) => s.slice(0, i) + ' '.repeat(n) + s.slice(i + n)

/** Longest alias wins, and each matched span is blanked so "ultratech cement" never also matches "cement". */
function findAll<T extends Named>(text: string, rows: T[]) {
  const cands = rows
    .flatMap((r) => [norm(r.name), ...r.aliases.split(',')].map((a) => ({ a: a.trim(), r })))
    .filter((c) => c.a).sort((x, y) => y.a.length - x.a.length)
  const hits: { row: T; index: number; length: number }[] = []
  for (const c of cands) {
    if (hits.some((h) => h.row.id === c.r.id)) continue
    const m = new RegExp(`(^|[^a-z0-9])${esc(c.a)}(?![a-z0-9])`).exec(text)
    if (!m) continue
    const index = m.index + m[1].length
    hits.push({ row: c.r, index, length: c.a.length })
    text = blank(text, index, c.a.length)
  }
  return { hits: hits.sort((a, b) => a.index - b.index), text }
}

const UNIT = '(?:bori|bags?|pcs?|pieces?|nos|kg|box(?:es)?|dabba|rods?|buckets?|coils?|brass|pairs?|packets?|x)'

export type Parsed = {
  intent: 'sale' | 'payment' | 'other'
  lines: { itemId: number; name: string; unit: string; qty: number }[]
  customerId: number | null; mode: 'cash' | 'upi' | 'credit' | null; amount: number | null
}

export function parseMessage(raw: string, cat: Catalogue): Parsed {
  let text = norm(raw)
  const cust = findAll(text, cat.customers)
  text = cust.text
  const found = findAll(text, cat.items)
  text = found.text

  const lines = found.hits.map((h) => {
    // quantity sits just before the item ("10 bori acc cement") or just after it ("acc cement 10")
    const before = new RegExp(`(\\d+)\\s*${UNIT}?\\s*$`).exec(text.slice(0, h.index))
    const after = new RegExp(`^\\s*(?:x\\s*)?(\\d+)(?![\\d.]|\\s*(?:mm|rs|rupay|rupee))`).exec(text.slice(h.index + h.length))
    let qty = 1
    if (before) { qty = +before[1]; text = blank(text, before.index, before[1].length) }
    else if (after) { qty = +after[1]; const i = h.index + h.length + after[0].indexOf(after[1]); text = blank(text, i, after[1].length) }
    return { itemId: h.row.id, name: h.row.name, unit: h.row.unit, qty }
  })

  const amt = /(?:₹|rs\.?|rupaye|rupees)\s*(\d[\d,]*)/.exec(text) ?? /(\d[\d,]{2,})/.exec(text)
  const amount = amt ? +amt[1].replace(/,/g, '') : null
  const mode = /\b(udhaar|udhar|udhari|credit|khata|khate|baki|baaki)\b/.test(text) ? 'credit'
    : /\b(upi|gpay|google pay|phonepe|paytm|online|qr)\b/.test(text) ? 'upi'
    : /\b(cash|nagad|rokda)\b/.test(text) ? 'cash' : null
  const paid = /\b(paid|payment|jama|received|mila|mile|chukaya|bheja|bheje|de diya|de diye|de gaya|ne diya|ne diye)\b/.test(text)
  const customerId = cust.hits[0]?.row.id ?? null

  const intent = !lines.length && customerId && amount && (paid || mode === 'upi' || mode === 'cash') ? 'payment' : lines.length ? 'sale' : 'other'
  return { intent, lines, customerId, mode, amount }
}
