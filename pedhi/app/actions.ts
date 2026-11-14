'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { one, run } from '@/lib/db'
import { today, type Lang } from '@/lib/format'
import { getBrief } from '@/lib/brief'
import { answer, type Answer } from '@/lib/chat'
import { handleInbound } from '@/lib/ingest'
import { commitImport, parseTable, previewRows, smartMapping, type Mapping, type Preview } from '@/lib/importer'
import { adjustStock, audit, OpError, recordPayment, recordSale, reminderFor, transferStock, undoSale, type SaleInput } from '@/lib/ops'
import { seed } from '@/lib/seed'
import { getScope, getUser, isFamily, userById } from '@/lib/session'
import { sendText, waEnabled } from '@/lib/whatsapp'
import * as Books from '@/lib/books'
import { checkPassword, hashPassword, lockedFor, noteAttempt, signSession } from '@/lib/auth'
import { parseBookSentence } from '@/lib/bookParse'

export type Result<T = unknown> = { ok: true; data: T; message?: string } | { ok: false; error: string }

// Business-rule errors go back to the screen as text; anything else is a bug and is logged.
async function act<T>(fn: () => Promise<T>, message?: string): Promise<Result<T>> {
  try {
    const data = await fn()
    refresh()
    return { ok: true, data, message }
  } catch (e) {
    if (e instanceof OpError) return { ok: false, error: e.message }
    if (e && typeof e === 'object' && 'digest' in e) throw e // let redirect() through
    console.error(e)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get('pedhi_lang')?.value
  return c === 'hi' || c === 'en' ? c : (await getUser()).lang
}

const COOKIE = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }

/** Pick a person, then their password. Five wrong tries lock that person for a minute. */
export async function login(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const u = await userById(Number(form.get('user')))
  if (!u) return { error: 'Pick who you are.' }
  const wait = lockedFor(u.id)
  if (wait) return { error: `Too many wrong tries. Wait ${wait} seconds.` }
  const row = await one<{ pass_hash: string | null }>('SELECT pass_hash FROM users WHERE id=?', [u.id])
  const ok = checkPassword(String(form.get('password') ?? ''), row?.pass_hash)
  noteAttempt(u.id, ok)
  if (!ok) return { error: 'Wrong password. Try again.' }
  const c = await cookies()
  c.set('pedhi_uid', await signSession(u.id), COOKIE)
  c.delete('pedhi_branch')
  c.delete('pedhi_lang')
  await audit(u, u.org_id, 'login', `${u.name} signed in`)
  redirect(u.role === 'staff' ? '/bill' : u.role === 'ca' ? '/books' : '/')
}

export async function logout() {
  ;(await cookies()).delete('pedhi_uid')
  redirect('/login')
}

export async function setBranch(branchId: number | null) {
  const c = await cookies()
  if (branchId) c.set('pedhi_branch', String(branchId), COOKIE)
  else c.delete('pedhi_branch')
  refresh()
}

export async function setLang(lang: Lang) {
  ;(await cookies()).set('pedhi_lang', lang, COOKIE)
  refresh()
}

export async function createSale(input: SaleInput) {
  const u = await getUser()
  return act(async () => {
    const s = await recordSale(u, input)
    return { id: s.id, total: s.total }
  })
}

export async function cancelSale(saleId: number) {
  const u = await getUser()
  return act(() => undoSale(u, saleId).then(() => null), 'Bill cancelled and stock returned.')
}

export async function addPayment(customerId: number, amount: number, mode: 'cash' | 'upi') {
  const u = await getUser()
  return act(() => recordPayment(u, customerId, amount, mode).then((r) => ({ balance: r.balance })), 'Payment recorded.')
}

export async function doTransfer(itemId: number, from: number, to: number, qty: number, insightId?: number) {
  const u = await getUser()
  return act(async () => {
    const r = await transferStock(u, itemId, from, to, qty)
    if (insightId) await run(`UPDATE insights SET status='done' WHERE id=? AND org_id=?`, [insightId, u.org_id])
    return r
  }, `Stock moved. The branch can sell again.`)
}

