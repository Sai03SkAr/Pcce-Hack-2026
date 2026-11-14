# Pedhi — the AI munim for family businesses

PS 12 · AI Family Business Operating System

Family businesses run on WhatsApp groups, Excel sheets and the owner's memory. Pedhi sits on top of what they already use: staff bill at the counter or by WhatsApp message, and every morning the owner gets one message that says what happened, what is wrong, and what to do about it, across every branch.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 (or double-click `../Start Pedhi.command` on a Mac, which uses port 3100) and pick a person (the owner, family, a branch manager, counter staff, or the CA), then enter their password: first name + `123`, e.g. `suresh123` (all listed in `../PEDHI_GUIDE.md`). The database (`pedhi.db`) is created and filled with 90 days of history for **Naik Traders** (three branches in Goa) on the first request. No accounts or keys are needed.

```bash
npm test        # 35 tests: planted stories, ledger rules, permissions, parsers, WhatsApp, ask, double-entry books, GST, CA lock, help guide
npm run seed    # reset the demo data (also: "Reset demo data" in the sidebar when signed in as the owner)
```

### Optional keys (`.env.local`)

| Variable | What it turns on |
|---|---|
| `GROQ_API_KEY` | Free alternative: the same AI features on Groq (`openai/gpt-oss-120b` and `-20b`, override with `GROQ_MODEL`, `GROQ_FAST_MODEL`). Used when no Anthropic key is set. |
| `ANTHROPIC_API_KEY` | AI-written brief, free-form "Ask Pedhi", AI message parsing and AI column mapping. Without it every feature runs on the rule engine. |
| `PEDHI_MODEL`, `PEDHI_FAST_MODEL` | Override the models (defaults `claude-opus-5-5` and `claude-haiku-5-5`). |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Real WhatsApp via Meta's Cloud API. Point the webhook at `/api/whatsapp`; the app secret turns on Meta's signature check. The owner sets each person's number on the WhatsApp screen. |
| `CRON_SECRET`, `PUBLIC_URL` | The daily reminder job (`/api/cron/reminders`) and the base address used in statement links. |

All variables are listed in `.env.example`.
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Use a hosted libSQL / Turso database instead of the local file (needed to deploy on Vercel). |

New business? **Set up your business** on the first screen: pick the kind of business (hardware, kirana, pharmacy, clothing, electronics, wholesale), add branches and the owner’s login, and start with a matching item list. Each business is fully separate.

## What is in it

| Screen | What it does |
|---|---|
| **Today** | The morning brief (as the owner sees it on WhatsApp), KPIs, issues ranked by rupees at stake with one-tap fixes, 30-day sales by branch, top sellers, branch cards |
| **New bill** | Counter billing: search, tap, or say the whole bill ("Ramesh ko 10 bori ACC cement udhaar"); cash / UPI / udhaar; stock and credit-limit checks; GST invoice |
| **Stock** | Every item across every branch side by side, coloured by status (out, low, not moving); stock received, transfers between branches, corrections |
| **Stock plan** | Order now (grouped by supplier, with a ready WhatsApp order and one tap to record the bill), stock expiring in 30 days, and per-item demand and profit: Stars, Crowd-pullers, Push it, Not moving |
| **Day close** | Staff count the drawer at day end; Pedhi compares with the books, books any shortage, and flags repeats to the owner |
| **Khata extras** | Old balances, got/gave/discount/write-off entries, credit days, a private statement link with UPI pay, automatic reminders, suppliers khata, customer import |
| **Returns & advanced** | Credit and debit notes, Tally-style journal with templates, branch P&L, bank reconciliation, backup and restore |
| **Udhaar** | Outstanding per customer with ageing buckets; reminders with a UPI link for the exact amount; customer ledger; payments; the family's notes on each customer |
| **Ask Pedhi** | Questions in English, Hindi or Hinglish, typed or spoken. Every answer shows the queries behind it |
| **WhatsApp** | A working chat: sales, payments, stock arrived, questions, `undo`, `brief`. Pedhi shows what it understood and saves only on YES; a new item is added only after the sender approves it with its prices. Same handler as the real webhook |
| **Import sheet** | Upload or paste a messy stock sheet; columns are mapped automatically, you check, it loads |
| **Books** | Tally-style accounts without accounting words: Money came in, Bought stock, Paid a supplier, Paid an expense, Moved money, Owner money, or just say it ("HDFC se 4500 bijli ka bill bhara"). Every entry becomes a balanced voucher under Tally's groups |
| **Day Book, Ledgers, P&L, Balance Sheet, Trial Balance** | The same reports Tally gives, printable and downloadable as CSV |
| **GST** | GSTR-3B summary (tax on sales, input credit, cash to pay) and GSTR-1 (B2B invoices, B2C by rate, HSN summary) for any month |
| **CA pack** | Tally XML (ledgers + vouchers) for TallyPrime import, CSVs, a read-only CA login, and CA sign-off that locks the period |
| **Help** (button on every screen) | A guide that answers "how do I…" in English or Hinglish from Pedhi's own help articles (retrieval over the guide; AI-worded when a key is set) |
| **Activity** | Every bill, payment, override, transfer, purchase, expense, sign-off and cancellation, with who did it |

