# PS 12 — AI Family Business Operating System

**Implementation plan · drafted 13 Nov 2026 · status: plan only, nothing built yet**

Working name: **Pedhi** (पेढी — the old word for a family trading firm and its counting house). Alternates: *Galla*, *MunimAI*. Check the name is free before it goes on a slide.

> **Confirmed:** 24-hour hackathon.
> **Still assumed** (tell me and I will adjust): team of 3–4 · internet at the venue · a working demo plus a pitch is judged · AI coding tools are allowed.

---

## 1. The idea in one paragraph

Every billing app asks the family to change how it works. Pedhi does the opposite: the family keeps using WhatsApp and Excel, and Pedhi sits on top as an **AI munim** — it turns their messages and sheets into clean sales, stock and udhaar records, and every morning it tells the owner, in their own language, **what happened, what is wrong, and what to do about it**, across all branches. Staff type or speak; the owner reads one message; the next generation gets the dashboard.

**One-line pitch:** *"Your business already runs on WhatsApp. Now it answers back."*

---

## 2. What the research says (and what it means for us)

| Finding | Source | What we do with it |
|---|---|---|
| The micro/small majority runs on free tools, WhatsApp, spreadsheets, or nothing. Tally dominates the rest. | Turia accounting-industry report 2026 | Do not sell "replace your tools". Ingest WhatsApp and Excel as they are. |
| Top barriers to software adoption are cost and lack of tech skills. | Zoho survey of 5,149 MSMEs, 2024 | Zero-training interface (chat + voice), low entry price. |
| 71% of surveyed retailers already use some AI tool, but 26% do not know which AI feature would help them. 82% feel more confident with digital tools. | PayNearby MSME Digital Index 2026 (10,000 retailers; network sample, not random) | Appetite exists, clarity does not. Our AI must do one obvious job: the daily brief with actions. |
| UPI and Aadhaar banking are 61% of transactions at these stores. | Same report | Payment mode split (cash / UPI / credit) is a first-class field. Reminders carry a UPI link. |
| Incumbent AI is document-focused. Tally's TallyIra (v7.1, June 2026) scans documents into draft entries; its WhatsApp feature only *sends* documents; natural-language querying is still in development. | Tally release notes, trade press, July 2026 trader-software guide | The open gap is **proactive, cross-branch intelligence in conversation**. That is our whole product. |
| Khatabook = udhaar ledger; Vyapar = offline billing + reminders; myBillBook = WhatsApp-style billing for distributors, no API; Tally = accountant's desktop tool. | Review aggregators, mid-2026 (uneven quality — verify before quoting) | None gives a family owner one consolidated multi-branch view with advice. Position above them, not against them. |
| Only 21% of Indian family businesses have a documented succession plan; 71% of their leaders call digital a key challenge; about 30% survive to the second generation. | PwC India Family Business Survey 2019 (106 leaders); print-industry column for the survival figure | The "family" angle is real: knowledge lives in one person's head. Serve two generations with two interfaces. |
| Distributors have seen stock days and credit days stretch sharply in slowdowns (stock 10–12 days → 20–40; credit 7–15 → 25–30). | BloombergQuint distributor survey (older, one downturn) | Working capital is the pain: dead stock and overdue udhaar are the two insights that matter most. |
| Letting an LLM write raw SQL gives plausible wrong numbers; having it pick from governed metrics while code builds the query pushes accuracy toward 100% on covered questions. | dbt Labs benchmark, April 2026 (vendor source, open benchmark) | **The LLM never computes a number.** See section 6. |
| Meta's Cloud API gives a free test number with about 5 allow-listed recipients, no business verification. India utility messages cost about ₹0.115 each. General-purpose AI chatbots are banned on the Business API since 15 Jan 2026; business-specific bots are allowed. | Meta docs summaries, pricing guides, press | WhatsApp demo is feasible and cheap. Keep the bot strictly scoped to the business's own data. |
| Sarvam's speech-to-text handles Hinglish and other code-mixed speech, about ₹1.5/min, free credits on signup, REST limit 30 s per clip. | Sarvam docs | Voice notes are a realistic stretch feature. |