export async function doAdjust(itemId: number, branchId: number, qty: number, reason: string) {
  const u = await getUser()
  return act(() => adjustStock(u, itemId, branchId, qty, 'adjust', reason || 'Stock correction').then(() => null), 'Stock corrected.')
}

export async function setInsightStatus(id: number, status: 'open' | 'done' | 'dismissed') {
  const u = await getUser()
  return act(() => run('UPDATE insights SET status=? WHERE id=? AND org_id=?', [status, id, u.org_id]).then(() => null))
}

/** Builds each reminder with a UPI link; sends it over WhatsApp when the API is configured. */
export async function sendReminders(customerIds: number[], insightId?: number) {
  const u = await getUser()
  return act(async () => {
    const lang = await getLang()
    const out = []
    for (const id of customerIds) {
      const r = await reminderFor(u, id, lang)
      const sent = await sendText(r.phone, r.text)
      await audit(u, u.org_id, 'reminder', `Payment reminder for ₹${r.amount} to ${r.name}${sent.sent ? ' sent on WhatsApp' : ''}`)
      out.push({ ...r, sent: sent.sent })
    }
    if (insightId) await run(`UPDATE insights SET status='done' WHERE id=? AND org_id=?`, [insightId, u.org_id])
    return out
  })
}

export async function saveNotes(customerId: number, notes: string) {
  const u = await getUser()
  return act(async () => {
    if (!isFamily(u) && u.role !== 'manager') throw new OpError('Only family and managers can edit notes.')
    await run('UPDATE customers SET notes=? WHERE id=? AND org_id=?', [notes.slice(0, 1000), customerId, u.org_id])
    await audit(u, u.org_id, 'notes', `Updated notes for customer #${customerId}`)
    return null
  }, 'Notes saved.')
}

export async function regenerateBrief(lang: Lang) {
  const u = await getUser()
  const scope = await getScope(u)
  return act(() => getBrief(u, scope, lang, true).then((b) => ({ body: b.body, source: b.source })))
}

export async function ask(question: string): Promise<Result<Answer>> {
  const u = await getUser()
  const q = question.trim().slice(0, 500)
  if (!q) return { ok: false, error: 'Type a question.' }
  try {
    return { ok: true, data: await answer(u, await getScope(u), q) }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Could not answer that. Please try again.' }
  }
}

/** The WhatsApp simulator. Owners can test as any member of the business; everyone else only as themselves. */
export async function simulateMessage(asUserId: number, text: string) {
  const me = await getUser()
  const u = await userById(asUserId)
  if (!u || u.org_id !== me.org_id || (!isFamily(me) && u.id !== me.id)) return { ok: false as const, error: 'Not allowed.' }
  const r = await handleInbound(u, text.slice(0, 1000))
  refresh()
  return { ok: true as const, data: r }
}

export async function pushBrief(toUserId: number) {
  const me = await getUser()
  const u = await userById(toUserId)
  if (!u || u.org_id !== me.org_id || !isFamily(me)) return { ok: false as const, error: 'Not allowed.' }
  const b = await getBrief(u, { orgId: u.org_id, branchId: u.branch_id }, u.lang)
  await run('INSERT INTO messages (org_id, user_id, dir, body, ts, meta) VALUES (?,?,?,?,?,?)', [u.org_id, u.id, 'out', b.body, today() + ' 07:00:00', '{"kind":"brief"}'])
  const sent = await sendText(u.phone, b.body)
  refresh()
  return { ok: true as const, data: { sent: sent.sent, configured: waEnabled() } }
}

export async function previewImport(text: string, mapping?: Mapping) {
  const u = await getUser()
  const rows = parseTable(text)
  if (rows.length < 2) return { ok: false as const, error: 'Need a header row and at least one item.' }
  if (rows.length > 2001) return { ok: false as const, error: 'Up to 2,000 rows at a time.' }
  const m = mapping ? { mapping, source: 'manual' as const } : await smartMapping(rows)
  return { ok: true as const, data: { header: rows[0], mapping: m.mapping, source: m.source, rows: await previewRows(u.org_id, rows, m.mapping) } }
}

