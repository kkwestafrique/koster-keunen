# KKWA MIS — Manual QA Checklist

Work through this after pulling `main` and running `npm install --legacy-peer-deps`. Check off each item; if something fails, note the exact error/screenshot and send it over rather than trying to self-diagnose — most bugs this session were subtle (wrong column names, missing joins) that aren't obvious from the UI alone.

---

## 1. Login & Password Flows
- [ ] Log in with a real account (`kkwestafrique@gmail.com` or another real user)
- [ ] Log out, click **Forgot password?** on the login page → enter email → confirm "check your email" screen appears
- [ ] Check the actual email arrives (Supabase-sent), click the link → confirm it lands on **Reset your password**, not an error
- [ ] Set a new password meeting all 3 rules (8 letters / numeral / symbol) → confirm redirect to login works with the new password
- [ ] Try visiting `/reset-password` directly with no valid session (e.g. in an incognito window) → confirm you see "Reset password link expired" rather than a broken form

## 2. Contracts
- [ ] Create a contract with a **single product** → confirm it saves and appears in the Contracts list
- [ ] Create a contract with **multiple products** (Add more products) → confirm it saves, and the list shows one row per product
- [ ] Open the contract's detail page → confirm **all** products show, with a correct total quantity
- [ ] Confirm the Country filter and country column on the Contracts list actually populate (this depends on the supplier actor having a country set)

## 3. Transactions
- [ ] **Received**: single product → saves; multiple products (Add more product) → saves as separate rows, all visible in the list
- [ ] Confirm Village → Beekeeper cascade works (pick a village, beekeeper dropdown narrows to that village only)
- [ ] **Processing**: create one → confirm it saves and shows Source product/quantity + Destination product correctly
- [ ] **Send**: create one → confirm it saves
- [ ] After each of the three, check **Stocks → Raw material / Final product / Loss** — quantities should reflect what you just did (Received adds Raw Material, Processing converts Raw→Final, Send deducts Final)

## 4. Stocks
- [ ] Raw material list shows a **Stock ID** column, and Village + Date filters actually filter something
- [ ] Final product / Loss lists show **Select** checkboxes per row and a working **Select all**

## 5. Bulk Upload
- [ ] Download the Excel template from inside Receive Stock → Multiple transaction
- [ ] Fill in a row using a **real beekeeper traceability code** (check Beekeepers list for one, e.g. `BK-0001`) → upload → confirm it succeeds and shows up in Transactions
- [ ] Try a row with a **fake/nonexistent** traceability code → confirm you get a clear per-row error (not a silent failure or a crash)
- [ ] Check **Bulk uploads** page shows this upload in its history

## 6. Beekeepers
- [ ] **Add Beekeeper** → confirm the Country → State → LGA → Village cascade appears and works (not a flat village dropdown)
- [ ] Try picking a country/region where you're not sure the district list is complete (e.g. anywhere in Ghana) → confirm there's an "Other (not listed)" option if your real district isn't in the list
- [ ] Open an existing beekeeper's detail page → click **Edit** → confirm it opens pre-filled (not disabled) and saves changes
- [ ] Check the Beekeepers list shows real hive counts (Traditional Single/Double, Modern, Other) — not all zeros
- [ ] Try the Year filter on the Beekeepers list → confirm it actually narrows results

## 7. Actors
- [ ] Open any actor's profile → **Transactions** tab shows real data (not "No records found" if that actor has transactions)
- [ ] Toggle **Enable/disable connection** → refresh the page → confirm the toggle state persisted (didn't reset)
- [ ] Check the country filter on the Actors list is actually labeled "All country" (not "All status")

## 8. Company Profile / Team Members
- [ ] Edit your own actor's name/type → Save → confirm it persists after refresh
- [ ] **Add new team member** → fill in name/email/role → submit → confirm no error
- [ ] Check the invited email actually arrives, click it → confirm it lands on **Set up password** with a "Welcome [name]!" greeting
- [ ] Set a password there → confirm it logs you into a real, working account with the correct role
- [ ] Back in Company Profile → Team Members tab → confirm the new member shows with status **Active** (not stuck on Invited)

## 9. Reports
- [ ] Try **all 10 report types** (5 under Commercial partners, 5 under Transactions) — each should generate a CSV without a red error, even when you fill in Year/Standards/Date filters
- [ ] Specifically test **Beekeepers-Achieved** and **Actors-Achieved** (these used to crash on the Year field)
- [ ] Specifically test **Contract** report with a date range filled in (used to crash — was filtering the wrong column)
- [ ] Confirm **Received-Beekeepers** and **Received-Actors** actually return different results, not identical data

## 10. Dashboard & Downloads
- [ ] Change the Country/Actor type/Year filters on the Dashboard → confirm the KPI numbers actually change
- [ ] Check the **Transaction Overview** tab shows real bar charts once you have transaction data (not a blank placeholder)
- [ ] Click the **Download** icon in the top bar → confirm a panel opens (not dead)
- [ ] Generate a report from step 9, then immediately check this panel → confirm it shows "Preparing..." then flips to "Completed" with a row count, live, without you refreshing the page

---

## If something fails
For each failure, note: which step, what you expected vs. what happened, and (if it's an error) the exact text or a screenshot of the browser console (F12 → Console tab). That's usually enough for me to find the specific line without needing to reproduce it myself.
