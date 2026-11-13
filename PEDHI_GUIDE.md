# Pedhi: the complete guide

**PS 12 · AI Family Business Operating System · status on 13 Nov 2026**

## 1. What Pedhi is

Pedhi (पेढी, the old word for a family trading house) is an **AI munim** for family businesses with one or more branches. Staff keep working the way they already do (the counter, WhatsApp, their voice). Pedhi turns that into clean records of sales, stock, udhaar and proper Tally-style books. Every morning the owner gets one message: what happened, what is wrong, and what to do about it.

It installs on a phone or laptop like an app (from the browser, no app store), works in English and Hindi/Hinglish, and runs without any paid service. The AI features get better when an AI key is added.

The demo business is **Naik Traders**: hardware and building materials, three branches in Goa (Margao, Mapusa, Ponda), 46 items, 30 customers, 8 suppliers, 90 days of history with real problems planted in it.

---

## 1b. What Pedhi replaces

### Instead of a udhaar app (Khatabook, OkCredit) or a paper khata: **yes, fully**
| What a udhaar app does | Pedhi |
|---|---|
| A khata per customer with running balance | ✅ from the books, every entry type |
| "You gave" / "You got" entries | ✅ Got money, Gave money, Added a charge, Discount, Write-off |
| Bring old dues | ✅ one customer at a time, or import the whole list |
| Share a statement with the customer | ✅ private link, works on any phone, Pay by UPI button |
| Payment reminders with a payment link | ✅ one tap, all overdue, or automatic every morning |
| Supplier dues | ✅ suppliers khata |
| Credit limits and due days | ✅ per customer; staff are stopped at the limit |
| Plus what they don't do | Bills, stock, GST, books, branches, the owner's brief |

### Instead of Tally for a trading business: **yes, for everything a typical shop or distributor does**
| What Tally does | Pedhi |
|---|---|
| Ledgers under the 28 standard groups | ✅ created automatically; any other ledger via Advanced entry |
| Sales, Purchase, Receipt, Payment, Contra, Journal, Credit Note, Debit Note | ✅ all eight voucher types |
| GST: CGST/SGST/IGST, input credit, GSTR-1 and GSTR-3B numbers, HSN summary | ✅ (prepared; filing stays with you or the CA) |
| Stock with godowns | ✅ branches as godowns, transfers, returns |
| Day Book, Ledgers, Trial Balance, P&L, Balance Sheet | ✅ plus branch-wise P&L |
| Bank reconciliation | ✅ |
| Loans, fixed assets, depreciation, corrections | ✅ Advanced entry with templates |
| Period lock after audit | ✅ CA sign-off |
| Backup and restore | ✅ |
| CA works in Tally | ✅ Tally XML export of every ledger and voucher |

**Not included (only some businesses need these; a CA can still use Tally for them):** TDS deduction and returns, payroll, generating e-invoice IRN and e-way bills (needed above ₹5 crore turnover, or for inter-state goods above ₹50,000), filing returns on the GST portal, automatic bank-statement import, manufacturing and bill of materials, batch and expiry tracking, multiple currencies.

## 2. What you need to do (step by step)

Everything on my side is done. These are the only steps left for you, in order. **Steps 1 to 4 are needed for the hackathon; 5 to 8 are optional.**

### Step 1. Get the app running on the demo laptop (10 minutes)
1. Install **Node.js 20 or newer** from https://nodejs.org (the LTS button). Check it in a terminal:
   ```bash
   node -v
   ```
   It should print v20 or higher.
2. Copy the whole `PCCE Hackathon` folder to the demo laptop (pen drive, or Google Drive).
3. In a terminal, go into the app folder and install it once (needs internet, about 2 minutes):
   ```bash
   cd "PCCE Hackathon/pedhi"
   ```
   ```bash
   npm install
   ```
4. Start it:
   ```bash
   npm run dev
   ```
5. Open **http://localhost:3000** in Chrome. Pick **Suresh Naik (Owner)**. You should see "Good morning/afternoon, Suresh ji" with the brief.
   - If it says port 3000 is busy (it is on your Mac), use `npm run dev -- -p 3100` and open http://localhost:3100.