export async function confirmImport(branchId: number, rows: Preview[]) {
  const u = await getUser()
  return act(async () => {
    if (!isFamily(u) && u.role !== 'manager') throw new OpError('Imports need a manager or the owner.')
    if (u.branch_id && u.branch_id !== branchId) throw new OpError(`You can only import into ${u.branch}.`)
    if (!(await one('SELECT 1 FROM branches WHERE id=? AND org_id=?', [branchId, u.org_id]))) throw new OpError('Unknown branch.')
    return commitImport(u, branchId, rows.slice(0, 2000))
  })
}

export async function resetDemo() {
  const u = await getUser()
  if (u.role !== 'owner') return
  await seed()
  ;(await cookies()).delete('pedhi_branch')
  redirect('/')
}

/** Fills the bill screen from a typed or spoken sentence, using the same parser as WhatsApp. */
export async function quickParse(text: string) {
  const u = await getUser()
  const { loadCatalogue, parseMessage } = await import('@/lib/match')
  return parseMessage(text.slice(0, 500), await loadCatalogue(u.org_id))
}

// ---- Books ------------------------------------------------------------------------------------

const voucherOf = async (id: number) => {
  const { dayBook } = await import('@/lib/reports')
  const v = await one<any>('SELECT org_id, day FROM vouchers WHERE id=?', [id])
  return (await dayBook(v.org_id, v.day, v.day)).find((x) => x.id === id) ?? null
}

export async function bookReceipt(customerId: number, amount: number, mode: 'cash' | 'upi', accountId: number) {
  const u = await getUser()
  return act(async () => {
    await recordPayment(u, customerId, amount, mode, 'pos', accountId)
    const id = (await one<any>('SELECT MAX(id) id FROM vouchers WHERE org_id=?', [u.org_id]))!.id
    return voucherOf(id)
  }, 'Saved.')
}
export async function bookPurchase(input: Books.PurchaseIn) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.recordPurchase(u, input)).id), 'Saved. Stock added.')
}
export async function bookPaySupplier(supplierId: number, amount: number, accountId: number) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.paySupplier(u, supplierId, amount, accountId)).id), 'Saved.')
}
export async function bookExpense(e: { ledgerId: number; amount: number; accountId: number; gstRate?: number; note?: string }) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.recordExpense(u, e)).id), 'Saved.')
}
export async function bookMove(fromId: number, toId: number, amount: number) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.moveMoney(u, fromId, toId, amount)).id), 'Saved.')
}
export async function bookOwner(dir: 'take' | 'add', amount: number, accountId: number) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.ownerMoney(u, dir, amount, accountId)).id), 'Saved.')
}
export async function bookAddBank(name: string, opening: number) {
  const u = await getUser()
  return act(() => Books.addBank(u, name, opening), 'Bank account added.')
}
export async function bookAddSupplier(s: { name: string; phone?: string; gstin?: string; state?: string }) {
  const u = await getUser()
  return act(() => Books.addSupplier(u, s), 'Supplier added.')
}
export async function bookSignOff(upto: string, note: string) {
  const u = await getUser()
  return act(() => Books.signOff(u, upto, note), 'Signed off and locked.')
}
export async function bookReopen() {
  const u = await getUser()
  return act(() => Books.reopen(u), 'Reopened.')
}
export async function bookParse(text: string) {
  const u = await getUser()
  return parseBookSentence(u.org_id, text.slice(0, 300))
}

export async function helpAsk(question: string, path: string) {
  await getUser()
  const { helpAnswer } = await import('@/lib/help')
  const q = question.trim().slice(0, 300)
  return q ? helpAnswer(q, path.slice(0, 100)) : null
}

