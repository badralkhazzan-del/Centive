# PiringTani

**Plan backwards, from the plate to the farm.**
*Dari piring anak, mundur ke sawah petani.*

PiringTani is a bilingual (English by default, Bahasa Indonesia) web app for Indonesia's Free Nutritious Meals program (Makan Bergizi Gratis, MBG), built for CENTIVE 2026. A school kitchen (SPPG) already knows weeks ahead what is on the menu, which days school is open and how many children it feeds. PiringTani starts from that plan and works backwards: to the kilograms of each ingredient the kitchen will need, to the village cooperative (Koperasi Desa/Kelurahan Merah Putih, or Kopdes) that can source them, and to the member farmers who can plant and raise livestock in time to sell.

It complements BGN's planned procurement marketplace rather than competing with it: the marketplace handles the purchase, PiringTani plans the supply before it.

The app has two modes:

- **Demo** (no account): a fixed-date fictional region that runs fully in the browser, works offline and includes the 3-minute guided tour for judges.
- **Live workspaces** (with an account): a real, multi-user system on the real calendar. An administrator creates a workspace, adds the real kitchens, cooperatives, farmers, menus and prices, and invites each person with a sign-in link. Everyone works on the same data on the server. See [Live workspaces](#live-workspaces).

Developed by **Badr Aleen Al-kazan** for the CENTIVE Competition 2026.

> **Data notice.** In the demo (and in a live workspace that loads the sample region) every organization, person, farmer, phone number, delivery, payment and chat message is fictional, placed in real subdistricts of Banyumas Regency, Central Java, only so the map looks right. Sample prices are placeholders until real prices are entered. Nutrition values follow TKPI 2020 (Kemenkes), with two items that have no TKPI row (see below). The only real-world statistics are the sourced facts in `src/content/facts.ts`.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Testing](#testing)
- [Demo Mode](#demo-mode)
- [Live workspaces](#live-workspaces)
- [Project structure](#project-structure)
- [Deploying to Vercel](#deploying-to-vercel)
- [Replacing price data with PIHPS](#replacing-price-data-with-pihps)
- [Verifying TKPI values](#verifying-tkpi-values)
- [Facts policy](#facts-policy)
- [Capturing poster screenshots](#capturing-poster-screenshots)
- [Design system](#design-system)
- [Model notes and known limitations](#model-notes-and-known-limitations)
- [Credits and licenses](#credits-and-licenses)

## Features

### Three core features

| Feature | Used by | What it does | Route and engine |
| --- | --- | --- | --- |
| **Menu-to-Field Forecast** | Kitchen (SPPG) | Turns the 4-week menu cycle, the school calendar, the number of children and attendance into kilograms of each ingredient per week, 1 to 8 weeks ahead, with a safety buffer and a low/high band. | `/kitchen/forecast`, `src/engines/forecast.ts` |
| **Cooperative Commitment Board** | Kopdes manager | Shows how much of that demand is covered by farmer commitments (green at 100%, yellow from 80%, red below). "Send offers to farmers" ranks members by reliability (50%), spare capacity (30%) and same village (20%), with a 30% fairness cap per farmer and a consent check. Farmers accept by WhatsApp. | `/kopdes`, `src/engines/matching.ts` |
| **Harvest-Aware Menu Switch** | Kitchen nutritionist | When a local ingredient is short, its price spikes or a harvest is in surplus, it proposes a swap from the same food group that passes hard nutrition, budget, diversity and lead-time rules. A person always approves or rejects it. | `/kitchen/switch`, `src/engines/substitution.ts` |

### Supporting modules

- **Price Shield** (on the Commitment Board): alerts when a market price is 10% or more above its 4-week moving average, or when kitchen demand is more than 25% of the estimated local weekly supply. It suggests spreading purchases over 2 weeks, asking a neighbor Kopdes, or opening the Menu Switch.
- **Price Band**: each commitment carries a floor (95%) and a ceiling (110%) of the 4-week average price, fixed when the offer is made. The settlement price is clamped inside the band.
- **Batch Trace QR**: the Kopdes groups accepted produce into a batch with a QR label (`/kopdes/delivery`), the kitchen scans or types the code on receipt (`/kitchen/receive`), and anyone can open the public trace page (`/trace/<code>`).
- **Payment Clock** (`/kopdes/payments`): delivered, verified by the kitchen, kitchen paid the Kopdes, Kopdes paid the farmers. Anything open past the 7-day SLA is flagged as overdue.
- **Plate Feedback** (`/kitchen/feedback`): leftovers per dish. It feeds the child acceptance part of the Menu Switch score.
- **Farmer WhatsApp simulator** (`/farmer`): what a farmer sees, with quick-reply buttons.
- **Regency Impact Dashboard** (`/regency`): local sourcing share, farmers engaged, fill rate, days to farmer payment, price stability, a map and a printable A4 report.
- **Simulation Lab** (`/simulation`): a seeded 8-week comparison of spot buying against PiringTani under the same price, shortage and surplus shocks.
- **Settings** (`/settings`): thresholds, data sources, data and privacy, and the audit log.
- **Demo Mode**: a guided 8-step tour (see below).

## Quick start

You need **Node.js 20.9 or newer** (the minimum for Next.js 16) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For a production build:

```bash
npm run build
npm start
```

There are no environment variables, no API keys and no backend or database. All demo data lives in the browser's `localStorage` under the key `piringtani-demo`. To go back to the original data, use **Reset demo** in the header menu, or Settings.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serves the production build on port 3000 (`npm start -- -p 4000` for another port) |
| `npm run lint` | ESLint with the Next.js core web vitals and TypeScript rules |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm test` | Vitest engine suites, run once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright Demo Mode smoke test |

## Testing

### Unit tests

`npm test` runs the Vitest engine suites in `src/engines/__tests__` in plain Node (no browser). They cover:

| Suite | What it checks |
| --- | --- |
| `forecast.test.ts` | The forecast formula (raw kg, safety buffer, low/high band), holidays (Christmas Day, Friday 25 Dec 2026, in week 8), Kopdes aggregation with order shares, and forecast accuracy (MAPE). |
| `matching.test.ts` | Farmer score weights, allocation in rounds, the 30% fairness cap, capacity and consent, traffic lights at 100% and 80%, and the women and youth share. |
| `priceBand.test.ts` | Floor 95% and ceiling 110%, settlement clamping, the eggs band (Rp26,600 to Rp30,800) and the 4-week reference window. |
| `priceShield.test.ts` | The week-3 chicken spike, demand above 25% of local supply (and no alert at exactly 25%), one card per ingredient. |
| `substitution.test.ts` | The Menu Switch, including the **hard-constraint tests**: no suggestion or alternative ever breaks a rule, checked across stricter settings and in a sweep over every kitchen, week, day and dish. Separate tests cover protein at least 95%, energy within 10%, the raw-food budget, at most 2 days per week with the same main protein, the D-3 lead time, allergen exclusions, locked anchor dishes, "no suggestion" when nothing valid exists, protein-matched grams (nearest 5 g) with the staple adjustment capped at 40 g, and Plate Feedback acceptance. |
| `payment.test.ts` | Payment Clock stages, overdue after the SLA, financing-ready records, average days to farmer payment. |
| `kpis.test.ts` | Regency indicators stay bounded and rise when a farmer accepts an offer. |
| `simulation.test.ts` | Same seed gives identical numbers, metrics are finite and bounded, the expected direction under the default shocks, and no unmet demand without shocks. |
| `seed.test.ts` | Every seed menu day fits the budget, eggs start at 62% for Kopdes Sumbangsari in weeks 3 to 6, first names and masked phones only, demo labels and placeholder prices, every fact has a source and a date, unique batch codes and the fairness cap. |
| `commands.test.ts` | The repository commands behind the demo flows: offers, a farmer reply, a decline, approving and rejecting a switch (menu, forecast and audit log stay consistent), batch receipt and the Payment Clock, consent, settings changes. |
| `i18n.test.ts` | English and Indonesian have the same keys, no empty strings, and most strings are actually translated. |

### End-to-end test

The Playwright Demo Mode smoke test lives in `tests/e2e/demo.spec.ts`. Install the browser once, then run it:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright config (`playwright.config.ts`) builds and starts the app itself on port 3210, so you do not need a server running. Outside CI it reuses a server that is already listening on 3210.

## Demo Mode

Press **Play 3-minute demo** (the Play button in the header). Demo Mode first resets the demo data, opens the landing page and then walks through 8 steps. A card at the bottom of the screen has **Back**, **Next**, **Autoplay/Pause** and **Exit demo** (Esc also exits). Autoplay moves on every 20 seconds. Pressing Next early still applies each step's data change, in order.

| Step | Screen | What happens |
| --- | --- | --- |
| 1 | Landing | Why are so few suppliers village cooperatives? (the 0.48% fact) |
| 2 | Kitchen, Forecast | The menu becomes an 8-week forecast. |
| 3 | Kopdes, Commitment Board | Eggs are only 62% covered in weeks 3 to 6. The manager taps "Send offers to farmers". |
| 4 | Farmer, WhatsApp | Pak Darto replies 20 kg per week, and the board bar rises live. |
| 5 | Kopdes, Price Shield | Chicken is expected 18% above its 4-week average in week 3. The Menu Switch is triggered. |
| 6 | Kitchen, Menu Switch | The nutritionist approves chicken to catfish. Menu, forecast and audit log update. |
| 7 | Delivery | The Kopdes prints a batch QR label, the kitchen scans it on receipt and the Payment Clock starts. |
| 8 | Regency | Local sourcing share, farmers engaged, fill rate and days to payment add up. |

At the end the card offers **Play again**. Every screen stays open to explore.

## Live workspaces

Live workspaces turn PiringTani from a demo into a working system: real accounts, real data and the real date.

### Turning them on (Vercel)

1. In your Vercel project, open **Storage**, choose **Create Database**, pick **Neon (Postgres)** (free plan) and connect it to the project. Vercel adds `DATABASE_URL` to the environment. Any Postgres works instead, for example Supabase: copy its connection string (the pooled one on port 6543 is fine) into a `DATABASE_URL` environment variable.
2. Add an environment variable `AUTH_SECRET` with a long random value (for example the output of `openssl rand -base64 32`). It signs sign-in cookies. Without it, a key derived from `DATABASE_URL` is used.
3. Redeploy. The tables are created automatically on first use (`pt_workspaces`, `pt_users`, `pt_login_attempts`).
4. Open `/signup`, create your workspace and your administrator account. Choose **Empty workspace** for real use or **Sample region** to explore.

Without a database URL the deployed site still serves the full demo, and the sign-in pages explain that live workspaces are not set up yet. Locally (`npm run dev`), no setup is needed: an embedded Postgres (PGlite) stores data under `node_modules/.cache/piringtani`.

### Who does what

| Role | Signs in to | Can change |
| --- | --- | --- |
| Administrator (regency / Dinas coordinator) | Everything | All data, people, settings, start over |
| Kitchen (SPPG) | Kitchen screens | Their kitchen, its menu and calendar, Menu Switch decisions, receipts, kitchen payments, Plate Feedback, the dish library |
| Kopdes manager | Kopdes screens | Their Kopdes, its farmers (and farmer invites), offers, deliveries, farmer payments, weekly prices |
| Farmer | Their own inbox (mobile web) | Answers to their own offers |
| Viewer | Regency dashboard | Nothing (read only) |

Every change is checked on the server against these rules. Farmers only see their own messages and orders; other farmers appear without names or phone numbers. Full phone numbers are visible only to administrators and the farmer's own Kopdes.

### Day-to-day use

- **Manage** (`/manage`): add kitchens (children, attendance, linked Kopdes and order shares, school calendar), Kopdes (and neighbors), farmers (products, weekly capacity, WhatsApp number, consent), ingredients and nutrition values, weekly market prices (type them in or paste rows from a PIHPS export or market survey), dishes and each kitchen's 4-week menu.
- **People**: invite someone, then send the sign-in link by copy or with the **Send by WhatsApp** button. The same button gives a new link when someone forgets their password.
- **Farmers on WhatsApp**: the Kopdes Farmers screen has a WhatsApp button per farmer that opens WhatsApp with the open offer and a link to answer it in PiringTani. No WhatsApp Business account is needed.
- **The real calendar**: weeks roll forward automatically. Week 0 is the current week in the workspace time zone (Asia/Jakarta), plans keep their dates, and the menu cycle stays aligned.
- **Live updates**: each screen refreshes every few seconds, so a farmer's answer appears on the Kopdes board almost at once.

### How it works

The browser runs each change on its local copy at once (the same pure command code as the server), then sends `{ name, args }` to `/api/command`. The server loads the workspace with a row lock, moves it to today, checks the role, runs the command and saves it. The answer replaces the local copy. See `src/lib/repo/registry.ts` (commands and permissions), `src/server/` (database, auth, workspaces, users) and `src/app/api/`.

## Project structure

```text
src/
  app/                 Routes (App Router). Each page.tsx is a server component that
                       sets metadata and renders one client component.
    page.tsx           Landing
    kitchen/           This week & next, menu, forecast, switch, receive, feedback
    kopdes/            Commitment Board (with Price Shield), farmers, delivery, payments
    farmer/            WhatsApp simulator
    regency/           Impact Dashboard
    simulation/        Simulation Lab
    settings/          Thresholds, data sources, data & privacy, audit log
    about/             Sustainability and pilot plan
    trace/[code]/      Public batch trace page (the QR target)
    fonts/             Plus Jakarta Sans, self-hosted woff2
    globals.css        Design tokens, poster mode and print styles
  components/          UI by area: kitchen, kopdes, farmer, regency, simulation, settings,
                       landing, demo, layout, common, and ui (the small UI kit)
  engines/             Pure TypeScript business logic, no React: forecast, matching,
                       priceBand, priceShield, substitution, payment, kpis, simulation,
                       derive, menu, nutrition, time, format, rng
    __tests__/         Vitest suites
  data/                Seed data: ingredients, dishes, menu cycle, places, farmers,
                       commitments, prices, history, simulation input, seed.ts
  content/facts.ts     The only real-world statistics, each with source and date
  i18n/                en.ts (default), id.ts (typed against the English dictionary), useT()
  lib/repo/            Repository interface, local implementation, pure commands
  lib/                 Delivery, trace, roles, names and chart helpers
  types.ts             Domain types
public/sw.js           Service worker (offline support, production builds only)
tests/e2e/             Playwright smoke test
```

### How data flows

1. Components read data with `useAppData()` and computed views with `useDerived()` (forecasts, coverage, alerts, suggestions, KPIs). `useDerived()` runs `derive()` from `src/engines/derive.ts` and caches the result per state.
2. Components change data only through `actions` from `@/lib/repo`, for example `actions.sendOffers(...)` or `actions.updateSettings(patch)`.
3. Each action calls a pure command in `src/lib/repo/commands.ts` that takes the current `AppData` and returns a new one. Approvals, rejections and overrides are written to the audit log.
4. The local repository (`src/lib/repo/local.ts`) is a Zustand store persisted to `localStorage`. Tabs in the same browser stay in sync, and in a private window it falls back to memory.

### Swapping in Supabase (or any backend)

The UI never touches storage directly, so a server-backed version only needs a new implementation of the `Repository` interface in `src/lib/repo/types.ts`:

- `getState()` returns the current `AppData` synchronously (React reads it with `useSyncExternalStore`), so keep a local cache.
- `subscribe(listener)` notifies on changes. Supabase Realtime is a natural fit.
- `hydrate()` and `hasHydrated()` load the data from the server once on the client.
- `actions` implements `RepositoryActions`. The simplest route is to reuse the pure commands in `commands.ts` on the cached state and then write the changed rows.

Then change one line in `src/lib/repo/index.ts`:

```ts
export const repo: Repository = createSupabaseRepository();
```

## Deploying to Vercel

The app needs no configuration on Vercel.

1. Push the repository to GitHub, GitLab or Bitbucket.
2. At https://vercel.com/new, import it. The framework preset is detected as **Next.js**. Keep the default build command (`npm run build`) and output settings.
3. Add no environment variables. Deploy.

From a terminal you can also run:

```bash
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

In production builds, `public/sw.js` precaches every app route and its static assets on the first visit, so the demo keeps working offline after one load (an "Offline" banner appears). OpenStreetMap tiles are cached as they are viewed. Bump `VERSION` in `public/sw.js` if returning visitors must drop old caches. The service worker is not registered in development.

Each visitor gets their own copy of the demo data in their browser. If you change seed data, bump `SEED_VERSION` in `src/data/seed.ts` so browsers replace their saved copy.

## Replacing price data with PIHPS

All prices in `src/data/prices.ts` are placeholders (`source: "PLACEHOLDER"`). Only the chicken row is anchored on a reported figure (Pasar Wage Purwokerto, December 2025: about Rp35,000/kg normally, Rp42,000/kg during the spike, which the seed places in week 3). To use real market data from PIHPS (Pusat Informasi Harga Pangan Strategis Nasional, Bank Indonesia):

**1. Open PIHPS.** Go to https://www.bi.go.id/hargapangan and open the price table.

**2. Choose the region.** Province **Jawa Tengah**, then **Kab. Banyumas** or **Kota Purwokerto** (whichever the site lists). Traditional markets (Pasar Tradisional) are the closest match to what a Kopdes pays.

**3. Pick the commodities.** Map each PiringTani ingredient id to the closest PIHPS commodity. The labels below are the usual PIHPS names, but the exact menu wording on the site may differ: pick the closest match and write down which one you used.

| PiringTani id | Unit in PiringTani | Closest PIHPS commodity | Notes |
| --- | --- | --- | --- |
| `rice` | Rp/kg | Beras Medium (for example Beras Kualitas Medium I) | PIHPS lists several rice grades. Pick one and keep it. |
| `chicken` | Rp/kg | Daging Ayam Ras Segar | |
| `eggs` | Rp/kg | Telur Ayam Ras Segar | |
| `cooking_oil` | Rp/L | Minyak Goreng (Curah or Kemasan) | PiringTani stores oil per litre. If PIHPS shows Rp/kg, multiply by 0.92 (the density in `ingredients.ts`). |
| `catfish`, `tilapia` | Rp/kg | Probably not in PIHPS | Use another source (see below). |
| `tempe`, `tofu` | Rp/kg | Probably not in PIHPS | Use another source. |
| `spinach`, `kangkung`, `long_beans`, `carrots`, `cabbage` | Rp/kg | Some vegetables may be missing | Use another source if missing. |
| `bananas`, `oranges` | Rp/kg | Probably not in PIHPS | Use another source. |

For items PIHPS does not cover, use the Banyumas regency trade or agriculture office (Dinas) market price reports, another official price panel, or a short weekly market survey (for example at Pasar Wage, Purwokerto). Record the source for each row.

**4. Choose the period.** Pick weekly data (or daily data, which you then average) covering **12 weeks**. The table columns are weeks relative to the demo date in `src/engines/time.ts` (`DEMO_TODAY = "2026-10-26"`, a Monday). Each value is the price for the week that starts on that Monday:

| Column | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Week starts | 7 Sep | 14 Sep | 21 Sep | 28 Sep | 5 Oct | 12 Oct | 19 Oct | 26 Oct | 2 Nov | 9 Nov | 16 Nov | 23 Nov |

Weeks -7 to 0 are history (week 0 is the demo week). Weeks 1 to 4 are the planning weeks ahead and act as the expected price. PIHPS only has the past, so any week that has not happened yet needs an expected price (for example the last 4-week average); say so on the poster. Planning weeks 5 to 8 reuse the week 4 price.

**5. Export and convert to weekly averages.** Export the table (Excel or CSV). For daily data, average the days of each Monday-to-Sunday week and skip empty cells. In a spreadsheet, a helper column `=A2-WEEKDAY(A2,3)` gives the Monday of each date, then `AVERAGEIF` by that column gives the weekly average.

**6. Paste into `PRICE_TABLE`** in `src/data/prices.ts`, one row of 12 numbers per ingredient, in the column order above, as whole rupiah.

**7. Mark the source.** In `buildPrices`, change `source: "PLACEHOLDER"` to `source: "PIHPS"`. If only some rows come from PIHPS, set it per ingredient so the others keep showing as placeholders:

```ts
const PIHPS_IDS = new Set(["rice", "chicken", "eggs", "cooking_oil"]);
// inside buildPrices:
source: PIHPS_IDS.has(ingredientId) ? "PIHPS" : "PLACEHOLDER",
```

Settings > Data sources then counts PIHPS and placeholder prices separately.

**8. Bump `SEED_VERSION`** in `src/data/seed.ts`, then run `npm test`.

Expect some tests to fail on purpose, because they pin the demo story to the placeholder numbers: `seed.test.ts` (every price is a placeholder), `priceBand.test.ts` (the eggs band and the week-3 chicken price), and the week-3 chicken spike in `priceShield.test.ts` and `substitution.test.ts`. The seed WhatsApp chat in `seed.ts` also quotes the eggs band. Demo Mode steps 5 and 6 need a chicken spike in week 3: either keep that week as a clearly labelled scenario, or update those tests and the step texts. The budget test in `seed.test.ts` tells you if real prices push a menu day over Rp8,000 or Rp10,000 per portion.

How prices are used: the average of weeks -3 to 0 is the reference for commitment price bands and the "normal" price in the Simulation Lab. Price Shield compares each week with the average of the 4 weeks before it. The Menu Switch budget check uses the price of the week of the switch.

## Verifying TKPI values

Nutrition values in `src/data/ingredients.ts` follow the Indonesian Food Composition Table (TKPI, Kemenkes). In October 2026 they were checked against TKPI 2020 (the revised edition) through published copies of the table, and each `dataSource` names its row code (for example `TKPI 2020 (Kemenkes), HR002` for eggs). Thirteen of the fifteen are marked `verified: true`. Two stay `verified: false` because TKPI has no matching row: catfish (lele, values from secondary sources) and tilapia (nila, values taken from Ikan mujahir, segar, GR048). In a live workspace, the administrator can edit any value in Manage > Ingredients. To re-check them yourself:

1. Open https://www.panganku.org.
2. For each ingredient, search its `tkpiName` (for example "Ayam, daging, segar" or "Telur ayam ras, segar").
3. Compare, per 100 g edible portion:

   | TKPI field | Field in `ingredients.ts` | Note |
   | --- | --- | --- |
   | Energi (kcal) | `energyKcalPer100g` | |
   | Protein (g) | `proteinGPer100g` | |
   | BDD (%) | `edibleFraction` | Stored as a fraction: BDD 58% is `0.58`. The forecast divides by it to get purchase kg. |

4. Update the numbers, then set `verified: true` and `dataSource: "TKPI 2017 (panganku.org)"`. Update or remove `dataNote`. For chicken, check which TKPI row the kitchen really uses: the seed uses whole broiler with skin, and skinless meat is much leaner.
5. Bump `SEED_VERSION` in `src/data/seed.ts` (ingredients are saved in the browser with the rest of the demo data), or press Reset demo.
6. Run `npm test`. The substitution unit tests, and above all the hard-constraint tests, must still pass. A few tests pin seed numbers (for example catfish at 60 g in the Menu Switch test). If a verified value changes one of those, update the expected number, but never relax a rule to make a test pass.

**Settings > Data sources** (`/settings?tab=sources`) lists every value that is still unverified, under "Values still to verify before printing", with its TKPI name and note. When all ingredients are verified, the list is empty.

## Facts policy

The only real-world statistics in the UI come from `FACTS` in `src/content/facts.ts`. Each fact has a value, English and Indonesian text, a date, a source name and a source URL, and every place that shows a fact also shows a visible source link. Settings > Data sources lists all of them. The wording stays neutral ("not yet connected", "coordination gaps").

Each fact also has a `buildCheck` field with the result of the web cross-check done while building (October 2026), and a `buildCheckNote` explaining it:

- `"confirmed"`: the figure was found in the cited report or an equivalent one.
- `"unconfirmed"`: the source could not be reached or the figure was not found. **The team must open the link and confirm it before printing the poster.**

All ten facts were confirmed in October 2026. Several source sites could not be opened from the build environment, so four were confirmed through search results from more than one outlet, and their notes say so:

| Fact id | Value | Source and date |
| --- | --- | --- |
| `kopdes-share-2026-05` | 0.48% of MBG suppliers were Kopdes (690 of 142,387, BGN data) | detikFinance, also TIMES Indonesia and ANTARA, 22 May 2026 |
| `banyumas-kopdes` | 41 of 331 Kopdes in Banyumas operating | ANTARA Jateng, 30 June 2026 |
| `banyumas-partners` | about 218 MBG partners in Banyumas; food still reaches kitchens through middlemen | Suara Merdeka Banyumas, 26 Sep 2026 |
| `no-shared-data` | MBG demand from local raw materials not yet met; an information system linking kitchen needs to local producers recommended | BRIDA Jawa Tengah (Ambarwati et al., 2025) |

Before printing the poster, open each link once in a normal browser. New facts need a source URL and a date (the seed test checks this).

## Capturing poster screenshots

1. **Poster mode.** Add `?poster=1` to any URL, for example http://localhost:3000/regency?poster=1. It hides the header, the Demo Mode controls, toasts, the offline banner and the footer, removes card shadows and uses a white background. A small "Demo data" label stays in the bottom right corner. Poster mode shows the data in your browser, so play the demo (or click through the steps) first, then reload the page with `?poster=1`. Capture from a production build (`npm run build && npm start`): in development, Next.js adds a small "N" badge in the bottom left corner.
2. **Window width.** Capture at **1920 px** wide. In Chrome DevTools, open the device toolbar (Ctrl+Shift+M, or Cmd+Shift+M on a Mac), choose Responsive, set 1920 x 1080, then use the menu "Capture full size screenshot". Or use the Playwright snippet below.
3. **Charts.** Every chart card has **Export chart as PNG**, which saves the chart at a 3x pixel ratio on a white background. Charts are on Kitchen Forecast, the Regency dashboard and the Simulation Lab.
4. **"How it works" diagram.** The landing page loop diagram is pure SVG with inline colors. In DevTools, select the `<svg>` element and choose "Capture node screenshot" for a PNG, or "Copy outerHTML" and save it as a `.svg` file for a vector (install Plus Jakarta Sans locally to keep the font).

A small Playwright script that saves full-page PNGs at 1920 px. Save it as `poster-shots.mjs`, start the app with `npm run build && npm start`, then run `node poster-shots.mjs`:

```js
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const pages = ["/", "/kitchen/forecast", "/kitchen/switch", "/kopdes", "/regency", "/simulation"];

const browser = await chromium.launch();
// reducedMotion turns chart animations off, so a full-page capture never catches a half-drawn chart.
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
// For Indonesian screenshots, uncomment the next two lines (the choice is saved in the browser).
// await page.goto(BASE);
// await page.click('[data-testid="lang-id"]');
for (const path of pages) {
  await page.goto(`${BASE}${path}?poster=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let the map and fonts settle
  const name = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
  await page.screenshot({ path: `poster-${name}.png`, fullPage: true });
}
await browser.close();
```

`deviceScaleFactor: 2` gives 3840 px wide images for print. Use 1 for exactly 1920 px.

Two things to know about full-page captures:

- The "Demo data" label is fixed to the bottom of the window, so in a full-page image it shows where the first 1080 px end, not at the bottom of the page. Crop it out or move it in your poster layout.
- The Kopdes and Farmer screens are built as a phone-width column (village managers and farmers use phones). At 1920 px they sit in a narrow column with white space on both sides. For the poster, capture them at phone size instead (for example `viewport: { width: 390, height: 844 }` and `deviceScaleFactor: 3`).

## Design system

The look is "rice field at morning": warm paper background, deep paddy green for actions, turmeric for the Menu Switch, and chili red only for alerts. Tokens are CSS variables in `src/app/globals.css`, exposed as Tailwind classes (`bg-primary`, `text-muted`, `bg-accent-soft` and so on).

| Token | Hex | Used for |
| --- | --- | --- |
| `background` | `#faf8f3` | Page background |
| `surface` | `#ffffff` | Cards |
| `foreground` | `#1e2a24` | Body text |
| `muted` | `#5b6b63` | Secondary text |
| `muted-surface` | `#f2efe7` | Subtle fills |
| `border` | `#e4dfd3` | Borders |
| `primary` | `#1f6f4a` | Deep paddy green: buttons, links, focus ring |
| `primary-strong` / `primary-soft` | `#17573a` / `#e3f0e8` | Text on soft green, soft green fills |
| `leaf` / `leaf-soft` | `#7fb241` / `#eef6e2` | Fresh leaf: diagram flow, decoration |
| `accent` | `#e3a21a` | Warm turmeric: Menu Switch, Play demo |
| `accent-strong` / `accent-soft` | `#6f4b00` / `#fbf0d4` | Text on soft turmeric, soft turmeric fills (also used for warnings) |
| `danger` | `#c8412d` | Chili red, alerts only |
| `danger-strong` / `danger-soft` | `#9a2e1e` / `#f9e4df` | Alert text and fills |
| `ok` / `ok-strong` / `ok-soft` | `#2e9e5b` / `#1a6a3b` / `#e1f3e8` | Covered, done, paid |

Cards use a 16 px radius (`rounded-2xl`) and a soft shadow.

**Typeface.** Plus Jakarta Sans, an Indonesian-designed typeface under the SIL Open Font License 1.1, self-hosted from `src/app/fonts` with `next/font/local` (latin and latin-ext subsets), so no request goes to a font CDN.

**Accessibility.**

- Touch targets are at least 44 px (`min-h-11`), with a visible 3 px focus ring in paddy green.
- Status is always an icon plus a label, never color alone.
- Text pairs in the palette meet WCAG AA (4.9:1 or more, for example muted on background 5.3:1, white on primary 6.1:1).
- Kopdes and Farmer screens use 18 px body text on phones.
- Semantic headings, a skip link, labels on every input, tables with header cells, and a table view for every chart.
- `lang` attributes on mixed-language text, and reduced motion is respected.
- Layouts work at phone width without horizontal page scroll. Wide tables scroll inside their card.
- Lighthouse accessibility scores 100 on all 17 screens (production build, Lighthouse 13.5 with its default mobile emulation, checked October 2026).

## Model notes and known limitations

- **Fixed demo clock.** The demo date is Monday 26 October 2026 (`DEMO_TODAY` in `src/engines/time.ts`), shown in the header as "Demo date". All dates are handled in UTC so the demo behaves the same in every time zone. Week 0 is the week of 26 October. Planning weeks 1 to 8 run from Monday 2 November to Friday 25 December 2026, and Christmas Day (Friday 25 December, week 8) is the one seeded school holiday. The menu follows a 4-week cycle of 20 school days.
- **Menu Switch hard constraints.** Protein at least 95% of the original, energy within plus or minus 10%, raw-food cost per portion at most Rp8,000 (small portion) or Rp10,000 (large), the same main protein at most 2 days per week, and the switch day at least 3 days ahead. Candidates must also be in the same food group, avoid the kitchen's excluded allergens, not replace a locked dish, and have enough local supply. Protein and energy are measured on the **whole portion** (every dish of the day) for both portion sizes, and for protein dishes also on the swapped component itself. All thresholds are editable in Settings > Thresholds.
- **Staple adjustment.** Protein foods are re-portioned so protein matches the original (nearest 5 g). Vegetables and fruit are swapped weight for weight. Skin-on chicken (TKPI) is far richer in energy than fish, so when lean fish replaces it, a protein-matched swap can fall outside the energy rule. The engine then adjusts the staple (rice) by **up to 40 g** per portion to bring energy back to the original. The adjustment is part of the suggestion, shown in its explanation and re-checked against every rule.
- **Menu Switch score.** Local supply 35%, cost saving 25%, nutrition closeness 25%, child acceptance 15% (from Plate Feedback, 0.7 when there is no data). A person always approves.
- **Commitments.** Seed commitments cover planning weeks 1 to 6, so weeks 7 and 8 are mostly open (red on the board) by design. Eggs for Kopdes Sumbangsari are deliberately short in weeks 3 to 6 (62% covered): that is the gap Demo Mode resolves.
- **Simulation Lab.** A deterministic, seeded model with stated assumptions (baseline buys 15% through the Kopdes at spot price; default shocks: chicken from Rp35,000 to Rp42,000 in week 3, a 25% egg shortfall in week 5 and a 40% kangkung surplus in week 6). It always runs on the original seed data. It shows the direction and size of effects under those assumptions, not a forecast of real outcomes.
- **History is fictional.** Deliveries, payments and Plate Feedback for weeks -4 to -1 are generated from a fixed seed, so forecast accuracy (MAPE) is measured against fictional data.
- **Map.** OpenStreetMap tiles need internet. When offline or when tiles fail to load, the Regency dashboard switches to the list view. Coordinates are approximate.
- **WhatsApp is simulated.** No message is sent anywhere. Phone numbers are masked and fictional.
- **No login, one browser.** Roles are picked on the landing page. Data lives in one browser and is not shared between devices. The Payment Clock records status only, no money moves, and "financing-ready" describes a possible future integration. PiringTani is not connected to BGN or any government system.

## Credits and licenses

- **Developer:** Badr Aleen Al-kazan.
- **Plus Jakarta Sans** by Tokotype, SIL Open Font License 1.1.
- **Map data** © OpenStreetMap contributors, available under the Open Database License (https://www.openstreetmap.org/copyright). Tiles come from tile.openstreetmap.org under the OSM Foundation tile usage policy, which suits a demo but not heavy production traffic.
- **Data sources.** Nutrition: TKPI 2017, Kemenkes (https://www.panganku.org), still to verify. Prices: placeholders, to be replaced with PIHPS, Bank Indonesia (https://www.bi.go.id/hargapangan). Facts: Liputan6, ANTARA, ANTARA Jateng, RCTI+ / Okezone, iFakta, detikJateng, Tirto (BGN), BGN, Jurnal Litbang Provinsi Jawa Tengah and Planalto (Brazil). Each one is linked in `src/content/facts.ts` and in Settings > Data sources.
- **Libraries.** Next.js, React, Recharts, Zustand, Radix UI, Tailwind CSS, html-to-image, clsx, tailwind-merge and tw-animate-css (MIT); Lucide icons and qrcode.react (ISC); Leaflet (BSD-2-Clause); React Leaflet (Hippocratic License 2.1); class-variance-authority (Apache-2.0).
