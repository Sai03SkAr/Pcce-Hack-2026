import type { Transaction } from '@libsql/client'
import { db, q, run, tx } from './db'
import { hashPassword } from './auth'
import { SCHEMA, TABLES } from './schema'
import { addDays, nowTs, today, weekday } from './format'
import { seedBooks } from './seedBooks'

// Deterministic so the planted stories (and the tests that look for them) are stable.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// [name, aliases, category, unit, hsn, gst%, cost, price, how often it sells, typical qty per line]
type Spec = [string, string, string, string, string, number, number, number, number, number]
export const ITEMS: Spec[] = [
  ['ACC Cement 53 Grade 50kg', 'acc cement,acc,cement,bori', 'Cement', 'bag', '2523', 28, 372, 410, 14, 12],
  ['UltraTech Cement PPC 50kg', 'ultratech cement,ultratech,ultra tech', 'Cement', 'bag', '2523', 28, 365, 400, 9, 10],
  ['Ambuja Cement 50kg', 'ambuja cement,ambuja', 'Cement', 'bag', '2523', 28, 360, 395, 5, 10],
  ['Birla White Cement 5kg', 'white cement,birla white', 'Cement', 'bag', '2523', 28, 165, 195, 2, 3],
  ['Tata Tiscon TMT 12mm', 'tmt 12mm,tiscon 12mm,sariya 12mm,12mm rod,12mm', 'Steel', 'rod', '7214', 18, 720, 790, 5, 10],
  ['Tata Tiscon TMT 8mm', 'tmt 8mm,tiscon 8mm,sariya 8mm,8mm rod,8mm', 'Steel', 'rod', '7214', 18, 325, 360, 5, 12],
  ['JSW Neosteel TMT 10mm', 'tmt 10mm,jsw 10mm,sariya 10mm,10mm rod,10mm', 'Steel', 'rod', '7214', 18, 505, 555, 4, 10],
  ['Binding Wire 1kg', 'binding wire,taar', 'Steel', 'kg', '7217', 18, 68, 82, 5, 4],
  ['Asian Paints Tractor Emulsion 20L', 'tractor emulsion,tractor', 'Paint', 'bucket', '3209', 18, 2450, 2890, 1.6, 1],
  ['Asian Paints Apex Ultima 20L Terracotta', 'apex ultima,apex,terracotta', 'Paint', 'bucket', '3209', 18, 5150, 5990, 0.8, 1],
  ['Berger Weathercoat 10L', 'weathercoat,berger', 'Paint', 'bucket', '3209', 18, 2180, 2540, 1, 1],
  ['Asian Paints Primer 20L', 'primer', 'Paint', 'bucket', '3209', 18, 1650, 1950, 1.2, 1],
  ['JK Wall Putty 40kg', 'wall putty,putty', 'Paint', 'bag', '3214', 18, 640, 740, 3, 4],
  ['Paint Brush 4 inch', 'paint brush,brush', 'Paint', 'pc', '9603', 18, 85, 130, 4, 3],
  ['Paint Roller 9 inch', 'paint roller,roller', 'Paint', 'pc', '9603', 18, 120, 180, 2, 2],
  ['Supreme PVC Pipe 1 inch 6m', 'pvc pipe,pvc', 'Plumbing', 'pc', '3917', 18, 310, 375, 4, 5],
  ['Supreme CPVC Pipe 3/4 inch 3m', 'cpvc pipe,cpvc', 'Plumbing', 'pc', '3917', 18, 265, 320, 4, 5],
  ['Astral Elbow 1 inch', 'elbow', 'Plumbing', 'pc', '3917', 18, 18, 28, 5, 8],
  ['Sintex Water Tank 1000L', 'water tank,sintex,tanki', 'Plumbing', 'pc', '3925', 18, 6200, 7400, 0.9, 1],
  ['Jaquar Bib Cock', 'bib cock,jaquar tap,nal', 'Plumbing', 'pc', '8481', 18, 540, 690, 1.5, 2],
  ['Teflon Tape', 'teflon tape,teflon', 'Plumbing', 'pc', '3920', 18, 12, 20, 4, 4],
  ['Finolex Wire 1.5 sqmm 90m', 'finolex 1.5,wire 1.5,1.5 wire', 'Electrical', 'coil', '8544', 18, 1380, 1620, 2.5, 1],
  ['Finolex Wire 2.5 sqmm 90m', 'finolex 2.5,wire 2.5,2.5 wire', 'Electrical', 'coil', '8544', 18, 2180, 2540, 2, 1],
  ['Anchor Roma Switch 6A', 'roma switch,switch', 'Electrical', 'pc', '8536', 18, 28, 42, 5, 10],
  ['Havells MCB 16A', 'havells mcb,mcb', 'Electrical', 'pc', '8536', 18, 185, 245, 2, 3],
  ['Philips LED Bulb 9W', 'led bulb,bulb', 'Electrical', 'pc', '8539', 18, 62, 95, 6, 4],
  ['PVC Conduit Pipe 25mm', 'conduit pipe,conduit', 'Electrical', 'pc', '3917', 18, 48, 68, 4, 10],
  ['Kajaria Floor Tile 2x2 box', 'kajaria tile,floor tile,kajaria,tiles', 'Tiles', 'box', '6907', 18, 820, 980, 3, 8],
  ['Somany Wall Tile box', 'somany tile,wall tile,somany', 'Tiles', 'box', '6907', 18, 610, 740, 2, 6],
  ['Roff Tile Adhesive 20kg', 'tile adhesive,roff', 'Tiles', 'bag', '3214', 18, 345, 420, 3, 4],
  ['Dr Fixit LW+ 1L', 'dr fixit,drfixit,waterproofing', 'Tiles', 'pc', '3824', 18, 265, 330, 2, 2],
  ['Fevicol SH 1kg', 'fevicol', 'Tiles', 'pc', '3506', 18, 215, 270, 3, 2],
  ['Door Hinges 4 inch pair', 'hinges,kabja', 'Hardware', 'pair', '8302', 18, 55, 85, 4, 4],
  ['Godrej Door Lock', 'door lock,godrej lock,lock,tala', 'Hardware', 'pc', '8301', 18, 780, 990, 1.2, 1],
  ['Nails 2 inch 1kg', 'nails,khila,keel', 'Hardware', 'kg', '7317', 18, 78, 100, 5, 2],
  ['Screws Box 1.5 inch', 'screws,screw', 'Hardware', 'box', '7318', 18, 95, 135, 4, 2],
  ['Sand Paper Sheet', 'sand paper,sandpaper,regmal', 'Hardware', 'pc', '6805', 18, 8, 15, 4, 10],
  ['Hacksaw Blade', 'hacksaw blade,hacksaw', 'Hardware', 'pc', '8202', 18, 28, 45, 3, 3],
  ['Measuring Tape 5m', 'measuring tape', 'Hardware', 'pc', '9017', 18, 110, 160, 1.5, 1],
  ['Wheelbarrow', 'wheelbarrow,wheel barrow', 'Hardware', 'pc', '8716', 18, 2100, 2550, 0.6, 1],
  ['Shovel (Phavda)', 'shovel,phavda', 'Hardware', 'pc', '8201', 18, 260, 340, 1.2, 2],
  ['Safety Helmet', 'safety helmet,helmet', 'Hardware', 'pc', '6506', 18, 140, 210, 1.2, 3],
  ['River Sand per brass', 'river sand,sand,reti', 'Aggregates', 'brass', '2505', 5, 5200, 6100, 1.5, 1],
  ['Crushed Stone 20mm per brass', 'crushed stone,khadi,aggregate', 'Aggregates', 'brass', '2517', 5, 3100, 3700, 1.3, 1],
  ['Red Bricks per 1000', 'red bricks,bricks,eent,vit', 'Aggregates', '1000', '6901', 12, 7200, 8400, 1, 1],
  ['AAC Block 6 inch', 'aac block,aac', 'Aggregates', 'pc', '6810', 18, 62, 74, 2, 120],
]
const PO_DAYS = [10, 22, 34, 46, 58, 70, 84]
const LEAD: Record<string, number> = { Cement: 2, Steel: 4, Paint: 5, Plumbing: 3, Electrical: 3, Tiles: 4, Hardware: 3, Aggregates: 1 }
const item = (name: string) => ITEMS.findIndex((i) => i[0].startsWith(name)) + 1

