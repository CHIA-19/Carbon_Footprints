# CarbonLite — Personal Carbon Footprint Tracker

> **"Log a few minutes of your day. We tell you your CO₂e impact in plain language, compare it to a relatable baseline, and give you one specific, doable action to do better tomorrow."**

CarbonLite is a lightweight, privacy-first web application that helps individuals understand, track, and reduce their personal carbon footprint through quick daily check-ins and personalised, rule-based insights. No signup, no backend, no installation — open a browser and start in under a minute.

---

## Table of Contents

1. [Chosen Vertical & Persona](#1-chosen-vertical--persona)
2. [How the Solution Works — User Journey](#2-how-the-solution-works--user-journey)
3. [Approach & Decision Logic (the Insight Engine)](#3-approach--decision-logic-the-insight-engine)
4. [Tech Stack & Why](#4-tech-stack--why)
5. [How to Run Locally](#5-how-to-run-locally)
6. [How to Run Tests](#6-how-to-run-tests)
7. [Emission Factor Methodology & Sources](#7-emission-factor-methodology--sources)
8. [Assumptions & Limitations](#8-assumptions--limitations)
9. [Security Notes](#9-security-notes)
10. [Screenshots](#10-screenshots)
11. [Credits & License](#11-credits--license)

---

## 1. Chosen Vertical & Persona

**Vertical:** Personal carbon footprint awareness and behaviour change.

**Persona: The Busy Urban Professional**

We chose this persona because it represents the largest underserved segment in sustainability tooling. This person:

- Commutes by car, metro, or rideshare; eats out frequently; shops online regularly
- **Wants** to reduce their footprint but finds existing tools overwhelming — they feel like spreadsheets, not apps
- Has **2–3 minutes per day** at most to engage with a tracking tool
- Is motivated by **progress and encouragement**, not guilt or lecture

The product is designed around one promise: **a 30-second daily check-in, not a lifestyle audit**. Every UX decision flows from this — steppers instead of text boxes, one insight instead of ten, one tip instead of a wall of advice.

---

## 🏆 Hackathon Submission Details

To directly address the evaluation criteria for **Problem Statement Alignment**:

### 1. Chosen Vertical
**Persona:** Environmentally conscious individual seeking actionable insights without complexity.
**Logic:** Most footprint calculators are overwhelming one-off questionnaires that cause fatigue. CarbonLite is designed for *daily retention*—a 30-second logger that uses transparent, rule-based logic (not black-box AI) to deliver exactly *one* highly targeted behavioural nudge per day based on real data.

### 2. Approach and Logic
- **No Black Boxes:** All calculations use static, transparent emission factors (e.g., DEFRA 2023, IEA) exposed in a single file (`src/data/emissionFactors.js`).
- **Context-Aware:** The onboarding asks for the user's country. The engine dynamically changes the electricity emission factor (e.g., 0.708 kg/kWh for India vs 0.011 kg/kWh for Norway), ensuring insights aren't based on inaccurate global averages.
- **Rule-Based Insights:** The `insightsEngine.js` analyses the current day's log against a 7-day rolling average to identify the most deviant category, then issues a deduplicated, contextually relevant nudge.

### 3. How the Solution Works
1. **Onboarding:** Sets a baseline (diet type, commute distance, household size, country grid intensity).
2. **Daily Logger:** A fast, form-based input that calculates emissions live as you type.
3. **What-If Simulator:** Interactive sliders allowing users to visualise the *annualised* CO₂e savings of lifestyle changes (e.g., swapping 3 meat meals a week, switching to renewable energy).
4. **Data Sovereignty:** 100% Offline-first Progressive Web App (PWA). All data lives in `localStorage`. Zero API calls, no signups, no trackers.

### 4. Assumptions Made
- We assume the user logs data once per day; multiple logs on the same day overwrite previous entries.
- Emission factors are based on standard global/UK averages (except electricity, which uses country-specific grid intensity).
- "A meal" is approximated at ~600 kcal for baseline dietary calculations.
- Long-haul flights are tracked as periodic "one-off" events outside the standard daily commute logic.

---

## 2. How the Solution Works — User Journey

```
┌──────────────────────────────────────────────────────────────────────┐
│  FIRST VISIT ONLY                                                    │
│                                                                      │
│  Onboarding (5 questions, ~60 seconds)                               │
│  ├─ Name (optional, for personalisation)                             │
│  ├─ Primary commute mode (car / EV / bus / train / bike / walk / ...) │
│  ├─ Diet pattern (meat-heavy / moderate / vegetarian / vegan)        │
│  ├─ Home energy type (grid / renewable / unsure)                     │
│  └─ Household size (to fairly split shared energy)                   │
│       ↓                                                              │
│  Profile saved to localStorage — used to personalise all tips        │
└──────────────────────────────────────────────────────────────────────┘
         ↓  (all subsequent visits)
┌─────────────────────────────────────────────┐
│  DAILY CHECK-IN (30 seconds)                │
│                                             │
│  Log 4 categories:                          │
│  ┌─ 🚗 Transport: mode + km today           │
│  ├─ 🍽️ Food: meat / poultry / veg / vegan meals + deliveries        │
│  ├─ ⚡ Energy: AC hours + optional kWh reading                      │
│  └─ 🛍️ Shopping: parcels / clothing / electronics                   │
│                                             │
│  Live CO₂e preview updates as you type     │
│  → "Save Today's Log"                       │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PERSONALISED INSIGHT (generated by the rule-based engine)          │
│                                                                      │
│  "Transport was your biggest footprint source today at ~8.5 kg      │
│   CO₂e — 60% above your recent daily average. Most came from       │
│   your 30 km car trip."                                              │
│                                                                      │
│  💡 "Carpooling with just one other person roughly halves your       │
│      per-person transport emissions for that trip."                  │
└─────────────────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                          │
│  ├─ 7-day bar chart (colour-coded vs Paris and global targets)      │
│  ├─ Category donut (transport / food / energy / consumption split)  │
│  ├─ Relatable equivalences ("≈ driving 340 km", "≈ 12 tree-days")  │
│  ├─ Weekly goal tracker (on track / biggest lever remaining)        │
│  └─ Streak & milestone badges                                       │
└────────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  GOAL SETTING                        │
│  Set a % reduction goal (5–50%)      │
│  → One-sentence status on each visit │
│  → Same insight engine identifies    │
│    your #1 lever for the week        │
└──────────────────────────────────────┘
```

---

## 3. Approach & Decision Logic (the Insight Engine)

This is the core of the submission. The insight engine lives entirely in [`src/scripts/insightsEngine.js`](src/scripts/insightsEngine.js) and implements **explicit, auditable, rule-based logic** — no AI, no black box.

### Decision Flow

```
INPUT: today's log + last 7-day logs + user baseline profile
  │
  ├─ RULE 1: Compute rolling 7-day averages per category
  │
  ├─ RULE 2: Is today's total < Paris daily budget (5.5 kg)?
  │           AND is it < 7-day average?
  │     ├─ YES → return POSITIVE REINFORCEMENT (praise, not a nag)
  │     └─ NO  → continue
  │
  ├─ RULE 3: Find TOP CATEGORY
  │           (whichever of transport / food / energy / consumption
  │            has the highest kg CO₂e today)
  │
  ├─ RULE 4: Compute DEVIATION from 7-day average for top category
  │           deviation % = ((today - avg) / avg) × 100
  │           → used to build the context sentence in plain English
  │
  └─ RULE 5: Select ONE TIP from the TIP BANK
               Filter criteria (ALL must pass):
               ├─ Tip category must match the top category
               ├─ Tip must NOT be in this week's shown-tip history
               │   (resets every Monday — stored in localStorage)
               └─ Tip must NOT be excluded by the user's profile:
                   • commuteMode = 'bike' → exclude cycling tip
                   • commuteMode = 'bus'  → exclude public-transit tip
                   • commuteMode = 'ev'   → exclude "get an EV" tip
                   • dietPattern = 'vegetarian' or 'vegan'
                                         → exclude meat-reduction tips
                   • energyType = 'renewable'
                                         → exclude "switch to green tariff" tip
               Fallback: if all category tips exhausted → pick any unseen tip
               Fallback²: if all tips seen → pick the best matching tip (week reset)

OUTPUT: { contextSentence, tipText, tipId, isPositive, category, deviation }
```

### Why this approach?

- **Transparent**: every decision is a readable `if/else` or array filter — judges can trace exactly why a particular tip was chosen
- **Respectful**: never suggests something the user already does (profile exclusions)
- **Non-repetitive**: suggestion history prevents the same advice appearing twice in a week
- **Encouraging**: deliberately falls back to positive reinforcement rather than only nagging

### Goal Tracking Integration

The goal tracker **reuses the same engine** — it calls `generateGoalNudge()`, which shares the same tip bank and profile filter, so there is no disconnected second system.

---

## 4. Tech Stack & Why

| Layer | Technology | Reason |
|---|---|---|
| App | Vanilla HTML5 / CSS3 / ES6 Modules | Zero build step; repo stays < 10 MB; loads instantly in any browser |
| Charts | [Chart.js 4.4.3](https://www.chartjs.org) (CDN, pinned version) | One lightweight lib, no bundle; pinned for reproducible demos |
| Storage | Browser `localStorage` | No backend risk; no credential leak; no GDPR concerns; all data stays on device |
| Fonts | Google Fonts (CDN): Outfit + Inter | Modern, professional typography without local font files |
| Tests | Node.js 18 built-in test runner (`node:test`) | Zero extra dependency; runs on any Node 18+ machine |
| Validation | Custom module (`src/scripts/validation.js`) | Whitelist + clamp approach for all user inputs |

**Why not React/Vue/Svelte?**  
The hackathon spec explicitly warns about the 10 MB repo size limit and prefers dependency-light builds. Vanilla ES modules deliver the same SPA experience with zero build tooling and a final repo size of ~180 KB — 55× smaller than a typical Vite/React scaffold.

---

## 5. How to Run Locally

### Requirements
- A modern browser (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)
- Node.js 18+ (only needed to run tests or the optional local server)

### Option A — With a local server (recommended)

ES module imports work best when served over HTTP rather than the `file://` protocol.

```bash
# 1. Clone or download the repo
git clone https://github.com/YOUR_USERNAME/carbon-footprint-platform.git
cd carbon-footprint-platform

# 2. Serve the src/ directory (uses npx, no install needed)
npx serve src/

# 3. Open in browser
#    → http://localhost:3000
```

Or, if you have Python installed:

```bash
cd src/
python -m http.server 8080
# Open → http://localhost:8080
```

Or use the [VS Code Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer): right-click `src/index.html` → "Open with Live Server".

### Option B — Direct file open

```bash
# Windows
start src\index.html

# macOS
open src/index.html

# Linux
xdg-open src/index.html
```

> ⚠️ Some browsers block ES module imports from `file://` URLs (CORS restriction). If the app shows a blank screen, use Option A.

### Expected behaviour on first load
1. The **onboarding overlay** appears — answer 5 quick questions (< 60 seconds)
2. You land on the **daily check-in form** — fill in your transport, food, energy, and shopping for today
3. Click **"Save Today's Log"** — you are taken to the **insights view** with a personalised tip
4. Click **"See full dashboard"** — charts, KPIs, and your goal tracker appear

---

## 6. How to Run Tests

```bash
# Requirements: Node.js 18 or higher
node --test tests/insightsEngine.test.js
```

Expected output: **55 tests passing, 0 failing** across 3 test groups:

| Group | What is tested | Test IDs |
|---|---|---|
| **A — Calculation functions** | Correct kg CO₂e for known inputs; zero/negative/NaN/Infinity edge cases; boundary clamping; graceful degradation on null inputs | A01–A28 |
| **B — Insight engine rules** | All 5 decision rules; positive reinforcement trigger; top-category identification for all 4 categories; profile exclusions for 6 user types; tip deduplication; deviation maths; weekly average computation | B01–B19 |
| **C — Validation & edge cases** | Infinity, NaN, null, undefined, negative inputs, string inputs, oversized values, missing profile | C01–C08 |

---

## 7. Emission Factor Methodology & Sources

> **All results are approximate estimates (~), not precise measurements.**  
> Carbon accounting is inherently complex; actual emissions depend on specific vehicle models, local electricity grid mix, agricultural practices, shipping distances, and many other factors not captured in daily logging. CarbonLite is an **awareness and behaviour-change tool**, not a certified carbon audit system.

All emission constants live in a single, fully commented file: [`src/data/emissionFactors.js`](src/data/emissionFactors.js). Judges can audit, question, or adjust every number in that file.

### Emission Factor Table

| Category | Item | Factor | Source |
|---|---|---|---|
| **Transport** | Petrol car | 0.170 kg CO₂e/km | DEFRA 2023 |
| | Diesel car | 0.156 kg CO₂e/km | DEFRA 2023 |
| | Hybrid car | 0.110 kg CO₂e/km | DEFRA 2023 |
| | EV (avg grid) | 0.047 kg CO₂e/km | DEFRA 2023 / IEA 2023 |
| | Bus | 0.089 kg CO₂e/km/pax | DEFRA 2023 |
| | Metro / Subway | 0.041 kg CO₂e/km/pax | DEFRA 2023 |
| | National rail | 0.035 kg CO₂e/km/pax | DEFRA 2023 |
| | Motorbike | 0.114 kg CO₂e/km | DEFRA 2023 |
| | Bicycle / Walking | 0.000 kg CO₂e/km | (zero direct emissions) |
| **Food** | Beef meal (~600 kcal) | 6.0 kg CO₂e/meal | Poore & Nemecek (2018), *Science* |
| | Chicken meal | 1.8 kg CO₂e/meal | Poore & Nemecek (2018) |
| | Vegetarian meal | 0.7 kg CO₂e/meal | Poore & Nemecek (2018) |
| | Vegan meal | 0.4 kg CO₂e/meal | Poore & Nemecek (2018) |
| | Delivery overhead | 0.7 kg CO₂e/order | Carbon Trust estimate |
| **Energy** | Grid electricity (world avg) | 0.436 kg CO₂e/kWh | IEA 2023 |
| | Renewable electricity | 0.020 kg CO₂e/kWh | Lifecycle estimate |
| | AC / Heating (per hour) | 0.654 kg CO₂e | 1.5 kW unit × grid factor |
| **Consumption** | Online parcel | 0.5 kg CO₂e | Carbon Trust est. |
| | New clothing item | 20.0 kg CO₂e | Lifecycle analysis avg |
| | Small electronics | 30.0 kg CO₂e | Lifecycle analysis avg |

### Baselines

| Reference | Value | Source |
|---|---|---|
| Global per-capita average | ~4,700 kg CO₂e/year (~12.9 kg/day) | Our World in Data (2022) |
| Paris 1.5°C target | ~2,000 kg CO₂e/year (~5.5 kg/day) | IPCC AR6 (2021) |

### Primary References
- **DEFRA 2023**: UK Government GHG Conversion Factors for Company Reporting — https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting
- **Poore & Nemecek (2018)**: "Reducing food's environmental impacts through producers and consumers", *Science*, Vol. 360, Issue 6392 — https://doi.org/10.1126/science.aaq0216
- **IEA 2023**: World Energy Statistics and Balances, Electricity grid intensity data — https://www.iea.org/data-and-statistics
- **Our World in Data (2022)**: CO₂ and Greenhouse Gas Emissions — https://ourworldindata.org/co2-and-greenhouse-gas-emissions
- **IPCC AR6 (2021)**: Sixth Assessment Report — https://www.ipcc.ch/report/ar6/wg1/

---

## 8. Assumptions & Limitations

| Assumption | Detail |
|---|---|
| **Global averages, not local** | Emission factors use world/UK averages. A user in a high-renewable-grid country (e.g. Norway) will have a lower actual electricity footprint than shown. |
| **localStorage, not real accounts** | MVP uses browser-local storage. Data is per-device and per-browser. This is intentional for the hackathon scope: no account system means no data security risk. A production version would require auth and encrypted server storage. |
| **One log per day** | The app supports one activity log per calendar day. Multiple log entries on the same day overwrite each other (last write wins). |
| **Meal size approximation** | "A meal" is treated as ~600 kcal. This is an average; actual footprint varies by portion size and specific dish. |
| **AC/Heating proxy** | We estimate 1.5 kW for a typical AC or space heater. Actual consumption varies widely by unit age, climate, and insulation. |
| **Household energy attribution** | Energy emissions are divided equally by household size. In reality, usage patterns differ by person. |
| **No aviation in daily logger** | Long-haul flights are periodic, not daily. The onboarding does not ask about flights; the logger focuses on daily commute patterns. |
| **No scope 3 / supply-chain** | Consumption factors cover only the most commonly purchased item types. Supply-chain emissions for individual products are not tracked. |

---

## 9. Security Notes

- **No hardcoded secrets or API keys** — the app requires no external APIs. There is no `.env` file. The CDN URLs (Chart.js, Google Fonts) are the only external calls, and they carry no credentials.
- **No PII collected** — the "name" field is an optional display hint stored locally only. It is never transmitted. All data lives in browser `localStorage` on the user's own device.
- **Input validation and sanitisation** — all numeric fields are clamped to realistic ranges (see [`src/scripts/validation.js`](src/scripts/validation.js)). String fields use whitelist matching. The display name is stripped of HTML tags to prevent XSS.
- **No backend** — there is no server to secure, no database to protect, no network requests with user data. The attack surface is the browser's own localStorage API.
- **`.gitignore`** — configured before the first commit to exclude `node_modules/`, `dist/`, `.env`, `.DS_Store`, editor folders, and large media files to keep the repo under 10 MB.
- **Repo audit**: run `git log --all --oneline` — there is only one branch (`master`) and one commit per phase. No secrets appear in any commit.

---

## 10. Screenshots

> Add screenshots to `docs/screenshots/` (keep files compressed, < 200 KB each).  
> Embed them here after capturing:

```markdown
![Onboarding flow](docs/screenshots/onboarding.png)
![Daily check-in form](docs/screenshots/logger.png)
![Insight card](docs/screenshots/insight.png)
![Dashboard](docs/screenshots/dashboard.png)
```

To capture screenshots during development, open the app at `http://localhost:3000` (after running `npx serve src/`) and use your browser's built-in screenshot tool or a screen-capture utility.

---

## 11. Credits & License

**Built for the Prompt Wars Hackathon — Carbon Footprint Awareness track.**

### Data Sources
- UK DEFRA GHG Conversion Factors 2023 (Crown Copyright)
- Poore & Nemecek (2018), *Science* — open-access lifecycle analysis
- IEA World Energy Statistics 2023
- Our World in Data — CC BY 4.0
- IPCC AR6 — open access

### Tools
- [Chart.js](https://www.chartjs.org) — MIT License
- [Google Fonts](https://fonts.google.com) — SIL Open Font License (Outfit, Inter)

### License

MIT License — see [LICENSE](LICENSE) for full text.

You are free to use, modify, and distribute this project with attribution.

---

*CarbonLite is an awareness tool. For certified carbon accounting, consult a professional auditor or use a methodology such as the GHG Protocol.*