**Gaps in the research, stated plainly:** no reliable figure for the share of shops using spreadsheets/WhatsApp for records; no recent survey of small-distributor receivable days or dead-stock share; competitor pricing sources contradict each other. Do not put invented numbers on slides.

---

## 3. Who it is for

A fictional but realistic customer drives the whole demo:

**Naik Traders, Goa** — hardware and building materials, wholesale + retail, three branches (Margao HQ, Mapusa, Ponda), about 60 SKUs, many contractor customers on credit.

| Person | Role | How they use Pedhi |
|---|---|---|
| Suresh Naik, 58 | Owner (father) | WhatsApp only. Reads the morning brief, replies by voice or text in Hindi/Konkani-English mix. |
| Anita Naik, 27 | Daughter, finance | Dashboard, insights inbox, receivables, "ask" chat. |
| Rohan Naik, 31 | Son, runs Mapusa | His branch's dashboard and stock; sees transfers suggested to him. |
| Raju | Counter staff, Ponda | Quick-bill screen or a WhatsApp message. Cannot see cost price or profit. |

### What makes it a *family* business OS, not a generic ERP

1. **Two generations, two interfaces.** Chat and voice for the senior, dashboard for the junior, same data.
2. **Family visibility tiers.** Owner and family see margins and profit. Branch managers see their branch. Staff see no cost prices.
3. **Trust without confrontation.** Audit trail on every edit, approval when credit exceeds a customer's limit, cash-closing variance flagged quietly to the owner.
4. **Institutional memory.** Notes the owner knows by heart ("Ramesh pays after the monsoon contract closes") live on the customer record and the AI uses them. That is succession readiness.

---

## 4. Scope

The PS names the MVP: **sales, inventory, customer management, daily AI business reports.** Those four are non-negotiable and come first.

### P0 — must ship (the PS MVP and the spine)

| # | Feature | Done when |
|---|---|---|
| 1 | Organisation → branches → users with roles; persona login screen | Tapping "Suresh (Owner)" vs "Raju (Staff)" visibly changes what the app shows |
| 2 | Items and per-branch stock, stock movements, low-stock list | A sale reduces stock in the right branch; every change has a movement row |
| 3 | Quick bill (search item, qty, customer, cash / UPI / credit), invoice view with GST split | A bill takes under 20 seconds; invoice can be printed or shared |
| 4 | Customers, udhaar ledger, record payment, aging buckets | Credit sale raises the balance; payment lowers it; aging is correct |
| 5 | Owner dashboard, all branches or one | Sales, gross margin, payment split, receivables, stock value, top items, branch comparison |
| 6 | Insight engine (rules, no LLM) | Finds every planted story in the seed data (section 8) |
| 7 | Daily AI brief, in-app | Headline numbers + 3 problems with actions + 1 good news, in English and Hindi |
| 8 | "Ask your business" chat | Answers the 15 test questions with correct numbers (section 10) |
| 9 | Seed data generator | 90 days, 3 branches, planted stories, one command to reset |

### P1 — should ship (the differentiators that win)

| # | Feature | Note |
|---|---|---|
| 10 | WhatsApp: brief delivered + staff message → recorded sale/payment with confirmation | Built against an in-app simulator first, real Cloud API second |
| 11 | Smart Excel/CSV import | AI maps messy column names to our schema; user confirms the mapping |
| 12 | One-tap actions | Payment reminder with UPI link, reorder draft, branch-to-branch transfer |
| 13 | Per-user language | English, Hindi, Hinglish |
| 14 | Audit log + credit-limit approval | The trust layer |

### P2 — stretch (pick **one** after P1 is solid)

Voice notes (Sarvam) · purchase-bill photo → stock entry (vision model) · cash closing and variance detection · simple demand forecast · customer win-back messages · installable PWA · Konkani/Marathi.

### Not building (say so if a judge asks; all are roadmap)

GST return filing and e-invoicing · full double-entry accounting · payroll · offline mode · Tally sync · payment processing.

---

## 5. Architecture

