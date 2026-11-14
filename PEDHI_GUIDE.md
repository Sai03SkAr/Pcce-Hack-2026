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
**Shortcut on a Mac:** double-click `Start Pedhi.command` in the `PCCE Hackathon` folder. It installs on first run, starts Pedhi on port 3100 and opens the browser. The manual steps are below.

1. Install **Node.js 20 or newer** from https://nodejs.org (the LTS button). Check it in a terminal:
   ```bash
   node -v
   ```
   It should print v20 or higher.
2. Get the code onto the demo laptop: either copy the `PCCE Hackathon` folder, or clone your repo https://github.com/Sai03SkAr/Pcce-Hack-2026 (private; sign in to GitHub on that laptop).
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
5. Open **http://localhost:3000** in Chrome. Tap **Suresh Naik (Owner)** and enter his password (see *Sign-in passwords* below). You should see "Good morning/afternoon, Suresh ji" with the brief.
   - If it says port 3000 is busy (it is on your Mac), use `npm run dev -- -p 3100` and open http://localhost:3100.
6. Check it worked:
   ```bash
   npm test
   ```
   It should end with `pass 35` and `fail 0`.

### Any business can set itself up (not just the demo)
On the first screen, **New here? Set up your business** opens a 4-step wizard:
1. **What kind of business is this?** Hardware, kirana, pharmacy, clothing, electronics, wholesale, or something else.
2. **About you:** business name, owner’s name, owner’s mobile and password, state (decides CGST/SGST vs IGST), and optional GSTIN and UPI ID.
3. **Branches:** one shop or many, each with its own stock, cash box and bill numbers.
4. **Items:** load a starter list for that kind of business (usual prices and GST rates, all editable; a CA should confirm the rates) or start empty and import an Excel sheet.

Pedhi then creates a separate business with its own books (Tally’s chart of accounts, a cash box per branch). Nothing is shared with Naik Traders or anyone else. The owner lands on a **Set up your pedhi** checklist: add items, enter today’s stock, add family and staff, add customers and old udhaar, add the bank account, make the first bill.

- **People** (owner and family): **Add a person** with a role (staff, manager, family, CA), their branch, mobile and first password.
- **Sign in:** real businesses sign in with **mobile number and password**. The demo people list on the first screen is only for Naik Traders.
- **Reset demo data** shows only to the demo owner, asks twice, and says plainly that it also removes businesses set up on the same server. Use a separate server or database for real businesses.

### Sign-in passwords (demo)
After you tap a person on the first screen, Pedhi asks for that person's password. The demo passwords are each person's first name in small letters plus `123`:

| Person | Role | Password |
|---|---|---|
| Suresh Naik | Owner | `suresh123` |
| Anita Naik | Family | `anita123` |
| Rohan Naik | Manager, Mapusa | `rohan123` |
| Raju Gawde | Staff, Ponda | `raju123` |
| Santosh Parab | Staff, Ponda | `santosh123` |
| Meena Kerkar | Staff, Margao | `meena123` |
| Vishal Salgaonkar | Staff, Mapusa | `vishal123` |
| CA Prakash Kamat | CA | `prakash123` |

