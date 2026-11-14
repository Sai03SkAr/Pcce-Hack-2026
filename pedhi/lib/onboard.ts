// A new business sets itself up: what kind it is, who owns it, its branches, and a starter item list.
import { one, q, run, tx } from './db'
import { nowTs, today } from './format'
import { hashPassword } from './auth'
import { checkGstin, ensureChart, RATES, STATE_CODES } from './books'
import { OpError } from './errors'

// [name, other names, category, unit, HSN, GST %, buying price, selling price]
type Starter = [string, string, string, string, string, number, number, number]

// Starter lists are a head start, not a price list: prices and GST rates are editable and a CA should confirm the rates.
export const BUSINESS_TYPES: { id: string; label: string; hint: string; expiry: boolean; items: Starter[] }[] = [
  { id: 'hardware', label: 'Hardware and building materials', hint: 'Cement, steel, paint, pipes, electricals', expiry: false, items: [
    ['UltraTech Cement 50kg', 'ultratech,cement,bori', 'Cement', 'bag', '2523', 18, 370, 410],
    ['TMT Bar 12mm', 'tmt,sariya,rod', 'Steel', 'rod', '7214', 18, 720, 790],
    ['Tractor Emulsion 20L', 'emulsion,paint', 'Paint', 'bucket', '3209', 18, 2450, 2890],
    ['Wall Putty 40kg', 'putty', 'Paint', 'bag', '3214', 18, 640, 740],
    ['PVC Pipe 1 inch 3m', 'pvc pipe,pipe', 'Plumbing', 'pc', '3917', 18, 210, 260],
    ['House Wire 1.5 sqmm 90m', 'wire', 'Electrical', 'coil', '8544', 18, 1650, 1950],
    ['LED Bulb 9W', 'led bulb,bulb', 'Electrical', 'pc', '8539', 18, 60, 95],
    ['Nails 2 inch 1kg', 'nails,khila', 'Hardware', 'kg', '7317', 18, 85, 120],
  ] },
  { id: 'kirana', label: 'Kirana and general store', hint: 'Atta, rice, dal, oil, soap, biscuits', expiry: true, items: [
    ['Atta 10kg', 'atta,aata', 'Staples', 'bag', '1101', 5, 420, 465],
    ['Sona Masoori Rice 25kg', 'rice,chawal', 'Staples', 'bag', '1006', 5, 1350, 1500],
    ['Toor Dal 1kg', 'toor dal,dal', 'Staples', 'kg', '0713', 5, 140, 165],
    ['Sugar 1kg', 'sugar,cheeni', 'Staples', 'kg', '1701', 5, 40, 46],
    ['Salt 1kg', 'salt,namak', 'Staples', 'pc', '2501', 0, 24, 28],
    ['Sunflower Oil 1L', 'oil,tel', 'Oil', 'pc', '1512', 5, 135, 155],
    ['Glucose Biscuit 250g', 'biscuit', 'Snacks', 'pc', '1905', 5, 22, 25],
    ['Detergent Powder 1kg', 'surf,detergent', 'Home care', 'pc', '3402', 18, 115, 135],
  ] },
  { id: 'pharmacy', label: 'Pharmacy and medical store', hint: 'Tablets, syrups, OTC, surgical', expiry: true, items: [
    ['Paracetamol 500mg (10 tabs)', 'paracetamol,crocin,dolo', 'Tablets', 'strip', '3004', 5, 12, 18],
    ['Cetirizine 10mg (10 tabs)', 'cetirizine', 'Tablets', 'strip', '3004', 5, 15, 22],
    ['Vitamin C 500mg (15 tabs)', 'vitamin c', 'Tablets', 'strip', '3004', 5, 20, 28],
    ['Cough Syrup 100ml', 'cough syrup,syrup', 'Syrups', 'bottle', '3004', 5, 85, 110],
    ['ORS Sachet', 'ors', 'OTC', 'pc', '3004', 5, 18, 22],
    ['Crepe Bandage 10cm', 'bandage,patti', 'Surgical', 'pc', '3005', 5, 60, 85],
    ['Antiseptic Liquid 500ml', 'antiseptic,dettol', 'OTC', 'bottle', '3808', 18, 190, 230],
    ['Hand Sanitizer 500ml', 'sanitizer', 'OTC', 'bottle', '3808', 18, 120, 160],
  ] },
  { id: 'clothing', label: 'Clothing and textiles', hint: 'Shirts, sarees, kurtis, kids, home linen', expiry: false, items: [
    ['Cotton Shirt (men)', 'shirt', 'Men', 'pc', '6205', 5, 450, 799],
    ['Jeans (men)', 'jeans', 'Men', 'pc', '6203', 5, 700, 1199],
    ['Kurti (women)', 'kurti', 'Women', 'pc', '6204', 5, 380, 699],
    ['Cotton Saree', 'saree,sari', 'Women', 'pc', '5208', 5, 600, 999],
    ['Kids T-shirt', 'kids tshirt,tshirt', 'Kids', 'pc', '6109', 5, 150, 299],
    ['Double Bedsheet', 'bedsheet,chadar', 'Home', 'pc', '6302', 5, 350, 599],
    ['Bath Towel', 'towel', 'Home', 'pc', '6302', 5, 120, 199],
  ] },
  { id: 'electronics', label: 'Electronics and mobiles', hint: 'Accessories, appliances, TVs', expiry: false, items: [
    ['Mobile Charger 20W', 'charger', 'Accessories', 'pc', '8504', 18, 250, 449],
    ['Wired Earphones', 'earphones', 'Accessories', 'pc', '8518', 18, 150, 299],
    ['Power Bank 10000mAh', 'power bank', 'Accessories', 'pc', '8507', 18, 650, 999],
    ['Phone Cover', 'cover,case', 'Accessories', 'pc', '3926', 18, 40, 149],
    ['Extension Board 4 socket', 'extension,board', 'Electrical', 'pc', '8536', 18, 180, 299],
    ['Ceiling Fan', 'fan,pankha', 'Appliances', 'pc', '8414', 18, 1500, 1999],
    ['Mixer Grinder 500W', 'mixer', 'Appliances', 'pc', '8509', 18, 1900, 2599],
    ['LED TV 32 inch', 'tv,led tv', 'TV', 'pc', '8528', 18, 9500, 11999],
  ] },
  { id: 'wholesale', label: 'Wholesale and distribution', hint: 'Cartons and bags to shops, on credit', expiry: true, items: [
    ['Glucose Biscuit carton (48)', 'biscuit carton', 'Biscuits', 'carton', '1905', 5, 1000, 1080],
    ['Salt bag (25 x 1kg)', 'salt bag', 'Staples', 'bag', '2501', 0, 560, 600],
    ['Sunflower Oil carton (12 x 1L)', 'oil carton', 'Oil', 'carton', '1512', 5, 1580, 1680],
    ['Detergent carton (10 x 1kg)', 'detergent carton', 'Home care', 'carton', '3402', 18, 1100, 1200],
    ['Atta 10kg bag', 'atta', 'Staples', 'bag', '1101', 5, 415, 440],
    ['Sugar 50kg bag', 'sugar bag', 'Staples', 'bag', '1701', 5, 1950, 2100],
  ] },
  { id: 'other', label: 'Something else', hint: 'Start empty and add your own items', expiry: false, items: [] },
]