```
  WhatsApp (Meta Cloud API)      Web app (mobile-first)        Excel / CSV
        │  text, voice              │ POS, dashboard, chat          │
        ▼                           ▼                               ▼
  ┌──────────────────────── Next.js app (one deployable) ────────────────────────┐
  │  Ingestion          Core modules            Intelligence                     │
  │  parse message →    sales · inventory ·     metrics layer (typed queries)    │
  │  draft → confirm    customers · payments    insight engine (rules)           │
  │                                              brief writer + ask chat (LLM)    │
  └───────────────────────────────┬───────────────────────────────────────────────┘
                                  ▼
                 Postgres — every row carries org_id and branch_id
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | One repo, one deploy, API routes and UI together |
| UI | Tailwind + shadcn/ui + Recharts | Fast to build, looks clean, good on phones |
| Database | Postgres (Neon free tier) + Drizzle ORM | Window functions for analytics; typed queries |
| LLM | Claude API — `claude-sonnet-5-5` for brief and chat, `claude-haiku-5-5` for message parsing | Reliable tool use and structured output; cheap model on the high-volume path |
| LLM fallback | One thin `llm.ts` wrapper so a free-tier provider can be swapped in | Free-tier limits change often and sources disagree — check on the day |
| Voice (web) | Browser Web Speech API (`hi-IN`, `en-IN`) | Free, no key |
| Voice (WhatsApp) | Sarvam Saaras speech-to-text | Hinglish support, rupee pricing, free credits |
| WhatsApp | Meta Cloud API test number | Free, no business verification, ~5 allow-listed phones |
| Hosting | Vercel + Neon | Public URL for the webhook and for judges |
| Auth | Seeded users, signed cookie, persona picker | Real OTP login is roadmap; the picker is better for a demo |

Node 22, Python 3.14 and git are already on this machine.

### Data model

`orgs` · `branches` · `users` (role, branch_id, phone, language) · `items` (name, aliases, unit, hsn, gst_rate, cost_price, sale_price, reorder_level) · `stock` (item, branch, qty) · `stock_movements` (type: purchase / sale / transfer / adjust) · `customers` (name, aliases, phone, credit_limit, notes) · `sales` (branch, customer, user, totals, tax, payment_mode, paid_amount, **source**: pos / whatsapp / voice / import) · `sale_items` · `payments` · `cash_closings` · `insights` (type, severity, impact_rupees, evidence, status) · `briefs` · `messages` (raw, parsed, status) · `audit_log`.

Two rules that keep it honest:
- Stock is only ever changed by inserting a `stock_movements` row. The `stock` table is a running total of them.
- Every query goes through one data-access module that injects `org_id` and the user's branch scope from the session. The model never supplies them.

---

## 6. How the AI works (the part judges will probe)

### Principle: the LLM never computes a number

```
question / schedule ─▶ LLM chooses a metric + filters ─▶ our code runs the SQL ─▶ LLM words the result
```

- **Metrics layer:** about 12 typed, tested functions — `salesSummary`, `salesTrend`, `topItems`, `branchComparison`, `stockStatus`, `lowStock`, `deadStock`, `receivablesAging`, `customerProfile`, `marginReport`, `paymentSplit`, `insightsFor`. Each takes a period, optional branch, optional grouping.
- The chat model gets these as tools. If no tool fits the question it says so instead of guessing.
- Every answer carries a "how this was calculated" link to the filtered screen behind it.

This is the answer to "what if the AI is wrong?" — and it is backed by the 2026 benchmarks in section 2.

### Insight engine (deterministic rules)

| Insight | Rule | Suggested action |
|---|---|---|
| Sales anomaly | Branch-day sales vs median of the same weekday over 4 weeks, beyond ±20%; list the items driving the gap | Look at the drivers |
| Stock-out risk | Days of cover = on hand ÷ 14-day average daily sales, below supplier lead time | Reorder draft with quantity |
| Lost sales | Zero stock on an item that normally sells daily → rupees lost per day | Reorder or transfer |
| **Branch transfer** | Under 3 days of cover in one branch, over 30 in another | One-tap transfer |
| Dead stock | No sale in 60+ days, value above a threshold | Discount, bundle, or return |
| Overdue udhaar | Aging 0–30 / 31–60 / 60+, customers over credit limit | Send reminders with UPI link |
| Margin leak | Lines sold below cost, or unusual discounting by one user | Review |
| Cash variance | Counted cash vs expected at closing, repeated pattern | Review quietly |
| Quiet customer | Regular buyer with no order in 21 days | Win-back message |
| Good news | Record day, fastest-growing item | Always include one |

Each insight gets a rupee impact. The brief shows the top few by impact and urgency; the rest sit in an insights inbox.

### Daily brief

A scheduled job (plus a "generate now" button for the demo) runs the rules, picks the top items, and asks the model to write them in the owner's language — short enough for one WhatsApp message, richer in the app. The brief is stored, so a demo never waits on a live model call.

### Message → transaction

```
"Ramesh ko 10 bori ACC cement diya, 4000 udhaar"
   ▶ extract (intent, items, qty, customer, payment mode, amount) as structured JSON
   ▶ match item and customer against the catalogue, including aliases
   ▶ reply: "Recorded: 10 × ACC Cement 50kg to Ramesh Traders, ₹4,000 on credit. Reply UNDO to cancel."
   ▶ if unsure about anything, ask one question instead of guessing
