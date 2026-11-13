// Turning a typed or spoken message into items, quantities, a customer and a payment mode, without a model.
import { q } from './db'

export type Named = { id: number; name: string; aliases: string }
export type Catalogue = { items: (Named & { unit: string; price: number })[]; customers: (Named & { branch_id: number })[]; suppliers?: Named[] }

export async function loadCatalogue(orgId: number): Promise<Catalogue> {
  return {
    items: await q('SELECT id, name, aliases, unit, price FROM items WHERE org_id=?', [orgId]),
    customers: await q('SELECT id, name, aliases, branch_id FROM customers WHERE org_id=?', [orgId]),
    suppliers: await q('SELECT id, name, aliases FROM suppliers WHERE org_id=?', [orgId]),
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
  intent: 'sale' | 'payment' | 'stock_in' | 'other'
  lines: { itemId: number; name: string; unit: string; qty: number }[]
  customerId: number | null; mode: 'cash' | 'upi' | 'credit' | null; amount: number | null
  /** goods named with a quantity and unit that are not in the stock list, e.g. "10 bag birla cement" */
  unknown?: { name: string; qty: number; unit: string }[]
  supplierId?: number | null; expiry?: string | null
}

const STOCK_IN = /\b(aaya|aaye|aayi|aa gaya|aa gaye|aa gayi|received|arrived|came in|stock in|inward|delivery|maal aaya)\b/
const STOP = '(?=\\s+(?:to|ko|for|from|se|and|aur|on|in|at|udhaar|udhar|credit|cash|upi|aaya|aaye|aayi|aa|received|arrived|came|diya|diye|exp|expiry)\\b|[,.;]|$)'

/** "exp 12/2026", "expiry 15-01-2027": the last usable day, or null. Month-only dates mean the month's last day. */
export function parseExpiry(text: string): string | null {
  const m = /\b(?:exp|expiry|use by|best before)\s*:?\s*(?:(\d{1,2})[/-])?(\d{1,2})[/-](\d{2}|\d{4})\b/.exec(text)
  if (!m) return null
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2]
  if (mo < 1 || mo > 12) return null
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const d = m[1] ? +m[1] : last
  if (d < 1 || d > last) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseMessage(raw: string, cat: Catalogue): Parsed {
  let text = norm(raw)
  const cust = findAll(text, cat.customers)
  text = cust.text
  const sups = findAll(text, cat.suppliers ?? []) // "from Goa Cement Agencies" must not read as cement
  text = sups.text
  const named = text
  const found = findAll(text, cat.items)
  text = found.text

  // "10 bag dalmia cement": a word we don't know right before a short name like "cement" is a different brand, not ACC.
  const brands: { name: string; qty: number; unit: string }[] = []
  const lines = found.hits.flatMap((h) => {
    const brand = new RegExp(`(?:^|\\s)(\\d+)\\s*(${UNIT})?\\s+(?!${UNIT}\\b)([a-z]{3,}(?: [a-z]{3,})?)\\s*$`).exec(text.slice(0, h.index))
    if (brand && !/\b(wala|wali|aur|and|more|aaya|ka|ki|ke|of)\b/.test(brand[3])) {
      brands.push({ qty: +brand[1], unit: (brand[2] ?? h.row.unit).replace(/^bori$/, 'bag').replace(/s$/, ''), name: `${brand[3]} ${named.slice(h.index, h.index + h.length)}` })
      text = blank(text, brand.index, h.index + h.length - brand.index)
      return []
    }
    // quantity sits just before the item ("10 bori acc cement") or just after it ("acc cement 10")
    const before = new RegExp(`(\\d+)\\s*${UNIT}?\\s*$`).exec(text.slice(0, h.index))
    const after = new RegExp(`^\\s*(?:x\\s*)?(\\d+)(?![\\d.]|\\s*(?:mm|rs|rupay|rupee))`).exec(text.slice(h.index + h.length))
    let qty = 1
    if (before) { qty = +before[1]; text = blank(text, before.index, before[1].length) }
    else if (after) { qty = +after[1]; const i = h.index + h.length + after[0].indexOf(after[1]); text = blank(text, i, after[1].length) }
    return [{ itemId: h.row.id, name: h.row.name, unit: h.row.unit, qty }]
  })

  const amt = /(?:₹|rs\.?|rupaye|rupees)\s*(\d[\d,]*)/.exec(text) ?? /(\d[\d,]{2,})/.exec(text)
  const amount = amt ? +amt[1].replace(/,/g, '') : null
  const mode = /\b(udhaar|udhar|udhari|credit|khata|khate|baki|baaki)\b/.test(text) ? 'credit'
    : /\b(upi|gpay|google pay|phonepe|paytm|online|qr)\b/.test(text) ? 'upi'
    : /\b(cash|nagad|rokda)\b/.test(text) ? 'cash' : null
  const paid = /\b(paid|payment|jama|received|mila|mile|chukaya|bheja|bheje|de diya|de diye|de gaya|ne diya|ne diye)\b/.test(text)
  const customerId = cust.hits[0]?.row.id ?? null

  // What is left after every known name is blanked: "<qty> <unit> <words>" is goods we don't stock yet.
  const unknown = [...brands, ...[...text.matchAll(new RegExp(`(?:^|\\s)(\\d+)\\s*(${UNIT})\\s+([a-z][a-z0-9 ]{2,40}?)${STOP}`, 'g'))]
    .map((m) => ({ qty: +m[1], unit: m[2].replace(/^bori$/, 'bag').replace(/s$/, ''), name: m[3].trim() }))
    .filter((u) => u.name.length > 2 && !/^(ka|ki|ke|ko|wala|wali)$/.test(u.name))]
  const sup = sups.hits[0]?.row.id ?? null
  const stockIn = STOCK_IN.test(norm(raw)) && !customerId && (lines.length > 0 || unknown.length > 0)

  const intent = stockIn ? 'stock_in' : !lines.length && customerId && amount && (paid || mode === 'upi' || mode === 'cash') ? 'payment' : lines.length || unknown.length ? 'sale' : 'other'
  return { intent, lines, customerId, mode, amount, unknown, supplierId: sup, expiry: parseExpiry(norm(raw)) }
}