6. Check it worked:
   ```bash
   npm test
   ```
   It should end with `pass 21` and `fail 0`.

### Step 2. Add the AI key (5 minutes, recommended)
Without a key everything works on the rule engine. With it, the brief reads naturally in Hindi, Ask Pedhi answers any question, and voice/WhatsApp understand looser sentences.
1. Get an API key from https://console.anthropic.com (Settings → API keys). Add a small amount of credit.
2. In the `pedhi` folder create a file named `.env.local` containing one line:
   ```bash
   ANTHROPIC_API_KEY=paste-your-key-here
   ```
3. Stop the app (Ctrl+C) and start it again with `npm run dev`. The sidebar dot changes from "Rule engine mode" to **"AI connected"**.
4. Test: Today → **Rewrite** on the brief; Ask Pedhi → "Mapusa ki sale kam kyun hai?". If anything fails, the app quietly falls back to the rule engine, so the demo cannot break.
5. Never put the key in a screenshot, slide or GitHub. `.env.local` is already excluded from git.

### Step 3. Install it as an app on your phone (10 minutes)
Phones only offer "Install" on an **https** link, so the laptop needs a tunnel:
1. Keep the app running (Step 1). In a **second** terminal:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   (use 3100 if you started on 3100). It prints a link like `https://something.trycloudflare.com`.
2. Open that link on your phone in **Chrome (Android)** or **Safari (iPhone)** and sign in.
3. Install: Android: tap **More → Install app** (or Chrome menu ⋮ → Install app). iPhone: **Share → Add to Home Screen**.
4. Open Pedhi from the home screen: it opens full-screen with the red पे icon, no browser bar.
5. The tunnel link changes every time you restart it; reinstall if it changes. For a permanent link, see Step 7.

### Step 4. Prepare the demo (15 minutes, on pitch day)
1. Sign in as the owner → sidebar bottom → **Reset demo data**. Every planted story is fresh.
2. Rehearse the walkthrough in `pedhi/README.md` (about 4 minutes) twice, timed.
3. Record your screen running the walkthrough once (QuickTime on Mac: File → New Screen Recording) as a backup if venue Wi-Fi fails.
4. Have a phone hotspot ready. The app itself works offline on the laptop; only the phone tunnel and the AI key need internet.
5. Keep `PEDHI_GUIDE.md` and `TALLY_RESEARCH_AND_ACCOUNTING_PLAN.md` open for judge questions.

### Step 5 (optional). Test the Tally export on a Windows PC
Follow `tally-test-pack/HOW-TO-TEST-IN-TALLY.md`. If the Trial Balance matches, you can tell judges "tested in TallyPrime". If Tally shows errors, send me the `tally.imp` file and I'll fix it.

### Step 6 (optional). Real WhatsApp instead of the simulator
1. https://developers.facebook.com → Create App → Business → add **WhatsApp**.
2. In WhatsApp → API Setup, note the **test phone number ID** and the **temporary access token**; add your phone under "To" (up to 5 numbers).
3. In `pedhi/.env.local` add:
   ```bash
   WHATSAPP_TOKEN=...
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_VERIFY_TOKEN=any-secret-word-you-choose
   ```
4. In Meta → WhatsApp → Configuration → Webhook: URL `https://<your-tunnel-link>/api/whatsapp`, verify token = the same secret word; subscribe to **messages**.
5. In `pedhi/lib/seed.ts`, change one user's phone (for example Raju, `919822000004`) to your number with country code (91 + 10 digits), then **Reset demo data**.
6. Send "hi" from your phone to the test number. Note: the temporary token expires in 24 hours.

### Step 7 (optional). A permanent public link (Vercel + Turso, free tiers)
1. Push the `pedhi` folder to a GitHub repository (I can do the commit for you; just say so).
2. Create a free database at https://turso.tech, and copy its URL and token.
3. Import the repo at https://vercel.com, and set environment variables `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (and `ANTHROPIC_API_KEY` if you have one).
4. Deploy. The first visit fills the database with the demo story. Install the app on phones from this link; it never changes.

