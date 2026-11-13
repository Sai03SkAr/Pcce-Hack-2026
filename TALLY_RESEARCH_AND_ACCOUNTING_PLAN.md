# Tally, made usable by the owner — research and plan for Pedhi Books

**Drafted 13 Nov 2026 · part of PS 12 (AI Family Business OS)**

> **The idea in one line:** the shopkeeper answers plain questions ("money came in", "bought stock", "paid rent"), and Pedhi writes the proper Tally-style books underneath: vouchers, ledgers under Tally's groups, GST, Trial Balance, P&L, Balance Sheet. The CA receives a ready file to review and sign, instead of rebuilding the books from WhatsApp photos.

We are **not replacing Tally or the CA.** We remove the middle layer, the part-time accountant who types the owner's paper into Tally, and we make the books right at the moment the sale or purchase happens.

---

## 1. How Tally works (what a user must know today)

### 1.1 The setup a user must get right before the first entry

| Step | What Tally asks | Knowledge needed |
|---|---|---|
| Create company (Alt+F3 / F3) | Name, state, financial year, books-from date | Basic |
| Enable features (F11) | GST, inventory, multiple godowns, bill-wise details | Medium. Wrong choices break reports later |
| GST details | GSTIN, registration type, state, periodicity | GST knowledge |
| Create ledgers | Each ledger must go under the right **group** | Accounting. This is where most beginners fail |
| GST ledgers | Separate Output/Input CGST, SGST, IGST (+ cess) under Duties & Taxes | GST + accounting |
| Stock groups, units, stock items | HSN code, GST rate per item or group (item overrides group, group overrides company) | GST + inventory |
| Opening balances | Debit/credit side for every ledger, opening stock | Accounting |