const BRANCHES = [
  { id: 1, name: 'Margao', code: 'MRG', f: 1, bills: 30 },
  { id: 2, name: 'Mapusa', code: 'MAP', f: 0.7, bills: 21 },
  { id: 3, name: 'Ponda', code: 'PON', f: 0.5, bills: 15 },
]

/** Demo sign-in password: first name + 123, e.g. suresh123 (CA: prakash123). Listed in PEDHI_GUIDE.md; the family changes them under People.
 *  shortcut: demo-only defaults, replace with passwords people choose before real use. */
export const demoPassword = (name: string) => name.replace(/^CA /, '').split(' ')[0].toLowerCase() + '123'

// [id, branch, name, role, title, phone, lang]
const USERS: [number, number | null, string, string, string, string, string][] = [
  [1, null, 'Suresh Naik', 'owner', 'Owner · founder, 1989', '919322106240', 'hi'], // the demo phone for real WhatsApp
  [2, null, 'Anita Naik', 'family', 'Daughter · finance', '919822000002', 'en'],
  [3, 2, 'Rohan Naik', 'manager', 'Son · runs Mapusa', '919822000003', 'en'],
  [4, 3, 'Raju Gawde', 'staff', 'Counter staff · Ponda', '919822000004', 'hi'],
  [5, 3, 'Santosh Parab', 'staff', 'Evening counter · Ponda', '919822000005', 'hi'],
  [6, 1, 'Meena Kerkar', 'staff', 'Counter staff · Margao', '919822000006', 'en'],
  [7, 2, 'Vishal Salgaonkar', 'staff', 'Counter staff · Mapusa', '919822000007', 'hi'],
  [8, null, 'CA Prakash Kamat', 'ca', 'Chartered accountant · reviews and signs the books', '919822000008', 'en'],
]

