# CarbonLite — Personal Carbon Footprint Tracker

> **"Log a few minutes of your day. We tell you your CO₂ impact in plain language, compare it to a relatable baseline, and give you one specific, doable action to do better tomorrow."**

A lightweight, privacy-first web app for the **busy urban professional** who wants to reduce their carbon footprint without spreadsheets. Zero login, zero backend, zero tracking. Everything runs in your browser.

---

## 🚀 Quick Start

**No build step required.** Just open the file:

```bash
# Option 1 — Open directly in browser
open src/index.html   # macOS
start src\index.html  # Windows

# Option 2 — Serve locally (avoids ES module CORS restrictions in some browsers)
npx serve src/
# then open http://localhost:3000
```

> ⚠️ **Note on ES Modules:** Some browsers block `import` statements from `file://` URLs due to CORS. Use `npx serve src/` or the VS Code Live Server extension for the best experience.

---

## 📁 Project Structure

```
/
├── README.md                     ← You are here
├── .gitignore                    ← Excludes node_modules, .env, dist
├── LICENSE                       ← MIT
│
├── src/
│   ├── index.html                ← Single-page app shell (all views)
│   ├── styles/
│   │   └── main.css              ← Full design system (dark mode glassmorphism)
│   ├── scripts/
│   │   ├── app.js                ← Entry point, orchestrates all modules
│   │   ├── onboarding.js         ← 5-step first-time setup
│   │   ├── activityLogger.js     ← Daily log form + CO₂e calculation
│   │   ├── insightsEngine.js     ← 🧠 Rule-based decision logic (key module)
│   │   ├── dashboard.js          ← Charts, KPIs, goal tracking, milestones
│   │   └── storage.js            ← All localStorage reads/writes (single module)
│   └── data/
│       └── emissionFactors.js    ← All CO₂e constants with cited sources
│
├── tests/
│   └── insightsEngine.test.js    ← Unit tests for decision logic (Node 18+)
│
└── docs/
    └── screenshots/              ← .gitkeep (add screenshots for your submission)
```

---

## ✨ Features

### A. Lightweight Onboarding
Five quick questions (under 60 seconds) to build a **personalised baseline profile**:
- Primary commute mode (car type, EV, bike, walk, bus, train…)
- Diet pattern (meat-heavy → vegan)
- Home energy type (grid, renewable, unsure)
- Household size (to fairly attribute shared energy)
- First name (optional, for a friendlier UI)

Profile stored in `localStorage` — no account, no server.

### B. 30-Second Daily Check-in
Log across 4 categories with **steppers and dropdowns** (no free text):
- 🚗 **Transport** — mode + km travelled
- 🍽️ **Food** — meal types + food deliveries
- ⚡ **Energy** — AC/heating hours + optional kWh
- 🛍️ **Consumption** — parcels, clothing, small electronics

**Live CO₂e preview** updates as you fill in each field, with colour coding against the Paris target.

### C. 🧠 Personalised Insights Engine (Key Feature)
After each log, the rules engine:
1. **Finds your top category** (highest kg CO₂e today)
2. **Compares to your 7-day rolling average** for that category
3. **Checks your baseline profile** — never suggests "bike to work" to someone who already bikes, never suggests green energy to someone already on renewables
4. **Selects one non-repetitive tip** — tracks which tips were shown this week to avoid nagging with the same suggestion
5. **Falls back to positive reinforcement** when you're already doing well (below Paris daily budget)

See `src/scripts/insightsEngine.js` for the full, commented decision flow.

### D. Progress Dashboard
- 📈 **7-day bar chart** — colour-coded green/amber/red vs Paris & global averages
- 🍩 **Category donut chart** — weekly breakdown by transport/food/energy/consumption
- 📊 **Relatable equivalences** — "≈ driving X km", "≈ X days of tree absorption"
- 🔥 **Streak tracker** — consecutive days under your average (never guilt-framing)
- 🏅 **Milestones** — first log, 7-day streak, Paris-target week

### E. Weekly Goal Setting
- Set a % reduction goal (5–50%) from the global average baseline
- One-sentence status on every dashboard visit: on track or not
- **Same insight engine** identifies the one biggest lever left to hit the goal this week

