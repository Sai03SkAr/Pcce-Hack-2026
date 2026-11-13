// "Tell Pedhi": turns a spoken or typed sentence into a filled Books form. The user always confirms before saving.
import { q } from './db'
import { EXPENSES } from './books'
import { loadCatalogue, parseMessage } from './match'

export type Draft =
  | { action: 'receipt'; customerId?: number; amount?: number; accountId?: number }
  | { action: 'purchase'; supplierId?: number; lines: { itemId: number; qty: number; rate: number }[]; mode: 'credit' | 'paid'; accountId?: number }
  | { action: 'supplier'; supplierId?: number; amount?: number; accountId?: number }
  | { action: 'expense'; ledgerId?: number; amount?: number; accountId?: number; gstRate?: number; note?: string }
  | { action: 'move'; fromId?: number; toId?: number; amount?: number }
  | { action: 'owner'; dir: 'take' | 'add'; amount?: number; accountId?: number }
  | { action: 'unknown' }

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t))

export async function parseBookSentence(orgId: number, raw: string): Promise<Draft> {
  const t = raw.toLowerCase().replace(/[’']/g, '')
  const ledgers = await q<any>(`SELECT id, name, grp, kind, branch_id, supplier_id FROM ledgers WHERE org_id=?`, [orgId])
  const suppliers = await q<any>('SELECT id, name, aliases FROM suppliers WHERE org_id=?', [orgId])
  const amt = /(?:₹|rs\.?\s*)?(\d[\d,]{1,})/.exec(t.replace(/(\d+)\s*(bag|bori|pc|kg|box|rod|nos|coil|bucket)/g, ''))
  const amount = amt ? +amt[1].replace(/,/g, '') : undefined

  // Which money accounts are named: banks by their first word ("hdfc", "sbi"), cash by "cash/nagad/galla" (+ branch)
  const banks = ledgers.filter((l) => l.grp === 'Bank Accounts')
  const cashes = ledgers.filter((l) => l.grp === 'Cash-in-Hand')
  const named: { id: number; at: number }[] = []
  for (const b of banks) { const w = b.name.split(' ')[0].toLowerCase(); const i = t.indexOf(w); if (i >= 0) named.push({ id: b.id, at: i }) }
  const ci = t.search(/\b(cash|nagad|galla|gulla|rokda)\b/)
  if (ci >= 0) named.push({ id: (cashes.find((c) => t.includes(c.name.split('- ')[1]?.toLowerCase())) ?? cashes[0]).id, at: ci })
  if (!named.some((n) => banks.some((b) => b.id === n.id)) && /\b(bank|upi|neft|online|cheque)\b/.test(t)) named.push({ id: banks[0].id, at: t.search(/\b(bank|upi|neft|online|cheque)\b/) })
  named.sort((a, b) => a.at - b.at)
  const account = named[0]?.id

  const supplier = suppliers.find((s) => [s.name.toLowerCase(), ...s.aliases.split(',')].some((a: string) => a && t.includes(a.trim())))
  const supplierId = supplier?.id

  // Cash ↔ bank
  if (named.length >= 2 && has(t, ['deposit', 'deposited', 'jama', 'transfer', 'transferred', 'moved', 'dala', 'daala', 'withdraw', 'withdrew', 'nikala', 'nikale'])) {
    const withdraw = has(t, ['withdraw', 'withdrew', 'nikala', 'nikale'])
    const [a, b] = [named[0].id, named[1].id]
    // "50000 cash HDFC mein jama" → cash to bank; "HDFC se 20000 nikale" → bank to cash
    const fromCash = cashes.some((c) => c.id === a)
    return { action: 'move', fromId: withdraw ? (fromCash ? b : a) : a, toId: withdraw ? (fromCash ? a : b) : b, amount }
  }
  if (named.length === 1 && has(t, ['deposit', 'deposited', 'withdraw', 'withdrew', 'nikala', 'nikale']) && !supplierId) {
    const bank = banks.some((b) => b.id === account) ? account : banks[0].id
    const withdraw = has(t, ['withdraw', 'withdrew', 'nikala', 'nikale'])
    return { action: 'move', fromId: withdraw ? bank : cashes[0].id, toId: withdraw ? cashes[0].id : bank, amount }
  }

  if (has(t, ['ghar', 'home', 'household', 'personal', 'drawings', 'kharcha ghar', 'family'])) return { action: 'owner', dir: 'take', amount, accountId: account }
  if (has(t, ['capital', 'invested', 'apna paisa', 'added money', 'put in'])) return { action: 'owner', dir: 'add', amount, accountId: account }

  const exp = EXPENSES.find((e) => e.words.some((w) => t.includes(w)))
  if (exp && !supplierId) {
    const ledgerId = ledgers.find((l) => l.name === exp.name)?.id
    const gst = /(\d+)\s*%?\s*gst/.exec(t)
    return { action: 'expense', ledgerId, amount, accountId: account, gstRate: gst ? +gst[1] : undefined, note: raw.slice(0, 80) }
  }

  if (supplierId) {
    const cat = await loadCatalogue(orgId)
    const p = parseMessage(raw, cat)
    if (p.lines.length || has(t, ['bought', 'kharida', 'kharidi', 'liya', 'liye', 'purchase', 'maal aaya', 'aaya', 'received', 'bill'])) {
      const cost = new Map((await q<any>('SELECT id, cost FROM items WHERE org_id=?', [orgId])).map((i) => [i.id, i.cost]))
      return {
        action: 'purchase', supplierId, mode: has(t, ['paid', 'cash', 'nagad', 'turant', 'abhi diya']) ? 'paid' : 'credit', accountId: account,
        lines: p.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, rate: cost.get(l.itemId) ?? 0 })),
      }
    }
    return { action: 'supplier', supplierId, amount, accountId: account }
  }

  const cust = parseMessage(raw, await loadCatalogue(orgId)).customerId
  if (cust) return { action: 'receipt', customerId: cust, amount, accountId: account }
  return { action: 'unknown' }
}