// [branch, name, aliases, credit limit, how often they buy, notes]
const CUSTOMERS: [number, string, string, number, number, string][] = [
  [1, "D'Souza Builders", 'dsouza,d souza', 200000, 1.4, ''],
  [1, 'Ramesh Gaonkar Contractor', 'ramesh,gaonkar', 80000, 1.6, 'Customer since 1998. Always clears dues within two weeks.'],
  [1, 'Shree Datta Constructions', 'datta,shree datta', 150000, 1.2, ''],
  [1, 'Fernandes & Sons', 'fernandes', 100000, 1, ''],
  [1, 'Kamat Infra', 'kamat', 200000, 1.3, 'Pays by NEFT on the 5th and 20th.'],
  [1, 'Salcete Housing Society', 'salcete', 60000, 0.6, ''],
  [1, 'Prabhu Interiors', 'prabhu', 60000, 0.8, ''],
  [1, 'Colaco Civil Works', 'colaco', 120000, 1.8, 'Was buying twice a week for the Fatorda project.'],
  [1, 'Verlekar Plumbing', 'verlekar', 50000, 0.9, ''],
  [1, 'Sai Electricals', 'sai electricals,sai', 50000, 0.9, ''],
  [1, 'Borkar Developers', 'borkar', 150000, 1.5, 'Pays only after the builder releases stage payment. Call Mr. Borkar directly, not the site office.'],
  [1, 'Mascarenhas Builders', 'mascarenhas', 100000, 0.8, ''],
  [2, 'Bardez Constructions', 'bardez', 150000, 1.5, ''],
  [2, 'Lobo Contractors', 'lobo', 50000, 1.5, 'Cheque bounced once in 2024. No credit beyond the limit without Suresh saying yes.'],
  [2, 'Shirodkar Tiles & Flooring', 'shirodkar', 80000, 1, ''],
  [2, 'Naik Painting Works', 'painting works', 40000, 0.9, ''],
  [2, 'Calangute Villas Pvt Ltd', 'calangute', 200000, 1.2, ''],
  [2, 'Gauns Engineering', 'gauns', 100000, 1, ''],
  [2, 'Pinto Civil', 'pinto', 60000, 0.8, ''],
  [2, 'Mandrekar Builders', 'mandrekar', 100000, 1, ''],
  [2, 'Anjuna Resorts', 'anjuna', 80000, 0.6, ''],
  [2, 'Khorjuvekar Electricals', 'khorjuvekar', 40000, 0.7, ''],
  [3, 'Dhavalikar Constructions', 'dhavalikar', 120000, 1.4, ''],
  [3, 'Sawant Municipal Contractor', 'sawant', 40000, 1.5, 'Government bills clear late. Usually pays in one shot when the tender payment arrives.'],
  [3, 'Shantadurga Builders', 'shantadurga', 100000, 1.2, ''],
  [3, 'Farmagudi Housing', 'farmagudi', 60000, 0.8, ''],
  [3, 'Usgaonkar Fabricators', 'usgaonkar', 60000, 0.9, ''],
  [3, 'Khandeparkar Plumbing', 'khandeparkar', 40000, 0.8, ''],
  [3, 'Bhat Interiors', 'bhat', 50000, 0.7, ''],
  [3, 'Marcel Farms', 'marcel', 40000, 0.5, ''],
]
const cust = (name: string) => CUSTOMERS.findIndex((c) => c[1].startsWith(name)) + 1