- Change any password under **People** (owner and family can change anyone's; others can change only their own).
- **Reset demo data** puts these passwords back.
- Five wrong tries lock that person for a minute.
- Passwords are stored scrambled (hashed), and the sign-in cookie is signed, so nobody can edit it to become someone else.
- These are demo passwords. Change them before any real business uses Pedhi.

### Step 2. Add the AI key (5 minutes, recommended)
Without a key everything works on the rule engine. With it, the brief reads naturally in Hindi, Ask Pedhi answers any question, and voice/WhatsApp understand looser sentences.
1. Get an API key from https://console.anthropic.com (Settings → API keys). Add a small amount of credit.
2. Open the file `pedhi/.env.local` (already created on this Mac, with the secret words filled in; on another laptop copy `pedhi/.env.example` to `.env.local`). Paste your key after the `=` on this line:
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

### Step 6. Real WhatsApp on +91 93221 06240 (for the judges)
Pedhi already knows this number: it belongs to **Suresh Naik (owner)** in the demo data, so messages from that phone are read as the owner's. Meta gives a free **test business number**. Your phone (+91 93221 06240) chats with that test number, and Pedhi answers through it.

**A. Create the WhatsApp app on Meta (15 minutes, only you can do this: it needs your Facebook login)**
1. Go to https://developers.facebook.com → **My Apps** → **Create app**. Choose **Other** → **Business**, give it any name (e.g. "Pedhi Demo"), and create it.
2. On the app's page, find **WhatsApp** and press **Set up**. Pick or create a business portfolio when it asks.
3. Open **WhatsApp → API Setup**. You will see a **test number** (it starts with +1 555...) and a **Phone number ID** under it. Copy the Phone number ID.
4. On the same page press **Generate access token** and copy it. (This token works for 24 hours. For a token that does not expire, see D below.)
5. Still on API Setup, under **To**, press **Manage phone number list** → add **+91 93221 06240**. Meta sends a code to that phone on WhatsApp. Type the code to verify it.
6. Go to **App settings → Basic**, press **Show** next to **App secret**, and copy it.

**B. Put the four values into Pedhi (2 minutes)**
Open `pedhi/.env.local` in any text editor. Fill these lines after the `=` with no spaces or quotes. `WHATSAPP_VERIFY_TOKEN` is already filled in; leave it.
```bash
WHATSAPP_TOKEN=the access token from A4
WHATSAPP_PHONE_NUMBER_ID=the Phone number ID from A3
WHATSAPP_APP_SECRET=the app secret from A6
```
Save, then restart Pedhi. Stop it with Ctrl+C and start it again, or double-click `Start Pedhi.command`, or ask me to restart it. The People screen then says "Real WhatsApp is connected".

**Shortcut:** sign in as Suresh on your phone link and open **People**. The **Connect real WhatsApp** card ticks off each value as it is set, and shows the exact Callback URL and Verify token with Copy buttons.

**C. Point Meta at Pedhi (3 minutes)**
1. Pedhi must be reachable on https. Keep the tunnel running (Step 3) and note its link, e.g. `https://something.trycloudflare.com`.
2. In Meta: **WhatsApp → Configuration → Webhook → Edit**.
   - Callback URL: `https://something.trycloudflare.com/api/whatsapp`
   - Verify token: copy the `WHATSAPP_VERIFY_TOKEN` value from `pedhi/.env.local`
   - Press **Verify and save**. If it fails, Pedhi or the tunnel is not running.
3. Under **Webhook fields** press **Manage** and **Subscribe** to **messages**.

**D. Try it from your phone**
1. Save the Meta test number in your phone's contacts as "Pedhi". Open WhatsApp and send **hi**. Pedhi replies with what it can do.
2. Then try:
   - `brief` (today's brief)
   - `Kya expire hone wala hai?`
   - `Margao: Dhavalikar ko 10 bori ACC cement udhaar`, then reply `haan` to save it. The owner works for every branch, so include the branch name.
   - `20 bag Dalmia cement aaya Mapusa exp 02/2027` (new item), then `YES 395 355`, then `yes`.
3. Every saved message shows up at once on the laptop and phones (green "Live" dot).

**Things to know**
- The quick tunnel link changes whenever the tunnel restarts, and Cloudflare can drop it after some hours. Each time it changes, paste the new link into the Meta webhook (C2). For a link that never changes, deploy (Step 7) or create a named Cloudflare tunnel.
- **Morning brief:** every day at **7:00 am India time**, Pedhi sends the brief by itself to the owner and family members who have a WhatsApp number. Your number is on Suresh, so it comes to you. It is sent by the running server (or by Vercel Cron once deployed), so the laptop must be on and Pedhi running at 7 am. Send **brief** any time to get it on demand.
- **WhatsApp's 24-hour rule:** a business can send free-form messages only within 24 hours of the person's last message. With Meta's test number, the 7 am brief only reaches you if you messaged Pedhi in the previous 24 hours, so send "hi" the evening before. A registered business number with an approved "daily brief" message template removes this limit; Meta reviews templates in about a day.
- The access token from A4 expires in 24 hours. For a permanent one: business.facebook.com → **Settings → Users → System users** → add an Admin system user → **Generate token** for your app with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions. Paste it as `WHATSAPP_TOKEN`.
- To put the number on someone else (e.g. Raju, to show staff billing): sign in as the owner → **People** → move **+91 93221 06240** to that person. Remove it from Suresh first, since one number can belong to one person only.
- Without these steps, the **WhatsApp** screen in the app is a full simulator of the same flow, and nothing breaks.

### Step 7 (optional). A permanent public link (Vercel + Turso, free tiers)
1. The code is already on GitHub: https://github.com/Sai03SkAr/Pcce-Hack-2026. In Vercel set the **Root Directory** to `pedhi`.
2. Create a free database at https://turso.tech, and copy its URL and token.
3. Import the repo at https://vercel.com, and set environment variables `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (and `ANTHROPIC_API_KEY` if you have one).
4. Deploy. The first visit fills the database with the demo story. Install the app on phones from this link; it never changes.

### Step 7b (optional). Automatic reminders that send themselves
Once deployed on Vercel (Step 7) with real WhatsApp (Step 6): add an environment variable `CRON_SECRET` (copy the value already generated in `pedhi/.env.local`). `vercel.json` already runs the reminder job every morning at 10:00 IST. Then the owner switches on **Udhaar → Automatic reminders**. Until then, **Send today's now** prepares the messages for you to send.

### Step 8 (before any real business uses it, not for the hackathon)
- A CA reviews the ledger and GST rules (ask them to check `TALLY_RESEARCH_AND_ACCOUNTING_PLAN.md` section 3).
- Take a backup every week: **Books → CA pack → Download backup**.
- Change every demo password (People screen), consider OTP login, set `WHATSAPP_APP_SECRET` (the signature check refuses unsigned messages in production), and set up daily database backups.

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
| Typing an item that isn't in the list while recording a purchase offers **Add as new item**, then it comes in on the same bill | ✅ |
| **Use-before date** on each purchase line (cement, paint, putty, adhesive); also "exp 03/2027" on WhatsApp | ✅ |
| **Stock plan**: Order now (what runs out before delivery, how much to order, grouped by supplier, ready WhatsApp order message, one tap to record the bill when it arrives) | ✅ |
| **Expiring in 30 days** (what is still on the shelf, oldest sells first); alerts on Today, a line in every morning brief, red 7 days before | ✅ |
| **What sells, what earns**: per item sales, profit, margin, demand rising or falling, days of stock; Stars, Crowd-pullers, Push it, Not moving | ✅ |
| **Live**: every open screen refreshes itself when anyone at any branch saves a bill, payment or delivery (green Live dot) | ✅ |

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
| Answers from 11 typed data tools (sales, trend, branches, top items, stock, udhaar, customer, issues, expiring stock, what to order, item demand and profit); never invents a number | ✅ |
| "Kya expire hone wala hai?", "What should I order?", "Which items have rising demand?" | ✅ |
| "How this was calculated": the exact query and data behind the answer | ✅ |
| Staff never see cost or margin here either; branch staff only get their branch | ✅ |
| Any free-form question | ⚙️ AI key (without it, common questions are answered by rules) |

### WhatsApp
| Feature | Status |
|---|---|
| Working chat simulator for every person | ✅ |
| Sales, payments, questions, "undo", "brief" by message, in Hinglish | ✅ |
| **Approval first**: Pedhi replies with what it understood; nothing is saved until the sender replies YES (NO cancels, stale after 30 minutes) | ✅ |
| **Stock arrived**: "50 bori ACC cement aaya exp 03/2027" becomes a proper supplier bill (stock, GST credit, supplier owed) after YES | ✅ |
| **New item?** Pedhi asks before adding it ("YES 395 355" = selling and buying price), copying GST and unit from a similar item; staff cannot add items | ✅ |
| Credit limit checked before asking for YES | ✅ |
| The family sets each person's WhatsApp number on the WhatsApp screen | ✅ |
| Meta signature check (`WHATSAPP_APP_SECRET`) on the real webhook | ✅ |
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

**32 automated tests** (`npm test`), all passing:
1. Stock always equals the sum of its movements
2. The insight engine finds every planted story, ranked correctly, with no false alarms
3. Udhaar ageing applies payments to the oldest bills first
4. A bill moves stock, udhaar and revenue together, and undo reverses all three
5. Trust rules: branch walls, credit limits, stock limits, staff price edits ignored
6. The suggested transfer clears the stock-out
7. The message parser reads Hinglish sales and payments
8. A WhatsApp message is shown back first, saved only on YES (NO saves nothing), and UNDO takes it back
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
31. New goods on WhatsApp: Pedhi asks before adding the item, copies GST and unit from a similar item, books a balanced purchase voucher with the expiry date; staff are told to ask a manager
32. Stock plan: expiry dates parse, the planted expiring lot reaches the insights and the brief, reorder lines are positive and grouped by supplier, every rupee of 30-day sales lands on one item, Ask answers expiry and ordering, staff never see profit per item

**Also checked by hand in the browser:** adding a customer from the bill, Day close with a ₹500 shortage, the New item form; all 22 screens at phone width (none wider than the screen), desktop, dark mode, all roles; bill by voice-style sentence, invoice totals, WhatsApp billing, transfer fix, reminders, Ask with evidence, expense and purchase in Books, P&L, Balance Sheet, GST, CA sign-off, Tally XML well-formed (6,424 vouchers balanced), help guide, install manifest and icons, production build.

**Also checked in the browser (14 Nov):** Stock plan at desktop and phone width; adding a new item from the purchase form on a phone; the WhatsApp new-item and stock-in flow end to end; a second open tab updating by itself after a WhatsApp sale (Live).

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