---

## 🧮 Carbon Calculation Methodology

> All results are **estimates (~)**. Carbon accounting is complex; these figures use
> publicly available averages and are designed for awareness, not precision.

### Emission Factors — Sources

| Category | Factor | Source |
|---|---|---|
| Car (petrol) | 0.170 kg CO₂e/km | DEFRA 2023 |
| Car (diesel) | 0.156 kg CO₂e/km | DEFRA 2023 |
| Hybrid car | 0.110 kg CO₂e/km | DEFRA 2023 |
| EV | 0.047 kg CO₂e/km | DEFRA 2023 / IEA |
| Bus | 0.089 kg CO₂e/km/passenger | DEFRA 2023 |
| Metro/Train | 0.035–0.041 kg CO₂e/km | DEFRA 2023 |
| Beef meal | 6.0 kg CO₂e | Poore & Nemecek (2018), *Science* |
| Chicken meal | 1.8 kg CO₂e | Poore & Nemecek (2018) |
| Vegan meal | 0.4 kg CO₂e | Poore & Nemecek (2018) |
| Electricity (grid avg) | 0.436 kg CO₂e/kWh | IEA 2023 |
| Online parcel | 0.5 kg CO₂e | Carbon Trust estimate |
| New garment | 20.0 kg CO₂e | Lifecycle analysis avg |

**All constants live in `src/data/emissionFactors.js`** with inline source citations. This is the single auditable file judges can review.

### Baselines
- **Global average**: ~4,700 kg CO₂e/person/year (~12.9 kg/day) — Our World in Data 2022
- **Paris 1.5°C target**: ~2,000 kg CO₂e/person/year (~5.5 kg/day) — IPCC AR6

---

## 🧠 Insights Engine — How the Decision Logic Works

The engine in `src/scripts/insightsEngine.js` follows this explicit decision flow:

```
INPUT: today's log + 7-day logs + user profile
  │
  ├─ Is today < Paris daily budget AND < 7-day average?
  │     └─ YES → return positive reinforcement message (no nagging)
  │
  ├─ Find topCategory (transport | food | energy | consumption)
  │     └─ Whichever category has the highest kg CO₂e today
  │
  ├─ Compute deviation from 7-day average for topCategory
  │     └─ ((today - avg) / avg) × 100 %
  │
  ├─ Build context sentence (plain English summary of what drove today's number)
  │
  └─ Filter TIP_BANK:
        ├─ Must match topCategory
        ├─ Must NOT be in shownSuggestionIds (reset weekly)
        ├─ Must NOT be excluded by user's profile
        │     (e.g. commuteMode='bike' → exclude cycling tip)
        │     (e.g. dietPattern='vegan' → exclude meat-reduction tip)
        └─ Pick first eligible tip → return insight
```

This is fully rule-based, readable, and auditable. No ML.

---

## 🧪 Running Tests

```bash
# Requires Node.js 18+
node --test tests/insightsEngine.test.js
```

Tests cover:
- Positive reinforcement trigger (Rule 2)
- Correct top-category identification (Rule 3) — all 4 categories
- Profile exclusions (Rule 5) — bike, bus, vegetarian
- Tip deduplication (Rule 5)
- Deviation calculation (Rule 4)
- Multi-log average computation

---

## 🔒 Privacy & Security

- **No backend, no database, no server.** Everything runs 100% client-side.
- All data is stored in **browser localStorage** on your device only.
- No API keys, no secrets, no `.env` file needed.
- "Reset data" button clears everything from localStorage instantly.
- The repo contains no hardcoded credentials of any kind.

---

## 🛠 Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| App | Vanilla HTML/CSS/JS (ES modules) | Zero build step, repo stays tiny |
| Charts | Chart.js 4.4.3 (CDN) | One library, no bundle bloat |
| Storage | Browser `localStorage` | No backend risk, no credential leak |
| Fonts | Google Fonts (CDN) | Inter + Outfit — modern, clean |
| Tests | Node.js built-in test runner | No extra dependency |

---

## 📸 Screenshots

> Add compressed PNG screenshots to `docs/screenshots/` after running the app.

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

*Built for the Prompt Wars Hackathon — Carbon Footprint Awareness challenge.*