### Step 7b (optional). Automatic reminders that send themselves
Once deployed on Vercel (Step 7) with real WhatsApp (Step 6): add an environment variable `CRON_SECRET` (any long random word). `vercel.json` already runs the reminder job every morning at 10:00 IST. Then the owner switches on **Udhaar → Automatic reminders**. Until then, **Send today's now** prepares the messages for you to send.

### Step 8 (before any real business uses it, not for the hackathon)
- A CA reviews the ledger and GST rules (ask them to check `TALLY_RESEARCH_AND_ACCOUNTING_PLAN.md` section 3).
- Take a backup every week: **Books → CA pack → Download backup**.
- Replace the demo persona login with OTP login, add the WhatsApp signature check, and set up daily database backups.

---

## 3. How it flows

```
 COUNTER (tap or voice)      WHATSAPP message            BOOKS screen (tap or "Tell Pedhi")
        │                          │                                │
        └──────────── one set of business rules (stock, credit limit, branch walls, CA lock) ─────┐
                                    │                                                            │
        bill → stock goes down, udhaar goes up, a Sales voucher is posted                        │
        payment → udhaar goes down, a Receipt voucher is posted                                   │
        purchase / expense / deposit / owner money → Purchase, Payment, Contra vouchers ─────────┘
                                    │
                  METRICS LAYER (every number on every screen comes from here)
                                    │
             INSIGHT ENGINE: stock-outs and their cause, sales drops, overdue udhaar, dead stock,
             below-cost billing, cash shortfalls, customers gone quiet, good news; each sized in ₹
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     ▼                              ▼                              ▼
 7 AM BRIEF (WhatsApp/Today)   TODAY: one-tap fixes            ASK PEDHI: questions answered
 Hindi or English              (transfer, reminders,           from the books, with the query
                               record purchase)                behind each number
                                    │
                    BOOKS → Day Book, Ledgers, P&L, Balance Sheet, GST → CA PACK
                    (Tally XML + Excel) → CA reviews → CA signs off → period locked
```

**A day in the demo story**
1. 7 am: Suresh (owner) reads the brief: Mapusa sales are down 30% because ACC cement ran out; Ponda has 46 days of it.
2. He taps **Transfer from Ponda**. Mapusa can sell again and the issue leaves the list.
3. Raju (Ponda counter) sends on WhatsApp: "Dhavalikar ko 10 bori ACC cement udhaar". The bill, stock, udhaar and the Sales voucher all update; Suresh sees it live.
4. Anita (daughter, finance) presses **Remind all 3 overdue**: WhatsApp messages with a UPI link for the exact amount.
5. The cement supplier's truck arrives: "Goa Cement se 200 bag ACC cement liya udhaar" in Books → a purchase with GST credit, stock added, supplier owed.
6. At month end the CA downloads the Tally files, checks the P&L and GST, and **signs off**. That month is locked.

---

## 4. Every feature, screen by screen

Status: ✅ built and tested · ⚙️ works, needs a key or setup for the full version · 🧭 roadmap (not built)

### Getting in
| Feature | Status |
|---|---|
| Persona sign-in: owner, family, branch manager, counter staff, CA (8 people) | ✅ |
| Each role sees a different app (see section 5) | ✅ |
| Installable app: own icon, full-screen, home-screen shortcuts (New bill, Books, Udhaar) | ✅ (needs https to install) |
| English / हिंदी switch for the brief, issues and suggestions | ✅ |
| Light and dark mode (follows the phone) | ✅ |
| Phone layout with bottom tab bar and More menu; desktop layout with sidebar | ✅ |
| Real OTP login | 🧭 |

### Today (owner, family, manager)
| Feature | Status |
|---|---|
| Greeting, date, branch filter (all branches or one) | ✅ |
| KPIs: today so far, last 7 days with trend line, gross margin, udhaar outstanding and overdue, stock value with out/low counts | ✅ |
| Morning brief shown as a WhatsApp message; Rewrite button | ✅ (AI wording ⚙️) |
| "Needs attention": issues found by rules, ranked by ₹ at stake | ✅ |
| One-tap fixes: transfer stock, send reminders, record purchase, mark handled or dismiss | ✅ |
| 30-day sales chart by branch, top sellers, branch cards with issue counts | ✅ |

