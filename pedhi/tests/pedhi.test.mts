// Run with: npm test
// The seed plants known stories, so every assertion here has a known right answer.
import assert from 'node:assert/strict'
import { test, before } from 'node:test'
import os from 'node:os'
import path from 'node:path'

process.env.DATABASE_URL = 'file:' + path.join(os.tmpdir(), `pedhi-test-${process.pid}.db`)
delete process.env.ANTHROPIC_API_KEY // tests cover the rule paths; they must not call a model

const { q, one, run } = await import('../lib/db')
const { seed } = await import('../lib/seed')
const { computeInsights } = await import('../lib/insights')
const { receivables, salesSummary, stockStatus, customerLedger } = await import('../lib/metrics')
const { parseMessage, loadCatalogue } = await import('../lib/match')
const { recordSale, undoSale, transferStock, recordPayment, OpError } = await import('../lib/ops')
const { userById } = await import('../lib/session')
const { answer } = await import('../lib/chat')
const { handleInbound } = await import('../lib/ingest')
const { today, addDays } = await import('../lib/format')

before(async () => { await seed() })
const itemId = async (name: string) => (await one<any>('SELECT id FROM items WHERE name LIKE ?', [name + '%']))!.id

test('stock always equals the sum of its movements', async () => {
  const bad = await q(`SELECT st.item_id, st.branch_id, st.qty, (SELECT SUM(qty) FROM stock_moves m WHERE m.item_id=st.item_id AND m.branch_id=st.branch_id) moved
                       FROM stock st WHERE st.qty != moved`)
  assert.deepEqual(bad, [])
})

test('insight engine finds every planted story', async () => {
  const ins = await computeInsights(1)
  const by = (key: string) => ins.find((i) => i.key === key)
  const acc = await itemId('ACC Cement')

  const mapusa = by('sales:2')
  assert.ok(mapusa, 'Mapusa sales drop')
  assert.equal(mapusa.severity, 'high')
  assert.deepEqual({ kind: mapusa.action?.kind, ...(mapusa.action as any) }.kind, 'transfer')
  assert.deepEqual([(mapusa.action as any).item_id, (mapusa.action as any).from, (mapusa.action as any).to], [acc, 3, 2])
  assert.ok(!by('sales:1') && !by('sales:3'), 'no false alarm at the healthy branches')

  const overdue = ins.filter((i) => i.type === 'overdue')
  assert.equal(overdue.reduce((s, i) => s + i.impact, 0), 93100 + 50450 + 32700)
  assert.match(by('overdue:2')!.detail_en, /Lobo Contractors.*over limit/)

  assert.equal(by(`dead:1:${await itemId('Asian Paints Apex')}`)!.impact, 61800)
  assert.match(by('cash:3')!.title_en, /short 3 times/)
  assert.match(by('cash:3')!.detail_en, /Tuesday, closed by Santosh Parab/)
  assert.ok(by(`quiet:${(await one<any>(`SELECT id FROM customers WHERE name LIKE 'Colaco%'`))!.id}`), 'quiet customer')
  assert.ok(ins.some((i) => i.type === 'margin_leak' && i.impact === 1500))
  assert.ok(ins.some((i) => i.severity === 'good'))
  assert.equal(ins[0].key, 'sales:2', 'the biggest problem is ranked first')
})

test('udhaar ageing applies payments to the oldest bills first', async () => {
  const r = await receivables({ orgId: 1 })
  const borkar = r.find((c) => c.name.startsWith('Borkar'))!
  assert.deepEqual([borkar.outstanding, borkar.oldest_days, borkar.b31_60], [93100, 49, 93100])
  assert.ok(r.filter((c) => c.oldest_days > 30).length === 3, 'only the three planted customers are overdue')
})