async function bulk(t: Transaction, table: string, cols: string[], rows: any[][]) {
  const per = Math.floor(900 / cols.length) // stay under SQLite's bound-variable limit
  const tuple = `(${cols.map(() => '?').join(',')})`
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per)
    await t.execute({ sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES ${chunk.map(() => tuple).join(',')}`, args: chunk.flat() })
  }
}

export async function seed() {
  const r = rng(20261113)
  const T = today()
  const N = 90
  const day0 = addDays(T, -N)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hourNow = +nowTs().slice(11, 13) + +nowTs().slice(14, 16) / 60
  const todayFrac = Math.min(1, Math.max(0.25, (hourNow - 9) / 11))

  const sales: any[][] = [], lines: any[][] = [], moves: any[][] = [], payments: any[][] = [], closings: any[][] = []
  const sold = new Map<string, { all: number; d28: number }>()
  const invSeq: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const balance = new Map<number, number>()
  const cashByDay = new Map<string, number>()
  let saleId = 0

  const OVERDUE = [cust('Borkar'), cust('Lobo'), cust('Sawant')]
  const QUIET = cust('Colaco')
  const ACC = item('ACC'), DEAD = item('Asian Paints Apex'), JSW = item('JSW')
  const totalW = ITEMS.reduce((s, i) => s + i[8], 0)

  function addSale(d: number, branchId: number, customerId: number | null, userId: number, hr: number,
    ls: { it: number; qty: number; price?: number }[], mode: string) {
    const day = addDays(day0, d)
    const b = BRANCHES[branchId - 1]
    const inv = `${b.code}-${pad(0)}${String(++invSeq[branchId]).padStart(4, '0')}`
    let total = 0, tax = 0, cost = 0
    saleId++
    for (const l of ls) {
      const s = ITEMS[l.it - 1]
      const price = l.price ?? s[7]
      const lt = price * l.qty
      total += lt
      tax += Math.round((lt * s[5]) / (100 + s[5]))
      cost += s[6] * l.qty
      lines.push([saleId, l.it, l.qty, price, s[6]])
      moves.push([1, l.it, branchId, day, 'sale', -l.qty, inv, userId])
      const k = `${l.it}:${branchId}`
      const e = sold.get(k) ?? { all: 0, d28: 0 }
      e.all += l.qty
      if (d >= N - 28 && d < N) e.d28 += l.qty
      sold.set(k, e)
    }
    sales.push([saleId, 1, branchId, customerId, userId, day, `${day} ${pad(hr)}:${pad(Math.floor(r() * 60))}:00`, inv, total, tax, cost, mode, 'pos'])
    if (mode === 'credit' && customerId) balance.set(customerId, (balance.get(customerId) ?? 0) + total)
    if (mode === 'cash') cashByDay.set(`${branchId}:${day}`, (cashByDay.get(`${branchId}:${day}`) ?? 0) + total)
  }

  const WD = [0.4, 1.05, 1, 1, 1, 1.05, 1.2]
  const festive = (day: string, branchId: number) =>
    day === '2026-11-06' ? (branchId === 1 ? 2.3 : 1.5) : day >= '2026-11-02' && day <= '2026-11-07' ? 1.3 : 1

  for (let d = 0; d <= N; d++) {
    const day = addDays(day0, d)
    for (const b of BRANCHES) {
      const oos = b.id === 2 && d >= N - 4 // story 1: Mapusa has run out of its best seller
      let f = WD[weekday(day)] * festive(day, b.id) * (0.88 + r() * 0.24)
      if (d === N) f *= todayFrac
      if (oos) f *= 0.86
      const nb = Math.round(b.bills * f)
      const pool = CUSTOMERS.map((c, i) => ({ id: i + 1, branch: c[0], w: c[4] })).filter(
        (c) => c.branch === b.id && !(OVERDUE.includes(c.id) && d > N - 53) && !(c.id === QUIET && d >= N - 24))
      const poolW = pool.reduce((s, c) => s + c.w, 0)
      for (let i = 0; i < nb; i++) {
        let customerId: number | null = null
        if (r() < 0.38) {
          let x = r() * poolW
          customerId = pool.find((c) => (x -= c.w) <= 0)?.id ?? pool[0].id
        }
        const nLines = 1 + Math.floor(r() * r() * 4)
        const ls: { it: number; qty: number }[] = []
        for (let j = 0; j < nLines; j++) {
          let x = r() * totalW
          const it = ITEMS.findIndex((s) => (x -= s[8]) <= 0) + 1 || 1
          const qty = Math.max(1, Math.round(ITEMS[it - 1][9] * (0.4 + r() * 1.4) * (customerId ? 1.6 : 1)))
          if (ls.some((l) => l.it === it)) continue
          if (it === DEAD && d > 14) continue // story 4: this paint line stopped selling
          if (it === ACC && oos) continue
          ls.push({ it, qty })
        }
        if (!ls.length) continue
        const mode = customerId ? (r() < 0.72 ? 'credit' : r() < 0.5 ? 'upi' : 'cash') : r() < 0.5 ? 'cash' : 'upi'
        const hr = 9 + Math.floor(r() * (d === N ? Math.max(1, Math.min(11, hourNow - 9)) : 11))
        const userId = b.id === 1 ? 6 : b.id === 2 ? 7 : hr < 14 ? 4 : 5
        addSale(d, b.id, customerId, userId, hr, ls, mode)
      }
    }

    // story 3: three contractors take a large order on credit and then go quiet
    if (d === N - 49) addSale(d, 1, cust('Borkar'), 6, 11, [{ it: ACC, qty: 150 }, { it: item('Tata Tiscon TMT 12mm'), qty: 40 }], 'credit')
    if (d === N - 47) addSale(d, 2, cust('Lobo'), 7, 15, [{ it: item('UltraTech'), qty: 60 }, { it: JSW, qty: 30 }, { it: item('Kajaria'), qty: 10 }], 'credit')
    if (d === N - 46) addSale(d, 3, cust('Sawant'), 4, 10, [{ it: item('River Sand'), qty: 2 }, { it: ACC, qty: 50 }], 'credit')
    // margin leak: one counter keeps selling a rod below cost
    if ([N - 5, N - 3, N - 2].includes(d)) addSale(d, 2, cust('Bardez'), 7, 16, [{ it: JSW, qty: 20, price: 480 }], 'cash')

    if (d === N) break
    for (let c = 1; c <= CUSTOMERS.length; c++) {
      const bal = balance.get(c) ?? 0
      const overdue = OVERDUE.includes(c)
      const due = overdue ? d === N - 53 : (d + c * 3) % (10 + ((c * 7) % 9)) === 0
      if ((overdue && d > N - 53) || !due || bal < 2000) continue
      const amount = overdue ? bal : Math.round((bal * (0.8 + r() * 0.2)) / 100) * 100
      const mode = r() < 0.6 ? 'upi' : 'cash'
      const branchId = CUSTOMERS[c - 1][0]
      payments.push([1, c, branchId, day, amount, mode, branchId === 1 ? 6 : branchId === 2 ? 7 : 4, 'pos'])
      balance.set(c, bal - amount)
      if (mode === 'cash') cashByDay.set(`${branchId}:${day}`, (cashByDay.get(`${branchId}:${day}`) ?? 0) + amount)
    }
    for (const b of BRANCHES) {
      const expected = cashByDay.get(`${b.id}:${day}`) ?? 0
      // story 5: cash comes up short at Ponda on Tuesdays, same evening shift
      const short = b.id === 3 && weekday(day) === 2 && d >= N - 21 ? 1900 + ((d * 37) % 6) * 100 : 0
      closings.push([b.id, day, expected, expected - short + Math.round((r() - 0.5) * 8) * 10, b.id === 3 ? 5 : b.id === 1 ? 6 : 7])
    }
  }

  const stock: any[][] = []
  ITEMS.forEach((s, idx) => {
    const it = idx + 1
    for (const b of BRANCHES) {
      const e = sold.get(`${it}:${b.id}`) ?? { all: 0, d28: 0 }
      const avg = e.d28 / 28
      let qty = avg ? Math.round(avg * (9 + r() * 19)) : 1 + Math.floor(r() * 3)
      if (it === ACC && b.id === 2) qty = 0
      if (it === ACC && b.id === 3) qty = Math.round(avg * 46) // story 2: Ponda is sitting on the same item
      if (it === item('UltraTech') && b.id === 1) qty = Math.round(avg * 1.6)
      if (it === item('Finolex Wire 1.5') && b.id === 3) qty = Math.max(1, Math.round(avg * 1.5))
      if (it === DEAD) qty = b.id === 1 ? 12 : b.id === 2 ? 2 : 0
      stock.push([it, b.id, qty, Math.ceil(avg * (LEAD[s[2]] + 3))])
      const inTotal = qty + e.all
      // Opening stock, then a purchase roughly every 12 days (the books seed turns these into supplier bills)
      const open = Math.round(inTotal * 0.35), po = Math.floor((inTotal - open) / 7)
      moves.push([1, it, b.id, addDays(day0, -1), 'opening', open, 'Opening stock', null])
      PO_DAYS.forEach((d, k) => moves.push([1, it, b.id, addDays(day0, d), 'purchase', k < 6 ? po : inTotal - open - 6 * po, `PO-${b.code}-${d}`, null]))
    }
  })

  await db.executeMultiple(TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n') + SCHEMA)
  await tx(async (t) => {
    await t.execute(`INSERT INTO orgs (id, name, upi_id) VALUES (1, 'Naik Traders', 'naiktraders@okhdfcbank')`)
    await bulk(t, 'branches', ['id', 'org_id', 'name', 'code'], BRANCHES.map((b) => [b.id, 1, b.name, b.code]))
    await bulk(t, 'users', ['id', 'org_id', 'branch_id', 'name', 'role', 'title', 'phone', 'lang', 'pass_hash'], USERS.map((u) => [u[0], 1, ...u.slice(1), hashPassword(demoPassword(u[2]))]))
    await bulk(t, 'items', ['id', 'org_id', 'name', 'aliases', 'category', 'unit', 'hsn', 'gst_rate', 'cost', 'price', 'lead_days'],
      ITEMS.map((s, i) => [i + 1, 1, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], LEAD[s[2]]]))
    await bulk(t, 'customers', ['id', 'org_id', 'branch_id', 'name', 'aliases', 'phone', 'credit_limit', 'notes'],
      CUSTOMERS.map((c, i) => [i + 1, 1, c[0], c[1], c[2], `9198230${String(10001 + i * 137).slice(0, 5)}`, c[3], c[5]]))
    await bulk(t, 'stock', ['item_id', 'branch_id', 'qty', 'reorder_level'], stock)
    await bulk(t, 'sales', ['id', 'org_id', 'branch_id', 'customer_id', 'user_id', 'day', 'ts', 'invoice_no', 'total', 'tax', 'cost_total', 'mode', 'source'], sales)
    await bulk(t, 'sale_items', ['sale_id', 'item_id', 'qty', 'price', 'cost'], lines)
    await bulk(t, 'stock_moves', ['org_id', 'item_id', 'branch_id', 'day', 'type', 'qty', 'ref', 'user_id'], moves)
    await bulk(t, 'payments', ['org_id', 'customer_id', 'branch_id', 'day', 'amount', 'mode', 'user_id', 'source'], payments)
    await bulk(t, 'cash_closings', ['branch_id', 'day', 'expected', 'counted', 'user_id'], closings)
  })
  const books = await seedBooks(1, day0, T)
  return { sales: sales.length, lines: lines.length, payments: payments.length, ...books }
}

// First request on an empty database seeds it, so `npm run dev` needs no setup step.
const g = globalThis as unknown as { __pedhiReady?: Promise<void> }
export const ready = () =>
  (g.__pedhiReady ??= (async () => {
    const t = await q(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='orgs'`)
    if (!t.length || !(await q('SELECT 1 FROM orgs LIMIT 1')).length) return void await seed()
    // databases made before expiry dates and WhatsApp approvals existed
    await db.execute('ALTER TABLE purchase_items ADD COLUMN expiry TEXT').catch(() => {})
    await db.execute('CREATE TABLE IF NOT EXISTS pending (user_id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, action TEXT NOT NULL, ts TEXT NOT NULL)')
    // databases made before sign-in passwords: give every person their demo password
    if (await db.execute('ALTER TABLE users ADD COLUMN pass_hash TEXT').then(() => true, () => false))
      for (const u of await q<{ id: number; name: string }>('SELECT id, name FROM users')) await run('UPDATE users SET pass_hash=? WHERE id=?', [hashPassword(demoPassword(u.name)), u.id])
  })())