**Issues the engine finds:** stock-out (and the ₹ lost per day), about to run out before the supplier can deliver, sales drop vs the usual weekday and its cause, another branch that can cover the shortage, overdue udhaar and customers over their limit, dead stock not sold in 60+ days, items billed below cost, cash short at closing (same day, same person), regular customers who stopped ordering, and one piece of good news.

### New bill (everyone)
| Feature | Status |
|---|---|
| Item tiles with price and stock left, search (Enter adds), quantity steppers | ✅ |
| Say or type the whole bill ("Ramesh ko 10 bori ACC cement aur 2 kg nails udhaar") | ✅ voice in Chrome/Edge/Safari |
| Customer search with dues and credit limit shown; add a new customer right from the bill | ✅ |
| Cash / UPI / Udhaar | ✅ |
| Refuses: selling more than stock, udhaar without a customer, staff going over a credit limit (owner can approve; it is logged) | ✅ |
| Staff cannot change prices | ✅ |
| Saved bill → GST tax invoice with your GSTIN and the customer's (CGST+SGST, or IGST for another state), print, cancel (stock comes back) | ✅ |
| Phone: sticky cart bar with total | ✅ |
| Thermal-printer format, barcode scanning | 🧭 |

### Sales
| Feature | Status |
|---|---|
| Today / 7 days / 30 days; cash, UPI, udhaar filters | ✅ |
| Every bill from every branch and WhatsApp, with who made it and how | ✅ |
| HQ opens any bill and prints it | ✅ |

### Stock
| Feature | Status |
|---|---|
| Every item in every branch side by side; red out, amber low, grey not moving; problems listed first | ✅ |
| Days of stock left at the current rate of sale | ✅ |
| Transfer between branches, correct a count (with reason), record a supplier bill | ✅ |
| Everyone can see other branches' stock; only their own branch is changeable | ✅ |
| New item: name, unit, prices, GST rate, HSN, other names for voice/WhatsApp; stock then arrives through a purchase | ✅ |

### Udhaar (customers)
| Feature | Status |
|---|---|
| New customer: name and mobile at the counter; family/manager set the udhaar limit and GSTIN (state read from the GSTIN) | ✅ |
| Change a customer's udhaar limit (family or manager) | ✅ |
| Outstanding total with 0-30 / 31-60 / 60+ day split; payments applied to the oldest bills first | ✅ |
| Per customer: owed, oldest bill age, limit used, last payment | ✅ |
| Reminders with a UPI link for the exact amount; open in WhatsApp or auto-send | ✅ (auto-send ⚙️ WhatsApp API) |
| Udhaar is read straight from each customer's ledger in the books, so every kind of entry counts | ✅ |
| Old balance from a paper khata / Khatabook, with the date it was owed (ages correctly) | ✅ |
| Got money (cash or any bank), Gave money, Added a charge, Discount, Write-off (bad debt) | ✅ |
| Credit terms per customer: udhaar limit and "pay within N days"; overdue means past their own days | ✅ |
| Share khata: private link to the customer's statement with a Pay by UPI button; no app or login; can be revoked | ✅ |
| Automatic reminders every morning to customers past their credit days, repeating every N days | ✅ (sends itself ⚙️ WhatsApp API + daily job) |
| Suppliers khata: what we owe each supplier, Pay, Statement, old balance | ✅ |
| Import all customers with old balances from a Khatabook / Excel / Tally export | ✅ |
| Customer khata with running balance, the family's notes on each customer | ✅ |