export async function bookAddCustomer(c: Books.CustomerIn) {
  const u = await getUser()
  return act(() => Books.addCustomer(u, c), 'Customer added.')
}
export async function bookSetCreditTerms(customerId: number, limit: number, days: number) {
  const u = await getUser()
  return act(() => Books.setCreditTerms(u, customerId, limit, days).then(() => null), 'Credit terms saved.')
}
export async function bookSetOpening(party: { customerId?: number; supplierId?: number }, amount: number, since?: string) {
  const u = await getUser()
  return act(() => Books.setOpeningBalance(u, party, amount, since), 'Old balance saved.')
}
export async function bookUdhaarEntry(customerId: number, kind: Books.UdhaarKind, amount: number, accountId?: number, note?: string) {
  const u = await getUser()
  return act(() => Books.udhaarEntry(u, customerId, kind, amount, accountId, note).then(() => null), 'Saved.')
}
/** Builds the customer's statement link from the address this app is being used at. */
export async function shareStatement(customerId: number, renew = false) {
  const u = await getUser()
  return act(async () => {
    const token = await Books.shareToken(u, customerId, renew)
    const { headers } = await import('next/headers')
    const h = await headers()
    const base = process.env.PUBLIC_URL || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`
    return `${base}/s/${token}`
  })
}
export async function bookAddItem(i: Books.ItemIn) {
  const u = await getUser()
  return act(() => Books.addItem(u, i), 'Item added.')
}
export async function bookCloseDay(branchId: number, counted: number, note: string) {
  const u = await getUser()
  return act(() => Books.closeDay(u, branchId, counted, note))
}
export async function bookReturnSale(saleId: number, lines: { itemId: number; qty: number }[], refund: 'account' | 'cash' | 'upi', note: string) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.returnSale(u, saleId, lines, refund, note)).id), 'Return saved. Stock is back.')
}
export async function bookReturnPurchase(p: { branchId: number; supplierId: number; lines: { itemId: number; qty: number; rate: number }[]; refundAccountId?: number; note?: string }) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.returnPurchase(u, p)).id), 'Return saved. Stock removed.')
}
export async function bookCreateLedger(name: string, grp: string) {
  const u = await getUser()
  return act(() => Books.createLedger(u, name, grp), 'Ledger created.')
}
export async function bookJournal(j: { day: string; narration: string; lines: { ledgerId: number; dr: number; cr: number }[] }) {
  const u = await getUser()
  return act(async () => voucherOf((await Books.postJournal(u, j)).id), 'Entry saved.')
}
export async function saveAutoReminders(on: boolean, afterDays: number, everyDays: number) {
  const u = await getUser()
  const { saveReminderSettings } = await import('@/lib/reminders')
  return act(() => saveReminderSettings(u, on, afterDays, everyDays), 'Saved.')
}
export async function runAutoRemindersNow() {
  const u = await getUser()
  if (u.role !== 'owner' && u.role !== 'family') return { ok: false as const, error: 'Only the family can send reminders in bulk.' }
  const { runReminders } = await import('@/lib/reminders')
  return act(() => runReminders(u.org_id, u))
}
export async function previewCustomerImport(text: string, mapping?: import('@/lib/importer').CMapping) {
  const u = await getUser()
  const { parseTable, guessCustomerMapping, previewCustomers } = await import('@/lib/importer')
  const rows = parseTable(text)
  if (rows.length < 2) return { ok: false as const, error: 'Need a header row and at least one customer.' }
  if (rows.length > 2001) return { ok: false as const, error: 'Up to 2,000 rows at a time.' }
  const m = mapping ?? guessCustomerMapping(rows[0])
  if (m.name === undefined) return { ok: false as const, error: 'Could not find a name column. Name the column "Name" or "Customer".' }
  return { ok: true as const, data: { header: rows[0], mapping: m, rows: await previewCustomers(u.org_id, rows, m) } }
}
export async function confirmCustomerImport(branchId: number, rows: import('@/lib/importer').CPreview[]) {
  const u = await getUser()
  const { commitCustomers } = await import('@/lib/importer')
  return act(async () => {
    if (u.role !== 'owner' && u.role !== 'family' && u.role !== 'manager') throw new OpError('Imports need a manager or the owner.')
    if (u.branch_id && u.branch_id !== branchId) throw new OpError(`You can only import into ${u.branch}.`)
    return commitCustomers(u, branchId, rows.slice(0, 2000))
  })
}
export async function setBankDate(lineId: number, date: string | null) {
  const u = await getUser()
  return act(async () => {
    if (u.role === 'staff') throw new OpError('Bank reconciliation is for the family, managers or the CA.')
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new OpError('Pick a date.')
    const l = await one<any>(`SELECT vl.id, v.day FROM voucher_lines vl JOIN vouchers v ON v.id=vl.voucher_id JOIN ledgers g ON g.id=vl.ledger_id
      WHERE vl.id=? AND v.org_id=? AND g.grp='Bank Accounts'`, [lineId, u.org_id])
    if (!l) throw new OpError('Entry not found.')
    if (date && date < l.day) throw new OpError('The bank date cannot be before the entry date.')
    await run('UPDATE voucher_lines SET bank_date=? WHERE id=?', [date, lineId])
    return null
  })
}
/** Replaces all data with a backup file. Owner only; the screen asks twice before calling this. */
export async function restoreBackup(text: string) {
  const u = await getUser()
  if (u.role !== 'owner') return { ok: false as const, error: 'Only the owner can restore a backup.' }
  let data: any
  try { data = JSON.parse(text) } catch { return { ok: false as const, error: 'That file is not a Pedhi backup.' } }
  const { TABLES, SCHEMA } = await import('@/lib/schema')
  if (data?.app !== 'pedhi' || typeof data.tables !== 'object') return { ok: false as const, error: 'That file is not a Pedhi backup.' }
  const names = Object.keys(data.tables)
  if (names.some((n) => !TABLES.includes(n) || !Array.isArray(data.tables[n]))) return { ok: false as const, error: 'The backup has tables this version does not know.' }
  if (!data.tables.orgs?.length || !data.tables.users?.some((x: any) => x.role === 'owner')) return { ok: false as const, error: 'The backup has no business or owner in it.' }
  const { db, tx } = await import('@/lib/db')
  await db.executeMultiple(TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n') + SCHEMA)
  await tx(async (t) => {
    for (const n of names) for (const row of data.tables[n] as Record<string, unknown>[]) {
      const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c))
      if (cols.length) await t.execute({ sql: `INSERT INTO ${n} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, args: cols.map((c) => row[c] as any) })
    }
  })
  ;(await cookies()).delete('pedhi_branch')
  redirect('/')
}

