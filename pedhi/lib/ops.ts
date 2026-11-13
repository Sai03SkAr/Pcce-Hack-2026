// Every write to the books goes through here: the bill screen, WhatsApp and the AI all share these rules.
import { one, q, run, tx } from './db'
import { nowTs, today } from './format'
import { receivables } from './metrics'
import { isFamily, type User } from './session'
import { OpError, audit } from './errors'
import { assertOpen, postReceipt, postSale, unpost } from './books'

export { OpError, audit }

function assertBranch(u: User, branchId: number) {
  if (u.branch_id && u.branch_id !== branchId) throw new OpError(`You can only work in ${u.branch}.`)
}

export type SaleInput = {
  branchId: number; customerId?: number | null; mode: 'cash' | 'upi' | 'credit'
  lines: { itemId: number; qty: number; price?: number }[]; source?: string
}

export async function recordSale(u: User, input: SaleInput) {
  assertBranch(u, input.branchId)
  if (!input.lines.length) throw new OpError('Add at least one item.')
  if (input.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0)) throw new OpError('Quantities must be whole numbers above zero.')
  if (input.mode === 'credit' && !input.customerId) throw new OpError('Udhaar needs a customer.')
  const branch = await one<any>('SELECT id, name, code FROM branches WHERE id=? AND org_id=?', [input.branchId, u.org_id])
  if (!branch) throw new OpError('Unknown branch.')

  const items = await q<any>(
    `SELECT i.*, COALESCE(st.qty,0) stock FROM items i LEFT JOIN stock st ON st.item_id=i.id AND st.branch_id=?
     WHERE i.org_id=? AND i.id IN (${input.lines.map(() => '?').join(',')})`, [input.branchId, u.org_id, ...input.lines.map((l) => l.itemId)])
  let total = 0, tax = 0, cost = 0
  const lines = input.lines.map((l) => {
    const it = items.find((i) => i.id === l.itemId)
    if (!it) throw new OpError('Unknown item.')
    if (it.stock < l.qty) throw new OpError(`Only ${it.stock} ${it.unit} of ${it.name} left at ${branch.name}.`)
    // only family and managers may change the price on a bill
    const price = l.price && u.role !== 'staff' ? l.price : it.price
    total += price * l.qty
    tax += Math.round((price * l.qty * it.gst_rate) / (100 + it.gst_rate))
    cost += it.cost * l.qty
    return { ...l, price, cost: it.cost, name: it.name, unit: it.unit, left: it.stock - l.qty }
  })

  let customer: any = null
  if (input.customerId) {
    customer = await one<any>('SELECT * FROM customers WHERE id=? AND org_id=?', [input.customerId, u.org_id])
    if (!customer) throw new OpError('Unknown customer.')
    if (input.mode === 'credit') {
      const owed = (await receivables({ orgId: u.org_id })).find((r) => r.customer_id === customer.id)?.outstanding ?? 0
      customer.balance = owed + total
      if (customer.balance > customer.credit_limit) {
        if (!isFamily(u)) throw new OpError(
          `${customer.name} already owes ₹${owed.toLocaleString('en-IN')} against a limit of ₹${customer.credit_limit.toLocaleString('en-IN')}. This bill needs the owner's approval.`)
        await audit(u, u.org_id, 'credit_override', `${customer.name}: bill of ₹${total} takes udhaar to ₹${customer.balance}, over the ₹${customer.credit_limit} limit`)
      }
    }
  }

  const day = today()
  if (u.role === 'ca') throw new OpError('The CA login is read-only.')
  await assertOpen(u.org_id, day)
  const id = await tx(async (t) => {
    const n = (await one<any>('SELECT COUNT(*) n FROM sales WHERE branch_id=?', [input.branchId], t))!.n + 1
    const invoice = `${branch.code}-${String(n).padStart(6, '0')}`
    const saleId = await run(
      `INSERT INTO sales (org_id, branch_id, customer_id, user_id, day, ts, invoice_no, total, tax, cost_total, mode, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.org_id, input.branchId, input.customerId ?? null, u.id, day, nowTs(), invoice, total, tax, cost, input.mode, input.source ?? 'pos'], t)
    for (const l of lines) {
      await run('INSERT INTO sale_items (sale_id, item_id, qty, price, cost) VALUES (?,?,?,?,?)', [saleId, l.itemId, l.qty, l.price, l.cost], t)
      await run('UPDATE stock SET qty = qty - ? WHERE item_id=? AND branch_id=?', [l.qty, l.itemId, input.branchId], t)
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
        [u.org_id, l.itemId, input.branchId, day, 'sale', -l.qty, invoice, u.id], t)
    }
    await postSale(t, saleId)
    return saleId
  })
  await audit(u, u.org_id, 'sale', `Bill #${id} at ${branch.name}: ₹${total} ${input.mode}${customer ? ' to ' + customer.name : ''} via ${input.source ?? 'pos'}`)
  return { id, total, lines, branch: branch.name, customer }
}

/** Reverse a bill: stock goes back through a movement row and the bill is removed. */
export async function undoSale(u: User, saleId: number) {
  const s = await one<any>('SELECT * FROM sales WHERE id=? AND org_id=?', [saleId, u.org_id])
  if (!s) throw new OpError('Bill not found.')
  if (!isFamily(u) && s.user_id !== u.id) throw new OpError('You can only undo your own bills.')
  if (await one('SELECT 1 FROM returns WHERE sale_id=?', [saleId])) throw new OpError('Goods were returned on this bill, so it can’t be cancelled. Take a return for the rest instead.')
  await tx(async (t) => {
    await unpost(t, 'sale_id', saleId) // refuses if the bill's day is in a signed-off period
    for (const l of await q<any>('SELECT * FROM sale_items WHERE sale_id=?', [saleId], t)) {
      await run('UPDATE stock SET qty = qty + ? WHERE item_id=? AND branch_id=?', [l.qty, l.item_id, s.branch_id], t)
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
        [u.org_id, l.item_id, s.branch_id, today(), 'adjust', l.qty, `Undo ${s.invoice_no}`, u.id], t)
    }
    await run('DELETE FROM sale_items WHERE sale_id=?', [saleId], t)
    await run('DELETE FROM sales WHERE id=?', [saleId], t)
  })
  await audit(u, u.org_id, 'undo_sale', `Bill ${s.invoice_no} (₹${s.total}) was undone`)
  return s
}

export async function recordPayment(u: User, customerId: number, amount: number, mode: 'cash' | 'upi', source = 'pos', accountId?: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new OpError('Enter an amount above zero.')
  if (u.role === 'ca') throw new OpError('The CA login is read-only.')
  const c = await one<any>('SELECT * FROM customers WHERE id=? AND org_id=?', [customerId, u.org_id])
  if (!c) throw new OpError('Unknown customer.')
  assertBranch(u, c.branch_id)
  await tx(async (t) => {
    const id = await run('INSERT INTO payments (org_id, customer_id, branch_id, day, amount, mode, user_id, source) VALUES (?,?,?,?,?,?,?,?)',
      [u.org_id, customerId, c.branch_id, today(), amount, mode, u.id, source], t)
    await postReceipt(t, id, accountId)
  })
  await audit(u, u.org_id, 'payment', `₹${amount} ${mode} received from ${c.name} via ${source}`)
  const balance = (await receivables({ orgId: u.org_id })).find((r) => r.customer_id === customerId)?.outstanding ?? 0
  return { customer: c, balance }
}

/** Positive qty adds stock (a purchase), negative removes it (damage, correction). */
export async function adjustStock(u: User, itemId: number, branchId: number, qty: number, type: 'purchase' | 'adjust', ref: string) {
  assertBranch(u, branchId)
  if (!Number.isInteger(qty) || qty === 0) throw new OpError('Enter a whole quantity.')
  if (u.role === 'ca' || (type === 'adjust' && u.role === 'staff')) throw new OpError('Stock corrections need a manager.')
  const it = await one<any>('SELECT name, unit FROM items WHERE id=? AND org_id=?', [itemId, u.org_id])
  if (!it) throw new OpError('Unknown item.')
  await tx(async (t) => {
    await run('INSERT INTO stock (item_id, branch_id, qty) VALUES (?,?,0) ON CONFLICT DO NOTHING', [itemId, branchId], t)
    const left = (await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=?', [itemId, branchId], t))!.qty + qty
    if (left < 0) throw new OpError('That would take stock below zero.')
    await run('UPDATE stock SET qty=? WHERE item_id=? AND branch_id=?', [left, itemId, branchId], t)
    await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
      [u.org_id, itemId, branchId, today(), type, qty, ref, u.id], t)
  })
  await audit(u, u.org_id, type, `${qty > 0 ? '+' : ''}${qty} ${it.unit} ${it.name} (${ref})`)
}

export async function transferStock(u: User, itemId: number, from: number, to: number, qty: number) {
  if (u.role === 'staff' || u.role === 'ca') throw new OpError('Transfers need a manager or the owner.')
  if (u.branch_id && u.branch_id !== from && u.branch_id !== to) throw new OpError(`You can only move stock in or out of ${u.branch}.`)
  if (!Number.isInteger(qty) || qty <= 0 || from === to) throw new OpError('Pick two branches and a quantity above zero.')
  const it = await one<any>('SELECT name, unit FROM items WHERE id=? AND org_id=?', [itemId, u.org_id])
  const bs = await q<any>('SELECT id, name FROM branches WHERE org_id=? AND id IN (?,?)', [u.org_id, from, to])
  if (!it || bs.length !== 2) throw new OpError('Unknown item or branch.')
  const name = (id: number) => bs.find((b) => b.id === id).name
  await tx(async (t) => {
    const have = (await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=?', [itemId, from], t))?.qty ?? 0
    if (have < qty) throw new OpError(`${name(from)} only has ${have} ${it.unit}.`)
    await run('UPDATE stock SET qty = qty - ? WHERE item_id=? AND branch_id=?', [qty, itemId, from], t)
    await run('INSERT INTO stock (item_id, branch_id, qty) VALUES (?,?,?) ON CONFLICT (item_id, branch_id) DO UPDATE SET qty = qty + excluded.qty', [itemId, to, qty], t)
    const ref = `Transfer ${name(from)} → ${name(to)}`
    for (const [b, n] of [[from, -qty], [to, qty]])
      await run('INSERT INTO stock_moves (org_id, item_id, branch_id, day, type, qty, ref, user_id) VALUES (?,?,?,?,?,?,?,?)',
        [u.org_id, itemId, b, today(), 'transfer', n, ref, u.id], t)
  })
  await audit(u, u.org_id, 'transfer', `${qty} ${it.unit} ${it.name}: ${name(from)} → ${name(to)}`)
  return { item: it.name, unit: it.unit, from: name(from), to: name(to), qty }
}

/** Payment reminder text with a UPI deep link the customer can tap to pay. */
export async function reminderFor(u: User, customerId: number, lang: 'en' | 'hi' = 'en') {
  const r = (await receivables({ orgId: u.org_id })).find((x) => x.customer_id === customerId)
  const org = await one<any>('SELECT name, upi_id FROM orgs WHERE id=?', [u.org_id])
  if (!r || !org) throw new OpError('Unknown customer.')
  const amt = r.outstanding.toLocaleString('en-IN')
  const upi = `upi://pay?pa=${org.upi_id}&pn=${encodeURIComponent(org.name)}&am=${r.outstanding}&cu=INR&tn=${encodeURIComponent('Account ' + r.name)}`
  const text = lang === 'hi'
    ? `Namaste ${r.name} ji,\n${org.name} mein aapka ₹${amt} baki hai (sabse purana bill ${r.oldest_days} din ka).\nIs link se UPI kar sakte hain:\n${upi}\nDhanyavaad 🙏`
    : `Hello ${r.name},\nA gentle reminder from ${org.name}: ₹${amt} is outstanding on your account (oldest bill ${r.oldest_days} days).\nYou can pay by UPI here:\n${upi}\nThank you 🙏`
  return { text, phone: r.phone, upi, amount: r.outstanding, name: r.name, wa: `https://wa.me/${r.phone}?text=${encodeURIComponent(text)}` }
}