Tally ships **28 predefined groups: 15 primary and 13 sub-groups** ([Tally help](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/)). Customers go under *Sundry Debtors*, suppliers under *Sundry Creditors*, GST ledgers under *Duties & Taxes*, banks under *Bank Accounts*, cash under *Cash-in-Hand*. Choosing the wrong group is described as one of the most common beginner mistakes ([BPA Educators](https://bpaeducators.com/common-tally-mistakes-students/)).

### 1.2 Every day: vouchers

Every transaction is a **voucher** with debit and credit sides that must balance ([Techjockey](https://www.techjockey.com/blog/types-of-voucher-in-tally-erp-9), [Khatabook](https://khatabook.com/blog/accounting-vouchers-in-tally-erp-9)):

| Key | Voucher | Used for | The owner would say |
|---|---|---|---|
| F8 | Sales | Selling goods | "Sold 10 bags to Ramesh" |
| F9 | Purchase | Buying goods | "Bought 200 bags from the dealer" |
| F6 | Receipt | Money coming in | "Ramesh paid ₹20,000" |
| F5 | Payment | Money going out | "Paid rent", "Paid the dealer" |
| F4 | Contra | Cash ↔ bank, bank ↔ bank | "Deposited cash in HDFC" |
| F7 | Journal | Adjustments, non-cash | "Correct last month's entry" |
| Ctrl+F8 | Credit Note | Sales return | "Ramesh returned 2 bags" |
| Ctrl+F9 | Debit Note | Purchase return | "Sent 5 damaged bags back" |

To enter one sale correctly the user must know: which voucher type, which party ledger, which sales ledger (often one per GST rate), how GST splits into CGST+SGST (same state) or IGST (other state), and that the customer is debited and sales credited.

### 1.3 Outputs the CA and the GST portal need

Day Book, Ledgers, Trial Balance, Profit & Loss, Balance Sheet, Stock Summary, Outstanding receivables/payables, and GST returns (GSTR-1 outward supplies; GSTR-3B summary and tax payment).

GST facts that shape the design (all to be re-checked by the CA):
- Monthly filers: GSTR-1 by the 11th, GSTR-3B by the 20th. Businesses up to ₹5 crore can use QRMP and file quarterly ([GST due-date guides](https://filingbase.in/gstr-1-gstr-3b-due-date/), [QRMP](https://accountune.com/qrmp-scheme-gst)).
- Since the July 2025 period the GSTR-3B liability auto-filled from GSTR-1 cannot be edited; corrections go through GSTR-1A. Input credit claimed should match GSTR-2B. **So GSTR-1 must be right the first time — another reason to capture GST at the bill.**
- E-invoicing applies above ₹5 crore aggregate turnover ([Tally](https://tallysolutions.com/gst/e-invoicing-threshold/)); e-way bills above ₹50,000 consignment value for inter-state movement.
- Wrong HSN codes and wrong rates are among the most common GST mistakes ([Accountune](https://accountune.com/gst-mistakes-small-businesses/)); "incorrect accounting, not intent, is the most common cause" of notices ([Tally at Cloud](https://www.tallyatcloud.com/article/how-to-prevent-gst-notices-using-correct-accounting-in-tally-prime-a-complete-practical-guide-2026/1011/0/1)).

### 1.4 Why a 10th- or 12th-pass owner cannot run Tally alone

1. **The vocabulary is accounting, not business.** "Dr/Cr", "Sundry Debtors", "Duties & Taxes", "Contra". The owner thinks in "who owes me", "what I paid".
2. **Setup errors are silent and compound.** A ledger under the wrong group, or a missing GST ledger, produces wrong reports months later.
3. **Keyboard-first, desktop-first.** Built for a trained operator at a PC, not a shop counter or a phone.
4. **GST is entered by hand per voucher** unless items and ledgers are configured perfectly.
5. **Learning takes days.** Courses run 3 to 8 hours just for basics ([Udemy TallyPrime](https://www.udemy.com/course/tallyprime/)), and Tally's own guide is aimed at "staff with basic accounting knowledge".
6. **So the owner hires someone.** Small-business bookkeeping plus GST typically costs ₹3,000–8,000 a month ([Patron Accounting](https://www.patronaccounting.com/blog/ca-charges-for-monthly-accounting-india)); per-filing GST charges of ₹500–1,500 for a small proprietorship ([TaxAJ](https://www.taxaj.com/learn/gst-and-income-tax-compliance-cost-for-a-small-business-in-india-2026/)). These figures come from firms' own blogs: treat as rough.
7. **Then the accountant leaves**, and the knowledge goes with them. (We found no survey quantifying accountant churn in small firms; this is the user's own experience and should be validated with interviews, not stated as a statistic.)

Tally itself says owners can do day-to-day entries and GSTR-1/3B, but **a CA is still essential for annual filings, audits and complex decisions** ([Tally](https://tallysolutions.com/tally/use-tallyprime-without-accountant-india/)). That is exactly our split.

### 1.5 What it costs today

| Option | Cost (before GST) | Source |
|---|---|---|
| TallyPrime Silver (1 user) | ₹22,500 one-time, or ~₹750/month rental; TSS renewal ~₹4,500/yr | [InCorpX](https://www.incorpx.io/blog/tallyprime-price-2026-silver-gold-tss), [Tally Support](https://tallysupport.in/guides/tallyprime-price-list-2026.php) |
| TallyPrime Gold (multi-user) | ₹67,500 one-time, or ~₹2,250/month | same |
| Vyapar | ~₹3,399–4,000/year | [Petpooja](https://blog.petpooja.com/industry-business-guides/retail-billing-software-price-india/) |
| myBillBook | ~₹2,600–3,990/year (sources disagree) | [ScaleSaathi](https://scalesaathi.in/guides/billing-software-for-retail-shop/) |
| Zoho Books | ~₹749–899/month | [ToolsLake](https://toolslake.com/best-accounting-software) |
| Marg ERP | ₹5,550–26,000 one-time + yearly support | [Petpooja](https://blog.petpooja.com/industry-business-guides/retail-billing-software-price-india/) |
| Bookkeeper / accountant | ~₹3,000–8,000/month | [Patron Accounting](https://www.patronaccounting.com/blog/ca-charges-for-monthly-accounting-india) |

A typical 3-branch family business today pays for Tally (or a billing app) **and** an accountant **and** the CA. Prices from review sites conflict; check vendor pages before quoting on a slide.

---

## 2. The solution: Pedhi Books

### 2.1 Principles

1. **Ask business questions, never accounting questions.** Eight plain actions cover almost everything a trading business does.
2. **Every action writes a real voucher** with Tally's voucher type, Tally's groups and balanced debit/credit lines. Nothing is "approximately" accounting.
3. **GST is decided by the item and the party, not by the user.** Rate and HSN live on the item; CGST+SGST vs IGST comes from the party's state.
4. **Touch first, voice second, keyboard optional.** Big tiles, one question per step, Hindi/English.
5. **Show the Tally view on demand.** A "See it the Tally way" toggle under every entry shows the voucher with Dr/Cr. Owners learn; CAs trust.
6. **The CA signs, Pedhi doesn't pretend to.** A CA login reviews, comments and **locks** a period. Locked periods cannot be changed.
7. **Export to Tally, don't fight it.** Tally XML import file (masters + vouchers) so a CA who lives in Tally loses nothing.

### 2.2 The eight actions → Tally vouchers

| Owner's words (button) | Voucher | Debit | Credit |
|---|---|---|---|
| **Sold** (bill screen, WhatsApp, voice) | Sales | Customer *or* Cash / Bank | Sales @rate%, Output CGST, Output SGST (or Output IGST) |
| **Money came in** (customer paid) | Receipt | Cash / chosen bank | Customer |
| **Bought stock** | Purchase | Purchase @rate%, Input CGST, Input SGST (or IGST) | Supplier *or* Cash / Bank |
| **Paid a supplier** | Payment | Supplier | Cash / bank |
| **Paid an expense** (rent, salary, light bill, transport…) | Payment | Expense ledger (+ Input GST if a GST bill) | Cash / bank |
| **Moved money** (cash ↔ bank, bank ↔ bank) | Contra | Receiving account | Giving account |
| **Owner took / added money** | Payment / Receipt | Drawings *or* bank | Cash / bank *or* Capital |
| **Goods returned** | Credit Note / Debit Note | (reverse of sale / purchase) | |

Stock moves automatically: **Sold** reduces stock, **Bought stock** adds it to the chosen branch, transfers between branches move stock without an accounting entry (same GSTIN, same state).

### 2.3 Chart of accounts (created automatically, Tally group names kept)

| Ledger | Tally group |
|---|---|
| Capital – Suresh Naik, Drawings – Suresh Naik | Capital Account |
| Cash – Margao / Mapusa / Ponda | Cash-in-Hand |
| HDFC Bank – Current, SBI – Current (any number of banks) | Bank Accounts |
| One ledger per customer | Sundry Debtors |
| One ledger per supplier | Sundry Creditors |
| Sales @5% / 12% / 18% / 28% | Sales Accounts |
| Purchase @5% / 12% / 18% / 28% | Purchase Accounts |
| Output CGST / SGST / IGST, Input CGST / SGST / IGST | Duties & Taxes |
| Freight Inward | Direct Expenses |
| Rent, Salaries, Electricity, Transport, Telephone & Internet, Repairs, Office Expenses, Bank Charges | Indirect Expenses |
| Discount Received, Interest Received | Indirect Incomes |
| Closing stock | Stock-in-Hand (computed from inventory, as Tally does with integrated inventory) |

Multiple bank accounts and multiple cash boxes are first-class: every money action asks "from which account?" with the last-used one pre-selected.

### 2.4 Reports (same as Tally gives)

Day Book · Ledger statement (any ledger, running balance) · Cash & Bank book · Trial Balance · Profit & Loss (trading + P&L, with opening and closing stock) · Balance Sheet · Outstanding receivables and payables · Stock summary (existing Stock screen) · **GST**: GSTR-1 summary (B2B invoice-wise, B2C rate-wise, HSN summary) and GSTR-3B summary (outward tax, eligible ITC, net payable).

Every report: date range, branch filter where it makes sense, print, CSV download.

### 2.5 The CA loop ("take it to the CA and get it signed")

1. Owner (or staff) records everything during the month in plain language.
2. **CA pack** screen: one tap downloads the Tally XML (ledgers + vouchers for the period) and CSVs (Day Book, Trial Balance, P&L, Balance Sheet, GST summaries). Or the CA logs in directly with a read-only CA role.
3. CA reviews, then **signs off the period** in Pedhi (name, date, note). The period is locked: no voucher on or before that date can be added, changed or cancelled.
4. CA files GSTR-1/3B from the summaries (filing on the portal stays with the CA or owner; Pedhi does not file).

### 2.6 Voice and touch

- "Tell Pedhi" on the Books screen: *"HDFC se 4500 bijli ka bill bhara"*, *"Goa Cement Agencies se 200 bag ACC cement liya udhaar"*, *"50000 cash HDFC mein jama kiya"*, *"Suresh ne 10000 ghar ke liye liye"*.
- The sentence fills the form; **the user always sees and confirms before saving.** Same parser as WhatsApp; the AI parser takes over when a key is present.
- Every form: big tiles for the action, numeric keypad amount, account chips, a single Save button.

### 2.7 "Bill anywhere, print at HQ"

Already true and kept: a bill made at any branch, on WhatsApp or by voice is in the shared books instantly. HQ opens **Sales** (all branches), opens any invoice and prints it, or opens a customer's ledger and prints the statement.

---

## 3. Build plan (this session)

| # | Piece | Done when |
|---|---|---|
| 1 | `ledgers`, `vouchers`, `voucher_lines`, `suppliers`, `purchases`, `period_locks` tables; Tally groups; auto-created ledgers | Schema in place, chart of accounts seeded |
| 2 | Posting engine (`lib/books.ts`): one function per action, every voucher balanced, GST split per line, period-lock check | Unit tests: every voucher balances; TB debits = credits |
| 3 | Existing flows post vouchers: bill, WhatsApp sale, payment, undo (deletes the voucher) | A bill shows in the Day Book with correct Dr/Cr |
| 4 | Seed: 90 days of purchases from suppliers, supplier payments, expenses, cash deposits, opening capital | Balance Sheet balances to the rupee |
| 5 | Books home + 8 action forms + voice | Owner records each action without accounting words |
| 6 | Reports: Day Book, Ledger, Trial Balance, P&L, Balance Sheet, GST summary | Numbers tie out: P&L profit = Balance Sheet profit |
| 7 | CA pack: Tally XML, CSVs, CA role, sign-off + lock | Locked period refuses new entries |
| 8 | Help assistant (RAG over Pedhi's own help pages) | Answers "how do I record rent?" with steps and a link |

**Scope cut, said plainly:** no GST portal filing, no e-invoice/IRN generation, no e-way bill, no TDS, no payroll, no bank-statement import, no FIFO/weighted-average costing (stock is valued at the item's current cost). These are roadmap.

**Assumptions to confirm with a CA before real use:** item cost and selling price are both GST-inclusive; all branches are in Goa under one GSTIN, so branch transfers carry no GST; customers outside Goa get IGST; rounding is to the rupee per line.

---

## 4. Subscriptions and scale

### 4.1 Pricing (our hypothesis, to test with real owners)

| Plan | Price | For | Includes |
|---|---|---|---|
| **Dukaan** | Free | One shop starting out | 1 branch, 2 users, billing, udhaar, stock, simple books, 1 bank account |
| **Pedhi** | ₹499 / month (₹4,999/yr) | Most family businesses | Everything above + full books, GST summaries, Tally export, CA login, WhatsApp brief, voice, unlimited banks |
| **Extra branch** | + ₹299 / month each | Multi-branch | Branch dashboard, transfers, per-branch cash |
| **Pedhi AI** | + ₹299 / month | Owners who want answers | Free-form Ask, AI-written brief in Hindi, bill-photo entry, forecasts |
| **Setup** | ₹2,999 one-time | Anyone moving from Tally/Excel | Import of masters and opening balances, family training |

**Why an owner switches:** Tally Silver rental (~₹750/month) + a bookkeeper (~₹3,000–8,000/month) becomes Pedhi (₹499–1,097/month for 1–3 branches) + the CA's review (which they pay anyway). The saving is the bookkeeper, not the software.

### 4.2 CA partner channel

CAs get a free practice dashboard for all their Pedhi clients, the Tally export, and a referral share (e.g. 20% of the first year). In India most small businesses choose software on the CA's advice, so CAs are the distribution channel, not the competition.

### 4.3 Scaling the system

| Concern | Now (hackathon) | At scale |
|---|---|---|
| Database | One SQLite file | One libSQL/Turso database per business (isolation, cheap, backups per tenant), or Postgres with row-level security |
| App | Next.js on one machine | Stateless Next.js on Vercel / any Node host; horizontal |
| WhatsApp | Simulator + Cloud API test number | Business Solution Provider, approved templates for the 7 am brief |
| AI cost | Optional key | Small model for parsing, large model only for the brief and free questions; brief generated once per user per day and cached |
| Offline | Needs internet | PWA with a local queue for bills; sync when online |
| Trust | Audit log, roles, period lock | Daily encrypted backups, export anytime, data stays in India region |