export const STATES = [...new Set(Object.values(STATE_CODES))].sort()

export type BusinessIn = {
  kind: string; name: string; owner: string; phone: string; password: string
  state: string; gstin?: string; upi?: string; branches: string[]; starter: boolean
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')

/** Creates the business, its branches, the owner's login, Tally's chart of accounts and (optionally) starter items. */
export async function createBusiness(b: BusinessIn) {
  const type = BUSINESS_TYPES.find((t) => t.id === b.kind)
  if (!type) throw new OpError('Pick what kind of business this is.')
  const name = clean(b.name), owner = clean(b.owner)
  if (name.length < 2 || name.length > 60) throw new OpError('Enter the business name.')
  if (owner.length < 2 || owner.length > 60) throw new OpError('Enter the owner’s name.')
  let phone = b.phone.replace(/\D/g, '')
  if (phone.length === 10) phone = '91' + phone
  if (phone.length < 11 || phone.length > 15) throw new OpError('Enter the owner’s 10-digit mobile number.')
  if (b.password.length < 6) throw new OpError('Choose a password of at least 6 characters.')
  const g = checkGstin(b.gstin)
  const state = g.state ?? clean(b.state)
  if (!STATES.includes(state) && state !== 'Other') throw new OpError('Pick your state; it decides CGST and SGST versus IGST.')
  const upi = clean(b.upi ?? '')
  if (upi && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upi)) throw new OpError('A UPI ID looks like shopname@okhdfcbank.')
  const branches = [...new Set(b.branches.map(clean).filter(Boolean))]
  if (!branches.length) throw new OpError('Add at least one branch or shop.')
  if (branches.length > 20) throw new OpError('Up to 20 branches to start; add more later.')
  if (branches.some((x) => x.length > 40)) throw new OpError('Keep branch names short, like “Main shop” or “Station Road”.')
  if (await one('SELECT 1 FROM users WHERE phone=?', [phone])) throw new OpError('This mobile number already has a Pedhi login. Sign in instead.')

  return tx(async (t) => {
    const orgId = await run('INSERT INTO orgs (name, upi_id, gstin, state, books_from, kind) VALUES (?,?,?,?,?,?)', [name, upi || null, g.gstin, state, today(), type.id], t)
    const used = new Set<string>()
    for (const br of branches) {
      // invoice prefix: first letters, made unique within the business (MAI, STA, STA2…)
      let code = br.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X'), n = 1
      while (used.has(code)) code = code.slice(0, 3) + ++n
      used.add(code)
      await run('INSERT INTO branches (org_id, name, code) VALUES (?,?,?)', [orgId, br, code], t)
    }
    const userId = await run('INSERT INTO users (org_id, branch_id, name, role, title, phone, lang, pass_hash) VALUES (?,?,?,?,?,?,?,?)',
      [orgId, null, owner, 'owner', `Owner · ${name}`, phone, 'en', hashPassword(b.password)], t)
    await ensureChart(orgId, t)
    if (b.starter) {
      const ids = (await q<{ id: number }>('SELECT id FROM branches WHERE org_id=?', [orgId], t)).map((r) => r.id)
      for (const [iname, aliases, cat, unit, hsn, gst, cost, price] of type.items) {
        if (!RATES.includes(gst)) continue
        const itemId = await run('INSERT INTO items (org_id, name, aliases, category, unit, hsn, gst_rate, cost, price) VALUES (?,?,?,?,?,?,?,?,?)',
          [orgId, iname, aliases, cat, unit, hsn, gst, cost, price], t)
        for (const bid of ids) await run('INSERT INTO stock (item_id, branch_id, qty) VALUES (?,?,0)', [itemId, bid], t)
      }
    }
    await run('INSERT INTO audit (org_id, user_id, ts, action, detail) VALUES (?,?,?,?,?)',
      [orgId, userId, nowTs(), 'setup', `${name} set up as ${type.label} with ${branches.length} branch${branches.length > 1 ? 'es' : ''}`], t)
    return { orgId, userId }
  })
}