test('a bill moves stock, udhaar and revenue together, and undo reverses it', async () => {
  const meena = (await userById(6))!, T = today()
  const acc = await itemId('ACC Cement')
  const ramesh = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Ramesh%'`))!.id
  const stockOf = async () => (await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=1', [acc]))!.qty
  const owed = async () => (await receivables({ orgId: 1 })).find((c) => c.customer_id === ramesh)!.outstanding
  const [s0, o0, r0] = [await stockOf(), await owed(), (await salesSummary({ orgId: 1 }, T, T)).revenue]

  const sale = await recordSale(meena, { branchId: 1, customerId: ramesh, mode: 'credit', lines: [{ itemId: acc, qty: 10 }] })
  assert.equal(sale.total, 4100)
  assert.deepEqual([await stockOf(), await owed(), (await salesSummary({ orgId: 1 }, T, T)).revenue], [s0 - 10, o0 + 4100, r0 + 4100])

  await undoSale(meena, sale.id)
  assert.deepEqual([await stockOf(), await owed()], [s0, o0])
})

test('trust rules: branch walls, credit limits, stock limits', async () => {
  const raju = (await userById(4))!, suresh = (await userById(1))!
  const acc = await itemId('ACC Cement'), lobo = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Lobo%'`))!.id
  await assert.rejects(recordSale(raju, { branchId: 1, mode: 'cash', lines: [{ itemId: acc, qty: 1 }] }), OpError, 'staff cannot bill another branch')
  await assert.rejects(recordSale((await userById(7))!, { branchId: 2, customerId: lobo, mode: 'credit', lines: [{ itemId: await itemId('Teflon'), qty: 1 }] }), /owner's approval/)
  await assert.rejects(recordSale(suresh, { branchId: 2, mode: 'cash', lines: [{ itemId: acc, qty: 1 }] }), /Only 0 bag/, 'cannot sell what is not there')
  await assert.rejects(transferStock(raju, acc, 3, 2, 10), OpError, 'staff cannot transfer')
  // staff price overrides are ignored
  const s = await recordSale(raju, { branchId: 3, mode: 'cash', lines: [{ itemId: acc, qty: 1, price: 1 }] })
  assert.equal(s.total, 410)
  await undoSale(raju, s.id)
})

test('the transfer the brief suggests clears the stock-out', async () => {
  const ins = await computeInsights(1)
  const a = ins.find((i) => i.key === 'sales:2')!.action as any
  await transferStock((await userById(1))!, a.item_id, a.from, a.to, a.qty)
  const row = (await stockStatus({ orgId: 1, branchId: 2 })).find((r) => r.item_id === a.item_id)!
  assert.equal(row.qty, a.qty)
  await transferStock((await userById(1))!, a.item_id, a.to, a.from, a.qty) // put it back for the other tests
})

test('message parser reads Hinglish sales and payments', async () => {
  const cat = await loadCatalogue(1)
  const names = (p: any) => p.lines.map((l: any) => `${l.qty} ${l.name}`)
  let p = parseMessage('Ramesh ko 10 bori ACC cement diya udhaar pe', cat)
  assert.deepEqual([p.intent, names(p), p.mode], ['sale', ['10 ACC Cement 53 Grade 50kg'], 'credit'])
  assert.match(cat.customers.find((c) => c.id === p.customerId)!.name, /^Ramesh/)

  p = parseMessage('5 ultratech cement, 20 sariya 12mm and 2 kg nails cash', cat)
  assert.deepEqual(names(p), ['5 UltraTech Cement PPC 50kg', '20 Tata Tiscon TMT 12mm', '2 Nails 2 inch 1kg'])
  assert.equal(p.mode, 'cash')

  p = parseMessage('Kamat ne 15000 jama kiya upi se', cat)
  assert.deepEqual([p.intent, p.amount, p.mode], ['payment', 15000, 'upi'])

  p = parseMessage('led bulb 4 walk in customer gpay', cat)
  assert.deepEqual([names(p), p.mode, p.customerId], [['4 Philips LED Bulb 9W'], 'upi', null])

  assert.equal(parseMessage('aaj kitni sale hui?', cat).intent, 'other')
})

test('a WhatsApp message is shown back first, saved only on YES, and UNDO takes it back', async () => {
  const raju = (await userById(4))!
  const bills = async () => (await salesSummary({ orgId: 1, branchId: 3 }, today(), today())).bills
  const before = await bills()
  const r = await handleInbound(raju, 'Dhavalikar ko 10 bori ACC cement diya udhaar pe')
  assert.equal(r.kind, 'confirm')
  assert.match(r.reply, /Total ₹4,100/)
  assert.equal(await bills(), before, 'nothing is written before YES')
  assert.equal((await handleInbound(raju, 'no')).kind, 'cancel')
  assert.equal(await bills(), before)

  await handleInbound(raju, 'Dhavalikar ko 10 bori ACC cement diya udhaar pe')
  const ok = await handleInbound(raju, 'haan')
  assert.equal(ok.kind, 'sale')
  assert.equal(await bills(), before + 1)
  assert.equal((await handleInbound(raju, 'undo')).kind, 'undo')
  assert.equal(await bills(), before)

  assert.equal((await handleInbound(raju, 'Sawant ne 5000 cash diye')).kind, 'confirm')
  const pay = await handleInbound(raju, 'yes')
  assert.equal(pay.kind, 'payment')
  assert.match(pay.reply, /27,700/)
})

test('new goods on WhatsApp: Pedhi asks before adding the item, then books the stock with its expiry', async () => {
  const rohan = (await userById(3))!, raju = (await userById(4))!
  const ask = await handleInbound(rohan, '20 bag Dalmia cement aaya from Goa Cement Agencies exp 15/02/2027')
  assert.equal(ask.kind, 'confirm')
  assert.match(ask.reply, /Dalmia Cement\* is new/)
  assert.match(ask.reply, /GST 28%/, 'copies tax and unit from a similar cement')
  assert.equal(await one('SELECT id FROM items WHERE name=?', ['Dalmia Cement']), undefined, 'nothing added before YES')

  const added = await handleInbound(rohan, 'YES 395 355')
  assert.match(added.reply, /Added \*Dalmia Cement\*/)
  assert.match(added.reply, /Stock in at Mapusa from Goa Cement Agencies/)
  assert.match(added.reply, /Bill ₹7,100/)
  const it = (await one<any>('SELECT * FROM items WHERE name=?', ['Dalmia Cement']))!
  assert.deepEqual([it.gst_rate, it.unit, it.category, it.price, it.cost], [28, 'bag', 'Cement', 395, 355])

  const saved = await handleInbound(rohan, 'yes')
  assert.equal(saved.kind, 'stock_in')
  assert.equal((await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=2', [it.id]))!.qty, 20)
  assert.equal((await one<any>('SELECT pi.expiry FROM purchase_items pi WHERE pi.item_id=?', [it.id]))!.expiry, '2027-02-15')
  const v = (await one<any>(`SELECT SUM(vl.amount) s, COUNT(*) n FROM vouchers v JOIN voucher_lines vl ON vl.voucher_id=v.id WHERE v.purchase_id=(SELECT purchase_id FROM purchase_items WHERE item_id=?)`, [it.id]))!
  assert.deepEqual([v.s, v.n > 1], [0, true], 'the purchase is a balanced voucher, not a bare stock change')

  const staff = await handleInbound(raju, 'Dhavalikar ko 2 bag Ramco cement udhaar')
  assert.match(staff.reply, /Ramco Cement\* stock list mein nahi hai/)
})

test('stock plan: expiring lots, reorder by supplier, and items sorted into what sells and what earns', async () => {
  const { expiring, reorderList, itemPerformance, orderMessage } = await import('../lib/stockplan')
  const { parseExpiry } = await import('../lib/match')
  assert.equal(parseExpiry('exp 03/2027'), '2027-03-31')
  assert.equal(parseExpiry('expiry 15-01-27'), '2027-01-15')
  assert.equal(parseExpiry('exp 31/02/2027'), null)

  const soon = await expiring({ orgId: 1 }, 30)
  assert.ok(soon.some((b) => b.name.startsWith('Birla White') && b.branch === 'Ponda' && b.days_left === 6))
  const ins = await computeInsights(1)
  assert.ok(ins.some((i) => i.type === 'expiry' && i.severity === 'high' && /Birla White/.test(i.title_en)))
  const { getBrief } = await import('../lib/brief')
  assert.match((await getBrief((await userById(2))!, { orgId: 1 }, 'en', true)).body, /\*Expiring soon:\* 13 bag Birla White/, 'the family hears about it every morning')

  const orders = await reorderList({ orgId: 1 })
  assert.ok(orders.length && orders.every((g) => g.lines.every((l) => l.order > 0)))
  assert.match(orderMessage(orders[0], 'Naik Traders'), /please send:[\s\S]*Naik Traders$/)

  const perf = await itemPerformance({ orgId: 1 })
  const sold = perf.filter((p) => p.revenue > 0)
  const lines = (await one<any>('SELECT SUM(si.qty*si.price) v FROM sale_items si JOIN sales x ON x.id=si.sale_id WHERE x.org_id=1 AND x.day >= ?', [addDays(today(), -29)]))!.v
  assert.equal(sold.reduce((s, p) => s + p.revenue, 0), lines, 'every rupee of the last 30 days lands on exactly one item')
  assert.ok(perf.some((p) => p.tag === 'star') && perf.some((p) => p.tag === 'dead'))

  const suresh = (await userById(1))!, raju = (await userById(4))!
  assert.match((await answer(suresh, { orgId: 1 }, 'Kya expire hone wala hai?')).text, /Birla White/)
  assert.match((await answer(suresh, { orgId: 1 }, 'What should I order?')).text, /^Order now/)
  const staff = await answer(raju, { orgId: 1, branchId: 3 }, 'Which items have rising demand?')
  assert.doesNotMatch(JSON.stringify(staff.evidence), /"profit"|"margin_pct"/, 'staff never see profit per item')
})

test('ask: answers match the metrics layer, and staff never see margin', async () => {
  const suresh = (await userById(1))!, raju = (await userById(4))!
  const T = today()
  const a = await answer(suresh, { orgId: 1 }, 'Aaj kitni sale hui?')
  assert.ok(a.text.includes((await salesSummary({ orgId: 1 }, T, T)).revenue.toLocaleString('en-IN')))

  const m = await answer(suresh, { orgId: 1 }, 'Which branch has the lowest margin this week?')
  assert.match(m.text, /Lowest margin/)
  assert.ok(m.evidence[0].result[0].margin_pct !== undefined)

  const s = await answer(raju, { orgId: 1, branchId: 3 }, 'What is our profit this week?')
  assert.match(s.text, /owners/)
  const b = await answer(raju, { orgId: 1, branchId: 3 }, 'compare branches this week')
  assert.equal(b.evidence[0].result.length, 1, 'a branch user only ever gets their own branch')
  assert.equal(b.evidence[0].result[0].margin, undefined)

  const u = await answer(suresh, { orgId: 1 }, 'Lobo ka kitna udhaar baki hai?')
  assert.match(u.text, /50,450/)
  assert.ok(addDays(T, 0) === T)
})

// ---- Books -----------------------------------------------------------------------------------
const B = await import('../lib/books')
const R = await import('../lib/reports')

test('books: every voucher balances, trial balance and balance sheet tie out', async () => {
  const bad = await q(`SELECT voucher_id, SUM(amount) s FROM voucher_lines GROUP BY voucher_id HAVING s != 0`)
  assert.deepEqual(bad, [])
  const tb = await R.trialBalance(1, today())
  assert.equal(tb.debit, tb.credit)
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  assert.ok(bs.profit > 0)
  // every bill has exactly one sales voucher for the same amount
  const missing = await q(`SELECT s.id FROM sales s LEFT JOIN vouchers v ON v.sale_id=s.id LEFT JOIN voucher_lines vl ON vl.voucher_id=v.id AND vl.amount > 0
                           GROUP BY s.id HAVING COUNT(DISTINCT v.id) != 1 OR SUM(vl.amount) != s.total`)
  assert.deepEqual(missing, [])
})

test('books: a udhaar bill debits the customer and splits GST; a payment clears it', async () => {
  const meena = (await userById(6))!
  const acc = await itemId('ACC Cement')
  const ramesh = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Ramesh%'`))!.id
  const s = await recordSale(meena, { branchId: 1, customerId: ramesh, mode: 'credit', lines: [{ itemId: acc, qty: 10 }] })
  const lines = await q<any>(`SELECT l.name, vl.amount FROM vouchers v JOIN voucher_lines vl ON vl.voucher_id=v.id JOIN ledgers l ON l.id=vl.ledger_id WHERE v.sale_id=? ORDER BY vl.amount DESC, l.name`, [s.id])
  // ₹4,100 at 28% GST: taxable 3,203, tax 897 → CGST 448 + SGST 449
  assert.deepEqual(lines.map((l) => [l.name, l.amount]), [['Ramesh Gaonkar Contractor', 4100], ['Output CGST', -448], ['Output SGST', -449], ['Sales @28%', -3203]])
  await undoSale(meena, s.id)
  assert.equal((await q('SELECT 1 FROM vouchers WHERE sale_id=?', [s.id])).length, 0)
})

test('books: inter-state customer pays IGST', async () => {
  const vishal = (await userById(7))!
  const gauns = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Gauns%'`))!.id
  const s = await recordSale(vishal, { branchId: 2, customerId: gauns, mode: 'cash', lines: [{ itemId: await itemId('Teflon'), qty: 10 }] })
  const names = (await q<any>(`SELECT l.name FROM vouchers v JOIN voucher_lines vl ON vl.voucher_id=v.id JOIN ledgers l ON l.id=vl.ledger_id WHERE v.sale_id=?`, [s.id])).map((r) => r.name)
  assert.ok(names.includes('Output IGST') && !names.includes('Output CGST'))
  await undoSale(vishal, s.id)
})

test('books: purchase, supplier payment, expense, contra and owner money post the right vouchers', async () => {
  const suresh = (await userById(1))!
  const L = await B.ledgerMap(1)
  const hdfc = L.get('HDFC Bank - Current'), cash = L.cash(1)
  const sup = (await one<any>(`SELECT id FROM suppliers WHERE name LIKE 'Goa Cement%'`))!.id
  const acc = await itemId('ACC Cement')
  const before = (await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=1', [acc]))!.qty
  const bal = async (id: number) => (await R.ledgerBalances(1, '2000-01-01', today())).find((b) => b.id === id)!.closing

  const cred0 = await bal(L.supplier(sup))
  await B.recordPurchase(suresh, { branchId: 1, supplierId: sup, billNo: 'T-1', mode: 'credit', lines: [{ itemId: acc, qty: 100, rate: 372 }] })
  assert.equal((await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=1', [acc]))!.qty, before + 100)
  assert.equal(await bal(L.supplier(sup)), cred0 - 37200, 'we owe the supplier the bill amount')

  const h0 = await bal(hdfc)
  await B.paySupplier(suresh, sup, 37200, hdfc)
  assert.equal(await bal(L.supplier(sup)), cred0)
  await B.recordExpense(suresh, { ledgerId: L.get('Telephone & Internet'), amount: 1180, accountId: hdfc, gstRate: 18 })
  const last = await q<any>(`SELECT l.name, vl.amount FROM voucher_lines vl JOIN ledgers l ON l.id=vl.ledger_id WHERE vl.voucher_id=(SELECT MAX(id) FROM vouchers) ORDER BY vl.amount DESC, l.name`)
  assert.deepEqual(last.map((l) => [l.name, l.amount]), [['Telephone & Internet', 1000], ['Input CGST', 90], ['Input SGST', 90], ['HDFC Bank - Current', -1180]])
  const c0 = await bal(cash)
  await B.moveMoney(suresh, cash, hdfc, 10000)
  await B.ownerMoney(suresh, 'take', 5000, hdfc)
  assert.equal(await bal(cash), c0 - 10000)
  assert.equal(await bal(hdfc), h0 - 37200 - 1180 + 10000 - 5000)
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities, 'still balanced after new entries')
})

test('books: CA sign-off locks the period; CA cannot enter transactions', async () => {
  const ca = (await userById(8))!, suresh = (await userById(1))!
  const L = await B.ledgerMap(1)
  await assert.rejects(B.moveMoney(ca, L.cash(1), L.get('HDFC Bank - Current'), 100), /CA login/)
  await B.signOff(ca, addDays(today(), -1), 'Reviewed')
  const old = (await one<any>(`SELECT id FROM sales WHERE day=? LIMIT 1`, [addDays(today(), -2)]))!.id
  await assert.rejects(undoSale(suresh, old), /locked/)
  await B.reopen(ca)
})

test('GST summary matches the books', async () => {
  const g = await R.gstSummary(1, today().slice(0, 7))
  assert.equal(g.totals.taxable, g.r3b.out.taxable)
  assert.equal(g.totals.cgst + g.totals.sgst + g.totals.igst, g.r3b.out.cgst + g.r3b.out.sgst + g.r3b.out.igst)
  assert.ok(g.b2b.length > 0 && g.hsn.length > 0)
})

test('Tell Pedhi turns plain sentences into the right Books action', async () => {
  const { parseBookSentence } = await import('../lib/bookParse')
  const L = await B.ledgerMap(1)
  const hdfc = L.get('HDFC Bank - Current')
  const e = await parseBookSentence(1, 'HDFC se 4,500 bijli ka bill bhara') as any
  assert.deepEqual([e.action, e.amount, e.accountId, e.ledgerId], ['expense', 4500, hdfc, L.get('Electricity')])
  const m = await parseBookSentence(1, '50000 cash HDFC mein jama kiya') as any
  assert.deepEqual([m.action, m.amount, m.toId], ['move', 50000, hdfc])
  assert.ok(L.rows.find((r) => r.id === m.fromId)!.grp === 'Cash-in-Hand')
  const p = await parseBookSentence(1, 'Goa Cement se 200 bag ACC cement liya udhaar') as any
  assert.deepEqual([p.action, p.mode, p.lines[0].qty, p.lines[0].rate], ['purchase', 'credit', 200, 372])
  const s = await parseBookSentence(1, 'Paid Konkan Steel 1,20,000 from HDFC') as any
  assert.deepEqual([s.action, s.amount, s.accountId], ['supplier', 120000, hdfc])
  assert.equal((await parseBookSentence(1, 'Ghar ke liye 10000 cash liye') as any).action, 'owner')
  assert.equal((await parseBookSentence(1, 'hello there') as any).action, 'unknown')
})

test('help guide retrieves the right article in English and Hinglish', async () => {
  const { retrieve, helpAnswer } = await import('../lib/help')
  const top = (q: string) => retrieve(q)[0]?.doc.id
  assert.equal(top('How do I record rent?'), 'expense')
  assert.equal(top('Cash bank mein jama kaise karu?'), 'contra')
  assert.equal(top('How do I send books to my CA?'), 'ca')
  assert.equal(top('GST return kab bharna hai?'), 'gst')
  assert.equal(top('can staff see profit'), 'roles')
  assert.equal(retrieve('weather in goa').length, 0)
  const a = await helpAnswer('Cash bank mein jama kaise karu?', '/books')
  assert.match(a.text, /Moved money/)
  assert.equal(a.sources[0].href, '/books/new?a=move')
})

test('customers: staff add cash-only customers, GSTIN sets the state, duplicates refused', async () => {
  const raju = (await userById(4))!, suresh = (await userById(1))!
  const c = await B.addCustomer(raju, { name: 'Pai Constructions', phone: '98220 12345', creditLimit: 90000 })
  assert.deepEqual([c.branch_id, c.credit_limit], [3, 0], 'staff: own branch, no udhaar until the family allows it')
  assert.ok((await B.ledgerMap(1)).rows.some((l) => l.customer_id === c.id && l.grp === 'Sundry Debtors'))
  await assert.rejects(B.addCustomer(suresh, { name: 'pai constructions', branchId: 1 }), /already exists/)
  await assert.rejects(B.addCustomer(suresh, { name: 'X Traders', branchId: 1, gstin: '30ABC' }), /GSTIN/)
  const k = await B.addCustomer(suresh, { name: 'Belgaum Hardware', branchId: 1, creditLimit: 40000, gstin: '29AAKFB1234C1Z5' })
  assert.equal((await one<any>('SELECT state FROM customers WHERE id=?', [k.id]))!.state, 'Karnataka')
  // a new udhaar customer can be billed straight away and gets IGST
  const s = await recordSale(suresh, { branchId: 1, customerId: k.id, mode: 'credit', lines: [{ itemId: await itemId('Teflon'), qty: 5 }] })
  const names = (await q<any>(`SELECT l.name FROM vouchers v JOIN voucher_lines vl ON vl.voucher_id=v.id JOIN ledgers l ON l.id=vl.ledger_id WHERE v.sale_id=?`, [s.id])).map((r) => r.name)
  assert.ok(names.includes('Output IGST') && names.includes('Belgaum Hardware'))
  await assert.rejects(B.setCreditTerms(raju, c.id, 5000, 15), /family or a manager/)
  await B.setCreditTerms(suresh, c.id, 5000, 15)
  await undoSale(suresh, s.id)
})

test('items: new items start at zero stock and are billable after a purchase', async () => {
  const suresh = (await userById(1))!, raju = (await userById(4))!
  await assert.rejects(B.addItem(raju, { name: 'Test Item', gstRate: 18, cost: 10, price: 12 }), /family or a manager/)
  await assert.rejects(B.addItem(suresh, { name: 'Bad Rate', gstRate: 15, cost: 10, price: 12 }), /GST rate/)
  await assert.rejects(B.addItem(suresh, { name: 'Upside Down', gstRate: 18, cost: 20, price: 12 }), /higher than the selling/)
  const it = await B.addItem(suresh, { name: 'Asian Paints Apex 10L White', category: 'Paint', unit: 'bucket', hsn: '3209', gstRate: 18, cost: 2700, price: 3150, aliases: 'safed apex' })
  const stock = await q<any>('SELECT qty FROM stock WHERE item_id=?', [it.id])
  assert.deepEqual(stock.map((r) => r.qty), [0, 0, 0])
  await assert.rejects(recordSale(suresh, { branchId: 1, mode: 'cash', lines: [{ itemId: it.id, qty: 1 }] }), /Only 0/)
  const sup = (await one<any>(`SELECT id FROM suppliers WHERE name LIKE 'Asian Paints%'`))!.id
  await B.recordPurchase(suresh, { branchId: 1, supplierId: sup, mode: 'credit', lines: [{ itemId: it.id, qty: 4, rate: 2700 }] })
  const s = await recordSale(suresh, { branchId: 1, mode: 'cash', lines: [{ itemId: it.id, qty: 1 }] })
  assert.equal(s.total, 3150)
  assert.equal(parseMessage('2 safed apex cash', await loadCatalogue(1)).lines[0].itemId, it.id, 'staff can bill it by its other name')
})

test('day close: a shortage is booked, flagged, and the books still balance', async () => {
  const santosh = (await userById(5))!
  const exp = (await B.expectedCash(1, 3))!.expected
  await assert.rejects(B.closeDay(santosh, 1, exp), /only close Ponda/)
  const r = await B.closeDay(santosh, 3, exp - 2500, 'counted twice')
  assert.deepEqual([r.expected, r.diff], [exp, -2500])
  assert.equal((await B.expectedCash(1, 3))!.expected, exp - 2500, 'the cash box in the books now matches the drawer')
  await assert.rejects(B.closeDay(santosh, 3, 100), /already closed/)
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  const cash = (await computeInsights(1)).find((i) => i.key === 'cash:3')!
  assert.match(cash.title_en, /short 4 times/)
})

test('help guide covers the new screens', async () => {
  const { retrieve } = await import('../lib/help')
  const top = (q: string) => retrieve(q)[0]?.doc.id
  assert.equal(top('How do I add a new customer?'), 'newcustomer')
  assert.equal(top('naya item kaise add kare'), 'newitem')
  assert.equal(top('Cash kam nikla toh kya karu?'), 'closing')
})

test('udhaar from the books: old balance, money given, charge, discount and write-off', async () => {
  const suresh = (await userById(1))!, meena = (await userById(6))!
  const ramesh = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Ramesh%'`))!.id
  const owed = async () => (await receivables({ orgId: 1 })).find((c) => c.customer_id === ramesh)!
  const before = (await owed()).outstanding
  await B.setOpeningBalance(suresh, { customerId: ramesh }, 12000, addDays(today(), -70))
  assert.equal((await owed()).outstanding, before + 12000)
  // a customer who only has old dues: they age from the date they were owed
  const fresh = await B.addCustomer(suresh, { name: 'Purana Khata Traders', branchId: 1, creditLimit: 20000 })
  await B.setOpeningBalance(suresh, { customerId: fresh.id }, 9000, addDays(today(), -70))
  const f = (await receivables({ orgId: 1 })).find((c) => c.customer_id === fresh.id)!
  assert.deepEqual([f.outstanding, f.overdue, f.oldest_days], [9000, 9000, 70])
  let bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities, 'capital takes the other side of old balances')
  const hdfc = (await B.ledgerMap(1)).get('HDFC Bank - Current')
  await B.udhaarEntry(meena, ramesh, 'gave_money', 3000, hdfc, 'advance for labour')
  await B.udhaarEntry(meena, ramesh, 'charge', 800, undefined, 'tempo to site')
  await assert.rejects(B.udhaarEntry(meena, ramesh, 'discount', 500), /family or a manager/)
  await B.udhaarEntry(suresh, ramesh, 'discount', 500, undefined, 'round off')
  assert.equal((await owed()).outstanding, before + 12000 + 3000 + 800 - 500)
  const kh = await customerLedger(1, ramesh)
  assert.deepEqual([kh[0].type, kh[0].amount], ['Opening', 12000], 'the khata starts with the old balance')
  assert.equal(kh.at(-1)!.balance, before + 12000 + 3000 + 800 - 500)
  const sup = (await one<any>(`SELECT id FROM suppliers WHERE name LIKE 'Konkan%'`))!.id
  await B.setOpeningBalance(suresh, { supplierId: sup }, 25000)
  bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  await B.setOpeningBalance(suresh, { customerId: ramesh }, 0)
  await B.setOpeningBalance(suresh, { supplierId: sup }, 0)
})

test('statement link: private token, only that customer', async () => {
  const suresh = (await userById(1))!
  const id = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Kamat%'`))!.id
  const t1 = await B.shareToken(suresh, id)
  assert.match(t1, /^[a-f0-9]{40}$/)
  assert.equal(await B.shareToken(suresh, id), t1, 'same link until renewed')
  const t2 = await B.shareToken(suresh, id, true)
  assert.notEqual(t1, t2)
  assert.equal((await one<any>('SELECT id FROM customers WHERE share_token=?', [t1])), undefined, 'the old link stops working')
})

test('returns: credit note puts stock back, cuts udhaar and GST; debit note sends stock out', async () => {
  const suresh = (await userById(1))!, meena = (await userById(6))!
  const acc = await itemId('ACC Cement'), dsouza = (await one<any>(`SELECT id FROM customers WHERE name LIKE 'D''Souza%'`))!.id
  const stockOf = async () => (await one<any>('SELECT qty FROM stock WHERE item_id=? AND branch_id=1', [acc]))!.qty
  const owed = async () => (await receivables({ orgId: 1 })).find((c) => c.customer_id === dsouza)!.outstanding
  const g0 = await R.gstSummary(1, today().slice(0, 7))
  const s = await recordSale(meena, { branchId: 1, customerId: dsouza, mode: 'credit', lines: [{ itemId: acc, qty: 10 }] })
  const [st, ow] = [await stockOf(), await owed()]
  await assert.rejects(B.returnSale(meena, s.id, [{ itemId: acc, qty: 11 }], 'account'), /Only 10/)
  await B.returnSale(meena, s.id, [{ itemId: acc, qty: 4 }], 'account', 'damaged')
  assert.deepEqual([await stockOf(), await owed()], [st + 4, ow - 1640])
  await assert.rejects(undoSale(meena, s.id), /returned on this bill/)
  const g = await R.gstSummary(1, today().slice(0, 7))
  assert.equal(g.totals.taxable, g.r3b.out.taxable, 'GSTR-1 still matches the books after a return')
  assert.equal(g.totals.taxable - g0.totals.taxable, 3203 - 1281, '6 bags net of GST stay sold')
  assert.equal(g.cdnr.length, g0.cdnr.length + 1, 'registered customer: shows as a credit note')
  const sup = (await one<any>(`SELECT id FROM suppliers WHERE name LIKE 'Goa Cement%'`))!.id
  const before = await stockOf()
  await B.returnPurchase(suresh, { branchId: 1, supplierId: sup, lines: [{ itemId: acc, qty: 5, rate: 372 }], note: 'torn bags' })
  assert.equal(await stockOf(), before - 5)
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  const tb = await R.trialBalance(1, today())
  assert.equal(tb.debit, tb.credit)
})

test('advanced entries: new ledgers, balanced journals, cash/bank filed as Payment or Receipt', async () => {
  const suresh = (await userById(1))!, raju = (await userById(4))!, ca = (await userById(8))!
  await assert.rejects(B.createLedger(raju, 'Car loan - HDFC', 'Loans (Liability)'), /family or your CA/)
  const loan = await B.createLedger(suresh, 'Business loan - SBI', 'Loans (Liability)')
  const L = await B.ledgerMap(1)
  const hdfc = L.get('HDFC Bank - Current')
  await assert.rejects(B.postJournal(suresh, { day: today(), narration: 'x', lines: [{ ledgerId: hdfc, dr: 100, cr: 0 }, { ledgerId: loan.id, dr: 0, cr: 90 }] }), /must be equal/)
  const v1 = await B.postJournal(suresh, { day: today(), narration: 'Loan received', lines: [{ ledgerId: hdfc, dr: 500000, cr: 0 }, { ledgerId: loan.id, dr: 0, cr: 500000 }] })
  assert.match(v1.number, /^RCT-/, 'money into the bank is a Receipt')
  const v2 = await B.postJournal(ca, { day: today(), narration: 'Depreciation on computer', lines: [{ ledgerId: L.get('Depreciation'), dr: 4000, cr: 0 }, { ledgerId: L.get('Computers & Equipment'), dr: 0, cr: 4000 }] })
  assert.match(v2.number, /^JRN-/, 'the CA can post adjustments')
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  assert.ok(bs.liabilities.some((g) => g.grp === 'Loans (Liability)' && g.total === 500000))
})

test('branch P&L adds up to the whole business (plus common costs)', async () => {
  const from = await R.booksFrom(1), to = today()
  const all = await R.profitLoss(1, from, to)
  const parts = await Promise.all([1, 2, 3].map((b) => R.profitLoss(1, from, to, b)))
  assert.equal(parts.reduce((s, p) => s + p.totals.sales, 0), all.totals.sales)
  // every branch voucher is in exactly one branch; head-office vouchers (no branch) are the common costs
  // stock is valued per branch, so per-branch rounding can differ from the whole by a few rupees
  assert.ok(Math.abs(parts.reduce((s, p) => s + p.gross, 0) - all.gross) <= 46)
  assert.ok(Math.abs(parts.reduce((s, p) => s + p.net, 0) - parts[0].common + all.totals.incomes - parts.reduce((s, p) => s + p.totals.incomes, 0) - all.net) <= 46)
})

test('bank reconciliation: unmatched entries explain the gap', async () => {
  const hdfc = (await B.ledgerMap(1)).get('HDFC Bank - Current')
  const r = (await R.bankReco(1, hdfc, today()))!
  assert.ok(r.open.length > 0, 'recent entries are not in the bank yet')
  assert.equal(r.bank, r.books - r.pendingIn + r.pendingOut)
  await run('UPDATE voucher_lines SET bank_date=? WHERE id IN (' + r.open.map((x) => x.id).join(',') + ')', [today()])
  const after = (await R.bankReco(1, hdfc, today()))!
  assert.deepEqual([after.open.length, after.bank], [0, after.books])
})

test('customer import brings old udhaar from a khata export', async () => {
  const suresh = (await userById(1))!
  const I = await import('../lib/importer')
  const text = 'Customer Name,Mobile Number,Net Balance (₹),GST No,Credit Days\nImport Test Builders,9822012399,"18,500",,30\nRamesh Gaonkar Contractor,,2000,,\nBad Phone Co,12345,100,,'
  const rows = I.parseTable(text)
  const m = I.guessCustomerMapping(rows[0])
  assert.deepEqual([m.name, m.phone, m.balance, m.gstin, m.days], [0, 1, 2, 3, 4])
  const p = await I.previewCustomers(1, rows, m)
  assert.deepEqual(p.map((r) => [r.name, r.balance, r.match !== null, r.problem]), [
    ['Import Test Builders', 18500, false, null], ['Ramesh Gaonkar Contractor', 2000, true, null], ['Bad Phone Co', 100, false, 'Mobile number looks wrong']])
  const res = await I.commitCustomers(suresh, 2, p)
  assert.deepEqual(res, { created: 1, updated: 1, skipped: 1 })
  const c = (await receivables({ orgId: 1 })).find((x) => x.name === 'Import Test Builders')!
  assert.deepEqual([c.outstanding, c.branch_id], [18500, 2])
  const bs = await R.balanceSheet(1, today())
  assert.equal(bs.totalAssets, bs.totalLiabilities)
  await B.setOpeningBalance(suresh, { customerId: (await one<any>(`SELECT id FROM customers WHERE name LIKE 'Ramesh%'`))!.id }, 0)
})

test('automatic reminders go to overdue customers once per cycle', async () => {
  const suresh = (await userById(1))!
  const Rm = await import('../lib/reminders')
  await Rm.saveReminderSettings(suresh, true, 0, 7)
  const first = await Rm.runReminders(1, suresh)
  assert.ok(first.some((r) => r.name.startsWith('Borkar')) && first.every((r) => r.text.includes('upi://pay')))
  assert.equal((await Rm.runReminders(1, suresh)).length, 0, 'not again until the cycle comes round')
  await Rm.saveReminderSettings(suresh, false, 0, 7)
})

test('help guide covers khata and Tally features', async () => {
  const { retrieve } = await import('../lib/help')
  const top = (q: string) => retrieve(q)[0]?.doc.id
  assert.equal(top('Purana udhaar kaise daalu?'), 'oldbalance')
  assert.equal(top('How do I send a customer their khata?'), 'statement')
  assert.equal(top('customer returned goods'), 'returns')
  assert.equal(top('How do I record a loan?'), 'advanced')
  assert.equal(top('Bank reconciliation kaise kare?'), 'bankreco')
  assert.equal(top('backup kaise le'), 'backup')
  assert.equal(top('kaunsa maal expire hone wala hai'), 'expiry')
  assert.equal(top('what should I order from the supplier'), 'stockplan')
  assert.equal(top('naya maal aaya whatsapp pe kaise daale'), 'stockin')
})
