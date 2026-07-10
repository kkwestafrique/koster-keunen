# Changelog — Koster Keunen Frontend Visual Overhaul

All changes below were made to the `frontend` folder of `kkwestafrique/koster-keunen`.
No backend logic, Supabase schema, or business logic was changed — this was a
visual/structural pass to align the app with the live KKWA MIS (miskkwa.com)
and the provided design screenshots.

---

## 4. Remove blockchain tagline from login page
**Commit:** `979d96c`

- Removed the "Block chain powered supply chain platform" heading from the
  login page's left panel to avoid any legal implications of the blockchain
  claim.
- Left panel now shows only the "Koster Keunen" wordmark and the decorative
  cube illustration.

**File changed:** `src/pages/Login.jsx`

---

## 3. Branding and console warning cleanup
**Commit:** `1eccc78`

- Replaced leftover "BeezTrace" placeholder branding with "Koster Keunen" in:
  - Page `<title>`
  - Meta description
  - Apple mobile web app title
  - PWA manifest `name` / `short_name`
- Added the non-deprecated `mobile-web-app-capable` meta tag alongside the
  deprecated `apple-mobile-web-app-capable` one, resolving the console warning.

**Files changed:** `public/index.html`, `public/manifest.json`

---

## 2. Structural rebuild to match live site + real i18n
**Commit:** `bc47845`

This was the largest change. The live site (miskkwa.com) was crawled page by
page to capture its real navigation structure and layout patterns, which the
app was then rebuilt to match.

### Sidebar
- Rebuilt navigation to match the live site exactly:
  - Dashboard
  - Actor profile
  - Commercial partners → Actors, Beekeepers
  - Contracts
  - Transactions → Received, Processing, Send
  - Stocks → Raw material, Final product, Loss
  - Bulk uploads
  - Report
- Active nav item is now a full-width rounded pill (`bg-#0f48aa`), matching
  the live sidebar, instead of an icon-only highlight.
- Sidebar widened from 210px → 240px to match live proportions.

### New pages (previously missing)
- **Company/Actor Profile** (`/company-profile`) — header card with
  Sustainable/Organic standard pills, "Actor details" / "Team members" tabs,
  and a profile-completion side panel with progress bar.
- **Contracts** (`/contracts`)
- **Transactions** (`/transactions/received`, `/processing`, `/send`) — shared
  list component
- **Stocks** (`/stocks/raw-material`, `/final-product`, `/loss`) — shared list
  component
- **Bulk uploads** (`/bulk-uploads`) — dropzone placeholder
- **Report** (`/report`) — placeholder

> Note: these new pages render the correct structure but with empty data —
> there are no backend hooks wired for Contracts/Transactions/Stocks entities
> yet, so tables show "No records found" until that's built out in a future
> phase.

### Actor Detail page
Rewritten to match the live "Actor profile" layout: back link, header card
with standard pills, "Actor details" / "Transactions" tabs, and an
Enable/Disable connection toggle panel on the right.

### New shared component
`ActorHeaderCard` — extracted since the same logo + name + pills + fact-row
pattern repeats across Actor profile, Company profile, and Actor detail.

### Language switching (real, not decorative)
- Added `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- Created `src/locales/en/translation.json` and `src/locales/fr/translation.json`
  covering: nav, topbar, login, dashboard, actors list, beekeepers list,
  contracts, transactions, stocks, actor profile, and common strings
- TopBar dropdown now matches the live site's "Languages" panel exactly
  (flag + En/Fr + chevron, opens panel with English/French options)
- Language selection persists to `localStorage` and is detected on load
- Wired into: Login, Dashboard, Sidebar, TopBar, ActorsList, BeekeepersList,
  ActorDetail, CompanyProfile

### Dashboard
- Stat card order/labels now match live site: Local partners, Aggregators,
  Producer organisations, Beekeepers (4 equal-width cards)
- Filter bar relabeled to match live: Country / Actors / Year

### Routing
Added routes: `/company-profile`, `/contracts`, `/transactions/received`,
`/transactions/processing`, `/transactions/send`, `/stocks/raw-material`,
`/stocks/final-product`, `/stocks/loss`, `/bulk-uploads`, `/report`

**Files changed/added:** 21 files — see commit `bc47845` for full list.

---

## 1. Initial visual pass
**Commit:** `c8280ab`

- **Login page** — converted to full-screen 50/50 split layout: blue left
  panel with Koster Keunen branding + decorative SVG cube illustration, white
  right panel with the login form (email, password, "Keep me logged in",
  "Forgot password?")
- **Sidebar** — added Koster Keunen logo header, rounded-pill active nav
  states
- **TopBar** — added language selector pill, switched from box-shadow to
  border-bottom
- **Dashboard** — stat cards redesigned so the large number appears first
  with the label below
- **Global colors** — page background updated to `#f5f7fa`, sidebar
  background to `#f0f6ff`

**Files changed:** `src/pages/Login.jsx`, `src/pages/Dashboard.jsx`,
`src/components/layout/Sidebar.jsx`, `src/components/layout/TopBar.jsx`,
`src/components/layout/AppLayout.jsx`, `src/index.css`,
`tailwind.config.js`, `src/App.js`

---

## Known gaps / next phase

- Contracts, Transactions, and Stocks pages have UI structure but no backend
  data — hooks and Supabase tables for these entities still need to be built.
- French translations were written by hand and should be reviewed by a native
  speaker before shipping.
- Local dev note: if you mocked `supabaseClient.js` / `AuthContext.jsx` for
  local UI viewing, remember those mocks are **not** part of this repo's
  history — they were local-only workarounds for viewing without real
  Supabase credentials.