### Books (Tally without the accountant)
| Feature | Status |
|---|---|
| Seven plain actions: Sold, Money came in, Bought stock, Paid a supplier, Paid an expense, Moved money, Owner money | ✅ |
| "Tell Pedhi" by voice or text fills the form; you check and save | ✅ |
| Every entry becomes a balanced Tally voucher (Sales, Purchase, Receipt, Payment, Contra) under Tally's own groups | ✅ |
| After saving, "the Tally way": Dr/Cr lines with group names | ✅ |
| GST worked out from the item and the party's state: CGST+SGST in Goa, IGST outside | ✅ |
| GST bills on expenses become input credit | ✅ |
| Any number of bank accounts, a cash box per branch, new suppliers with GSTIN check | ✅ |
| Day Book, Ledgers (by Tally group), ledger statements | ✅ |
| Trial Balance, Profit & Loss (with opening and closing stock), Balance Sheet (shows a tick when both sides match) | ✅ |
| GST: GSTR-3B summary, GSTR-1 B2B invoices, credit notes, B2C by rate, HSN summary (all net of returns); due dates | ✅ |
| Print and Excel (CSV) on every report | ✅ |
| CA pack: Tally XML (ledgers + vouchers), CSVs, read-only CA login | ✅ (Tally import not yet tried in real Tally) |
| CA sign-off locks the period; only the CA can reopen | ✅ |
| Goods returned by a customer: Credit Note from the bill (stock back, GST reversed, udhaar cut or refund) | ✅ |
| Goods sent back to a supplier: Debit Note (stock out, input GST reversed) | ✅ |
| Advanced entry (Tally Journal) with templates: equipment, loan received, loan EMI, depreciation; any ledger under any group | ✅ |
| Profit & Loss for one branch (common costs shown separately) | ✅ |
| Bank reconciliation: match entries to the bank statement; shows why bank and books differ | ✅ |
| Backup download and restore (owner) | ✅ |
| TDS, payroll, bank statement import, e-invoice and e-way bill generation, GST filing on the portal | 🧭 |

### Day close (everyone except the CA)
| Feature | Status |
|---|---|
| Cash that should be in each branch drawer, straight from the books | ✅ |
| Staff enter the counted cash; the difference shows live with a reason box | ✅ |
| A shortage or excess is booked to "Cash Shortage & Excess", so the books match the drawer | ✅ |
| One close per branch per day; last 7 days' history; repeated shortfalls reach the owner's Today screen | ✅ |

### Ask Pedhi
| Feature | Status |
|---|---|
| Questions in English, Hindi or Hinglish, typed or spoken | ✅ |
| Answers from 8 typed data tools (sales, trend, branches, top items, stock, udhaar, customer, issues); never invents a number | ✅ |
| "How this was calculated": the exact query and data behind the answer | ✅ |
| Staff never see cost or margin here either; branch staff only get their branch | ✅ |
| Any free-form question | ⚙️ AI key (without it, common questions are answered by rules) |

### WhatsApp
| Feature | Status |
|---|---|
| Working chat simulator for every person | ✅ |
| Sales, payments, questions, "undo", "brief" by message, in Hinglish | ✅ |
| Send the 7 am brief to any family member | ✅ |
| Only registered numbers can record anything; all business rules apply | ✅ |
| Real WhatsApp via Meta's Cloud API (same code) | ⚙️ needs Meta setup |
| Voice notes on WhatsApp | 🧭 |

### Import sheet
| Feature | Status |
|---|---|
| Upload CSV or paste cells from Excel / Google Sheets | ✅ |
| Messy headers mapped automatically ("Kharid Rate", "Closing Stk", "Particulars"); edit any mapping | ✅ (AI mapping ⚙️) |
| Preview with problems flagged; new items created, existing stock counts updated | ✅ |
| Direct .xlsx upload | 🧭 (save as CSV for now) |

### Help guide (button on every screen)
| Feature | Status |
|---|---|
| "How do I…" answered from 38 help articles, English or Hinglish, with a link to the right screen | ✅ |
| Retrieval over the guide (BM25 with Hinglish synonyms); AI wording when a key is set | ✅ (wording ⚙️) |

### Activity (family and CA)
| Feature | Status |
|---|---|
| Every bill, payment, purchase, expense, transfer, override, cancellation, reminder and sign-off, with who did it | ✅ |

---

## 5. Who sees what

| Person | Role | Sees and can do |
|---|---|---|
| Suresh Naik | Owner | Everything, every branch; approve over-limit udhaar; owner money; reset demo |
| Anita Naik | Family | Everything, every branch |
| Rohan Naik | Manager | Mapusa only, including margins; transfers, purchases, stock corrections |
| Raju, Santosh, Meena, Vishal | Counter staff | Billing, sales, stock, udhaar for their branch. Never cost prices, margins or profit |
| CA Prakash Kamat | Chartered accountant | Read-only books, reports, GST, exports; sign off and reopen periods |

