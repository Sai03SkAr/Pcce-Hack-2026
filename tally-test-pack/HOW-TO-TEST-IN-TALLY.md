# Testing Pedhi's export in TallyPrime

Goal: prove that what Pedhi writes imports cleanly into Tally and gives the **same Trial Balance**. Takes about 15 minutes on the Windows PC that has TallyPrime.

**Use a new test company. Never import into a real company.**

## Files in this folder

| File | What it is |
|---|---|
| `1-ledgers-masters.xml` | 71 ledgers (customers, suppliers, banks, cash, sales/purchase by GST rate, GST, expenses, capital) with opening balances |
| `2-smoke-test-one-day.xml` | 63 vouchers for one day (12 Nov 2026). Small, so any error is easy to read |
| `2b-smoke-test-one-day-ALT.xml` | The same day using `LEDGERENTRIES.LIST` instead of `ALLLEDGERENTRIES.LIST`. Use only if file 2 is rejected |
| `3-all-vouchers-except-smoke-day.xml` | The other 6,361 vouchers, 15 Aug to 11 Nov 2026 |
| `4-pedhi-trial-balance-to-compare.csv` | Pedhi's Trial Balance as on 12 Nov 2026, to compare with Tally's |

## Steps

**1. Create the test company** (Alt+K → Create, or F3 in older menus)
- Company name: **Naik Traders** (the files name this company)
- State: **Goa**, Financial year beginning: **1-Apr-2026**, Books beginning from: **1-Apr-2026**
- Company features (F11): turn **GST on**. Registration type Regular, state Goa, GSTIN `30ABCPN1234F1Z5`.

**2. Import the ledgers**
Gateway of Tally → **Import** → **Masters** → pick `1-ledgers-masters.xml` → Behaviour: *Combine (Modify with new data)* → Import.
Check: Chart of Accounts → Ledgers shows 71 new ledgers (Cash - Margao, HDFC Bank - Current, Sales @28%, Output CGST, Ramesh Gaonkar Contractor and so on), each under the right group.

**3. Smoke test: one day of vouchers**
Import → **Transactions** (Vouchers) → pick `2-smoke-test-one-day.xml` → Import.
Check: Day Book for **12-Nov-2026** shows 63 vouchers (sales, receipts, payments).
If Tally reports errors, try `2b-smoke-test-one-day-ALT.xml` instead.

**4. Full import**
Import → Transactions → `3-all-vouchers-except-smoke-day.xml`. 6,361 vouchers; give it a minute.

**5. Compare the Trial Balance**
Display More Reports → **Trial Balance**, period 1-Apr-2026 to **12-Nov-2026** (F2 to change the date). Open `4-pedhi-trial-balance-to-compare.csv` in Excel next to it.

What should match:
- Every ledger's balance, for example **HDFC Bank - Current ₹82,51,979 Dr**, **Cash - Margao ₹2,42,226 Dr**, **Output CGST ₹25,29,864 Cr**.
- Grand total **₹4,38,35,074** on each side.

The one expected difference: Tally will show **Difference in opening balances ₹93,85,396**. That is the opening stock, which Pedhi keeps from its inventory and which Tally keeps on stock items. These files carry only the accounts, not stock items, so Tally cannot see it. Pedhi's CSV shows the same figure as "Opening Stock".

Also expected: Tally's own GSTR-1 may list these as "uncertain" transactions, because the sales ledgers were imported without GST rate settings. Pedhi's GST page already prepares the GSTR-1 and 3B numbers; if you want Tally's GST reports to work too, tell me and I'll add the rate details to the sales and purchase ledgers.

## If something fails, send me

1. A photo or screenshot of Tally's import summary (how many created, how many errors).
2. The file **`tally.imp`** from the TallyPrime installation folder (usually `C:\Program Files\TallyPrime\tally.imp`). It lists the exact line Tally rejected.
3. Best of all: in Tally, open any one voucher you entered by hand, then **Export** it (Alt+E → Current → XML format) and send me that XML. I'll match Pedhi's file to it tag for tag.

With those, the fix is usually one tag.