// Meta sends numbers as digits with the country code (919822012345), so store them that way.
export async function setUserPhone(userId: number, phone: string) {
  const u = await getUser()
  return act(async () => {
    if (!isFamily(u)) throw new OpError('Only the family can change WhatsApp numbers.')
    let d = phone.replace(/\D/g, '')
    if (d.length === 10) d = '91' + d
    if (d && (d.length < 11 || d.length > 15)) throw new OpError('Enter a 10-digit mobile number, or one with the country code.')
    const p = await userById(userId)
    if (!p || p.org_id !== u.org_id) throw new OpError('Person not found.')
    if (d && await one('SELECT id FROM users WHERE phone=? AND id<>?', [d, userId])) throw new OpError('Someone else already has this number.')
    await run('UPDATE users SET phone=? WHERE id=?', [d || null, userId])
    await audit(u, u.org_id, 'phone', `Set WhatsApp number for ${p.name}`)
    return null
  }, 'Number saved.')
}

/** The family sets anyone's password; everyone else can change only their own. */
export async function setPassword(userId: number, password: string) {
  const u = await getUser()
  return act(async () => {
    if (userId !== u.id && !isFamily(u)) throw new OpError('Only the family can change someone else’s password.')
    if (password.length < 6) throw new OpError('Use at least 6 characters.')
    const p = await userById(userId)
    if (!p || p.org_id !== u.org_id) throw new OpError('Person not found.')
    await run('UPDATE users SET pass_hash=? WHERE id=?', [hashPassword(password), userId])
    await audit(u, u.org_id, 'password', `Changed the password for ${p.name}`)
    return null
  }, 'Password changed.')
}