```

### Safety rules

- Only phone numbers registered as users of the org can record anything; unknown senders are ignored.
- Chat tools are read-only. Anything that writes (sale, payment, transfer, reminder) needs an explicit confirm.
- Text inside messages and sheets is treated as data, never as instructions to the model.
- The WhatsApp bot answers only about the business's own data, which also keeps it inside Meta's 2026 policy.

---

## 7. Build order (24 hours)

Built as vertical slices so there is a demo-able product at every checkpoint. Reading comes before writing because seed data makes the dashboard and the AI work before any form exists.

| Hours | Work | Checkpoint |
|---|---|---|
| Before start | Accounts and keys (section 11); if rules allow, scaffold the repo | — |
| 0–2 | Scaffold, schema, seed generator with planted stories, persona login, app shell | Data exists and can be reset with one command |
| 2–5 | Metrics layer with tests, owner dashboard, branch filter | **1 — consolidated multi-branch view** |
| 5–9 | Insight engine, insights inbox, daily brief, language toggle | **2 — the "daily AI business report" works.** A submission already exists here |
| 9–13 | Quick bill, invoice, stock screens, customers, udhaar ledger, payments | **3 — the PS MVP is complete. P0 freeze** |
| 13–16 | Ask chat with tools; one-tap actions (reminder with UPI link, transfer) | 4 — the app answers and acts |
| 16–19 | WhatsApp simulator → inbound parsing → real Cloud API; Excel import | 5 — "it answers back" |
| 19–21 | One stretch feature; roles polish; phone-size pass | — |
| 21–23 | **Feature freeze.** Bug bash, deploy, re-seed, record backup video, finish deck | 6 — demo-ready |
| 23–24 | Rehearse the demo three times, timed | — |

If the build runs behind: stop at checkpoint 5 without the real WhatsApp hookup and demo on the simulator.

### Who does what

| Track | Owns |
|---|---|
| A — data and backend | Schema, seed generator, metrics layer, insight rules, tests |
| B — frontend | Shell, dashboard, quick bill, customers, inventory, phone layout |
| C — AI and WhatsApp | Brief, chat tools, message parsing, Cloud API, import mapping |
| D — story | Seed "plot", test questions, deck, demo script, testing on real phones |

With three people, B and D merge after hour 13. Claude Code can carry most of the typing; people should own the seed story, phone testing, WhatsApp setup and the pitch.

---

## 8. Seed data — the demo is only as good as this

90 days of generated history for Naik Traders with weekday patterns, a Diwali spike (8 Nov 2026) and these **planted stories**, each of which the insight engine must find:

1. Mapusa sales down about 22% this week — its best-selling cement SKU has been out of stock for 4 days.
2. Ponda holds 40+ days of that same SKU → transfer suggestion.
3. Three contractors 45+ days overdue, about ₹1.8 lakh together; one is over his credit limit.
4. About ₹62,000 of a paint line with no sale in 75 days.
5. Cash short at Ponda on three Tuesdays, same shift.
6. A regular contractor who has not ordered in 24 days.
7. Good news: Margao had its best day ever on Dhanteras.

The same stories are the tests: each has a known right answer.

---

## 9. Demo script (about 4 minutes)

1. **The problem (20 s).** Suresh's three branches: three Excel files, four WhatsApp groups, one tired owner.
2. **Onboarding (30 s).** Drop in his messy stock sheet → columns mapped → business live.
3. **7:00 am (45 s).** His phone buzzes: the brief, in Hindi. Mapusa is down because cement ran out; Ponda has extra. He taps **Transfer**.
4. **The counter (40 s).** Raju sends a WhatsApp message in Hinglish → sale recorded, stock down, udhaar up, dashboard updates live on the big screen.
5. **Collections (30 s).** Anita opens overdue udhaar → **Send reminders** → a teammate's phone receives the message with a UPI link.
6. **Ask (40 s).** "Is hafte kaunsi branch ka margin sabse kam hai, aur kyun?" → answer, chart, "how this was calculated".
7. **Trust (20 s).** Switch to Raju's login: no cost prices. Switch back: the quiet cash-variance flag.
8. **Business (35 s).** Pricing, market, what is next.

Always have ready: a seeded stored brief, the in-app WhatsApp simulator, a phone hotspot, and a recorded video of the full run.

---

## 10. Testing

- **Metrics and insight rules:** unit tests against the seed data with the planted answers. This is where a wrong number would hurt most.
- **Chat:** 15 fixed questions with known answers (5 English, 5 Hindi, 5 Hinglish), plus 3 it should refuse.
- **Message parsing:** 20 sample messages including typos, aliases, missing quantity, unknown customer.
- **Permissions:** staff cannot fetch cost price or another branch's data, even by calling the API directly.
- **Phones:** every P0 screen on a real small Android screen.

---

## 11. Before the clock starts

- [ ] Confirm team size, judging rubric, and whether pre-written code is allowed
- [ ] Claude API key with credit; check a free-tier fallback actually works with tool calling
- [ ] Meta developer app → WhatsApp test number → allow-list every teammate's phone → send one test message
- [ ] Neon project, Vercel project, GitHub repo
- [ ] Sarvam account (only if voice is the chosen stretch)
- [ ] Phone hotspot as backup internet

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Venue internet or an API goes down mid-demo | Stored brief, simulator, hotspot, backup video |
| AI states a wrong number | Metrics layer; tests on planted answers; refusal when no metric fits |
| WhatsApp setup eats hours | Simulator is built first and shares the same handler; real API is a late add-on |
| Scope creep | P0 freeze at hour 13, feature freeze at hour 21, one stretch feature only |
| Hinglish parsing mistakes | Confirm-before-save and UNDO; aliases on items and customers |
| Free-tier rate limits during judging | Paid key for the demo; cached responses for the scripted path |
| Empty-looking product | Seed generator is hour-one work, not an afterthought |

---

## 13. Business model (for the pitch)

All prices below are **our hypotheses**, to be pressure-tested — not market data.

| Stream (from the PS) | Proposal |
|---|---|
| Monthly subscription | ₹499/month, one branch, all core modules, daily brief |
| Per-branch pricing | + ₹299/month per extra branch |
| Premium AI | + ₹299/month: voice, unlimited ask, forecasting, bill scanning |
| Implementation | ₹2,999 one-time: import of existing sheets, catalogue setup, family training |
| Integrations | Tally export/sync, payment gateway, e-commerce — priced per connector |

- **Market size:** Udyam + Udyam Assist registrations passed 8.84 crore by June 2026 (official fact sheet; includes informal micro units, so it is a ceiling, not a customer count). Build the serviceable number bottom-up from multi-branch retailers and distributors and label every assumption.
- **Cost to serve:** a daily WhatsApp brief costs about ₹3.5 per recipient per month at the India utility rate. Measure the actual model cost per business per day during the build and put the real figure on the slide.
- **Go-to-market:** accountants and distributor associations as channel partners; start in one city, one vertical.
- **Moat:** each business's item and customer aliases, the owner's notes, and its history make the AI more accurate the longer it is used.

### Judge questions to prepare for

- *How is this different from Vyapar / Khatabook / Tally?* They record transactions. We sit across branches and tell the owner what to do. We can import from them.
- *Why would a 58-year-old owner use it?* He does not install or learn anything. He reads one WhatsApp message.
- *What if the AI is wrong?* It never does arithmetic; code does. Every number links to its source.
- *Offline?* Not in this version; a queued offline mode is on the roadmap.
- *Data privacy?* Per-org isolation, role tiers, audit log; the bot only ever discusses the business's own data.

---

## 14. Sources

Market and adoption
- [PayNearby MSME Digital Index 2026 — ANI](https://aninews.in/news/business/upi-aadhaar-banking-drive-61-of-msme-transactions-ai-adoption-rises-report20260623123118/)
- [Indian Accounting Software Industry report 2026 — Turia](https://turia.in/articles/indian-accounting-software-industry-report-2026/)
- [Zoho MSME survey — cost as top hurdle](https://prezohoweb.zoho.com/news/zoho-survey-reveals-that-high-cost-of-software-a-top-hurdle.html)
- [State of Digitalisation in Indian MSMEs — India SME Forum](https://indiasmeforum.org/digishaastra/assets/docs/Final-META-Report-Card-2025.pdf)

Family business
- [PwC India Family Business Survey 2019](https://www.pwc.in/research-insights/family-business-survey-2019.html)
- [What ails a typical family-run business in India — PrintWeek](https://www.printweek.in/features/ails-typical-family-run-business-india-noel-dcunha-sunday-column-28613?amp=1)
- [Why Indian family firms are optimistic but tech-shy — Open](https://openthemagazine.com/business/explained-why-indian-family-firms-are-optimistic-but-tech-shy)
- [Distributors face inventory pile-up — BloombergQuint](https://www.bloombergquint.com/bq-blue-exclusive/distributors-face-inventory-pile-up-as-sales-of-consumer-goods-fail-to-recover)

Competitors
- [Best accounting software for traders in India 2026 — HelloBooks](https://hellobooks.ai/best-accounting-software-for-traders-india)
- [TallyPrime 7.1 product update](https://tallysolutions.com/darpan/product-update-tallyprime-7-1/)
- [TallyPrime 7.1 introduces TallyIra — Digital Terminal](https://digitalterminal.in/solutions/tallyprime-71-introduces-tallyira-ai-powered-automation-for-modern-businesses)
- [Khatabook vs myBillBook vs Vyapar — Techjockey](https://www.techjockey.com/compare/khatabook-vs-mybillbook-accounting-software-vs-vyapar)
- [Vyapar AI voice-first assistant (research prototype) — IJERT](https://www.ijert.org/vyapar-ai-voice-first-business-assistant-for-small-enterprises-ijertv15is061078)

AI, WhatsApp, voice
- [Semantic layer vs text-to-SQL 2026 — dbt Labs](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)
- [Why text-to-SQL fails — Omni](https://omni.co/blog/why-text-to-sql-fails)
- [WhatsApp Business API pricing in India 2026 — Amomic](https://amomic.in/blog/whatsapp-business-api-pricing-india)
- [WhatsApp test phone number limitations — WANotifier](https://help.wanotifier.com/en/article/test-phone-number-limitations-kt0ly2/)
- [WhatsApp bans general-purpose chatbots from the Business API — 9to5Mac](https://9to5mac.com/2025/10/20/whatsapp-bans-ai-chatbots-from-using-its-business-api/)
- [WhatsApp chatbot policy 2026 — respond.io](https://respond.io/blog/whatsapp-chatbot-policy-2026)
- [Sarvam speech-to-text](https://www.sarvam.ai/speech-to-text) · [Sarvam pricing](https://docs.sarvam.ai/api/getting-started/pricing.md)
- [Free LLM API tiers 2026 — OpenRouter](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)

Event
- [Odyssey 2026 — PCCE's 24-hour hackathon (April edition)](https://www.odysseypcce.in/)