---

## 6. How the AI is kept honest

- **The AI never calculates a number.** A metrics layer of typed queries produces every figure; the AI only chooses which one to run and words the answer.
- **The rule engine finds the problems.** Stock-outs, overdue udhaar, cash shortfalls and the rest are found by plain rules and sized in rupees; the AI only rewrites the brief, under instructions to copy every number exactly.
- **Every write goes through one module** with the business rules. The AI's tools are read-only.
- **No key, no problem.** Every AI feature has a rule-based path, so the demo can't fail on the network.

---

## 7. What was tested

**30 automated tests** (`npm test`), all passing:
1. Stock always equals the sum of its movements
2. The insight engine finds every planted story, ranked correctly, with no false alarms
3. Udhaar ageing applies payments to the oldest bills first
4. A bill moves stock, udhaar and revenue together, and undo reverses all three
5. Trust rules: branch walls, credit limits, stock limits, staff price edits ignored
6. The suggested transfer clears the stock-out
7. The message parser reads Hinglish sales and payments
8. A WhatsApp message becomes a bill, and UNDO takes it back
9. Ask answers match the metrics layer; staff never see margin
10. Every voucher balances; Trial Balance and Balance Sheet tie out; every bill has its voucher
11. A udhaar bill debits the customer and splits GST exactly
12. An out-of-state customer pays IGST
13. Purchase, supplier payment, expense with GST, contra and owner money post the right vouchers
14. CA sign-off locks the period; the CA cannot enter transactions
15. GST summary matches the books
16. "Tell Pedhi" turns sentences into the right Books action
17. The help guide finds the right article in English and Hinglish
18. New customers: staff add cash-only customers, the GSTIN sets the state (IGST works), duplicates are refused, only family/managers change limits
19. New items start at zero stock, become billable after a purchase, and can be billed by their other names
20. Day close books a shortage, keeps the Balance Sheet balanced, refuses a second close, and the shortage reaches the owner's alerts
21. The help guide covers the new screens (new customer, new item, cash short)
22. Udhaar from the books: old balance (ages from its date), money given, charge, discount, write-off; the Balance Sheet stays balanced
23. Statement links are private and stop working when renewed
24. Returns: credit note restores stock, cuts udhaar and GST (GSTR-1 still matches the books); debit note sends stock out
25. Advanced entries: new ledgers, debits must equal credits, cash/bank filed as Receipt or Payment, the CA can post adjustments
26. Branch P&L adds up to the whole business
27. Bank reconciliation explains the gap and closes it
28. Customer import with old balances from a Khatabook-style file
29. Automatic reminders go to overdue customers once per cycle
30. The help guide covers the khata and Tally features

**Also checked by hand in the browser:** adding a customer from the bill, Day close with a ₹500 shortage, the New item form; all 22 screens at phone width (none wider than the screen), desktop, dark mode, all roles; bill by voice-style sentence, invoice totals, WhatsApp billing, transfer fix, reminders, Ask with evidence, expense and purchase in Books, P&L, Balance Sheet, GST, CA sign-off, Tally XML well-formed (6,424 vouchers balanced), help guide, install manifest and icons, production build.

**Not verified yet:** importing the Tally files into a real TallyPrime; a CA's review of the GST and ledger rules; the real WhatsApp API (simulator only); the AI-key paths (written and wired, but no key was available here).

---

## 8. Where things are

| Path | What |
|---|---|
| `pedhi/` | The app (Next.js 16, TypeScript, Tailwind 4, SQLite/libSQL) |
| `pedhi/README.md` | Run instructions and the 9-step demo walkthrough |
| `pedhi/lib/` | The logic: `metrics`, `insights`, `brief`, `chat`, `ops` (bills, payments, stock), `books` (vouchers), `reports`, `help`, `seed` |
| `pedhi/tests/pedhi.test.mts` | The 30 tests |
| `IMPLEMENTATION_PLAN.md` | The original research and plan for PS 12 |
| `TALLY_RESEARCH_AND_ACCOUNTING_PLAN.md` | Tally research, the Books design, pricing and scale |
| `tally-test-pack/` (+ `.zip`) | Files and steps to test the Tally import |