### Who sees what

| Person | Role | Sees |
|---|---|---|
| Suresh Naik | Owner | Everything, every branch |
| Anita Naik | Family | Everything, every branch |
| Rohan Naik | Manager | Mapusa only, including margins |
| Raju Gawde, Santosh Parab, Meena Kerkar, Vishal Salgaonkar | Counter staff | Their branch only. No cost prices, margins or profit, in any screen or in the assistant |
| CA Prakash Kamat | Chartered accountant | Read-only books, GST, exports; can sign off and lock a period |

## How the AI is kept honest

The model never calculates a number.

- **Metrics layer** (`lib/metrics.ts`): every figure on every screen and in every answer comes from these typed queries.
- **Insight engine** (`lib/insights.ts`): plain rules find stock-outs, sales drops and their cause, overdue udhaar, dead stock, below-cost billing, cash shortfalls and customers who went quiet, and size each in rupees.
- **Brief** (`lib/brief.ts`): built from those facts. With a key, the model only rewrites the wording, under instructions to copy every number exactly.
- **Ask** (`lib/chat.ts`): the model picks which metric to run; our code runs it, enforces the user's branch and hides money fields from staff before the model ever sees the result.
- **Writes** (`lib/ops.ts`, `lib/books.ts`): bills, payments, purchases and transfers go through one place with the business rules (stock, credit limits, branch walls, price edits). Chat tools are read-only. A WhatsApp message is only a proposal until the sender replies YES.
- **Stock plan** (`lib/stockplan.ts`): reorder sizes, what is on the shelf from which delivery (oldest sells first) and its use-by date, and per-item demand and profit, all by rule.

## The demo story (planted in the seed)

1. Mapusa sales are down ~30% over 4 days because its best-selling cement ran out; Ponda has 46 days of the same cement → **Transfer**.
2. Three contractors owe ₹1.76 lakh, 46–49 days old; one is over his limit → **Send reminders** with UPI links.
3. ₹62k of premium paint has not sold in 80 days.
4. Cash was short at Ponda on three Tuesdays, same person closing.
5. One counter keeps billing a TMT rod below cost.
6. A regular contractor has not ordered in 25 days.
7. Good news: Margao's best day in three months (Dhanteras).
8. Two deliveries came in old: white cement at Ponda expires in 6 days, wall putty at Mapusa in 19.

### Four-minute walkthrough

1. Sign in as **Suresh (Owner)** with his password. Read the brief; switch to हिं.
2. Tap **Transfer from Ponda** on the Mapusa issue.
3. Open **WhatsApp**, chat as **Raju**: `Dhavalikar ko 10 bori ACC cement udhaar`. Pedhi shows the bill; reply `haan`. Show the bill in **Sales** and the updated udhaar.
   Then chat as **Rohan**: `20 bag Dalmia cement aaya exp 02/2027` → Pedhi asks to add the new item → `YES 395 355` → `yes`. Keep **Stock plan** open in a second window: it updates by itself.
4. **Udhaar** → **Remind all overdue** → the message with its UPI link.
5. **Ask Pedhi**: "Is hafte kaunsi branch ka margin sabse kam hai?" → open "How this was calculated".
6. Sign in as **Raju**: billing only, no cost prices, and a credit sale over the limit is blocked.
7. **Books** → tap the example "Goa Cement se 200 bag ACC cement liya udhaar" → Save → show the Tally voucher. Then **P&L · Balance Sheet** (both sides match) and **GST**.
8. Sign in as **CA Prakash Kamat** → **CA pack** → download the Tally XML → **Sign off and lock**.
9. **Import sheet** → **Try a messy sample**.
10. **Stock → Stock plan**: what to order (send it to the supplier on WhatsApp), the white cement expiring in 6 days, and which items are Stars.

The full research behind Books (how Tally works, why owners need an accountant, pricing) is in `../TALLY_RESEARCH_AND_ACCOUNTING_PLAN.md`.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 · libSQL/SQLite · Recharts · Anthropic SDK · Meta WhatsApp Cloud API · browser speech recognition. No web fonts or CDNs: the app runs fully offline once installed.
