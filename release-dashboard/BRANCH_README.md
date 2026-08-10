# Branch: `Relase_Scorecard_Shivang`

What this branch adds on top of `main`, and how to run it. For the full
app reference (API surface, CSV schema, score model, Docker/PM2
deployment) see [`README.md`](README.md) — this file only covers the
**delta**.

## What the app does (quick recap)

Release Scorecard ingests release data (CSV upload or the in-app form,
optionally live JIRA), scores each release 0–100 across weighted
factors, and renders a per-project dashboard: score ring, breakdown by
factor, RCA/CAPA issue tracking, team learnings, bug leakage, and PDF
export. Express API on port `3000`, React (Vite) frontend on `5173` in
dev.

## How to run

Same as `main` — nothing about the run process changed:

```bash
cd release-dashboard
npm install        # if not already done
npm run dev         # api (3000) + vite frontend (5173) together
```

Open **http://localhost:5173**. `/api/*` is proxied to the Express
backend automatically. For a production-style run:

```bash
npm run build
npm start           # → http://localhost:3000
```

JIRA sync is optional and configured via `.env` (see `.env.example`) —
unchanged from `main`.

## What changed vs `main`

25 files touched: 3 new, 22 modified — 1173 insertions / 188 deletions.
Grouped by theme:

### 1. Dark mode

The dashboard now has a full light/dark theme, dark by default.

- [`src/useTheme.js`](src/useTheme.js) *(new)* — `useIsDark()` hook;
  watches the `dark` class on `<html>` via a `MutationObserver` so
  non-CSS surfaces (Recharts, which takes colors as props, not CSS)
  can restyle live when the theme is toggled.
- [`src/App.jsx`](src/App.jsx) — adds a `ThemeToggle` slider (☀️/🌙) in
  the nav bar; persists the choice to `localStorage`.
- [`index.html`](index.html) — a pre-paint inline script applies the
  saved theme (default: dark) before first render, avoiding a flash of
  the wrong theme; also preloads the Inter font.
- [`tailwind.config.js`](tailwind.config.js) — `darkMode: "class"`,
  Inter font family, a `brand` (GreyOrange orange) color scale, brand
  box-shadows, and a `fade-up` entrance animation.
- [`src/index.css`](src/index.css) — the bulk of the diff (366 lines):
  dark-theme CSS variables/surfaces, a `.site-nav` sticky glass nav,
  `.text-gradient` brand heading treatment, and dark variants for every
  existing component class (`.card`, `.pill-*`, etc.).
- Dark-aware chart colors added to `ScoreBreakdown.jsx`,
  `HistoryChart.jsx`, and `StageBreakdown.jsx` via `useIsDark()`.

### 2. New: Feature Delivery card

[`src/components/FeatureDelivery.jsx`](src/components/FeatureDelivery.jsx)
*(new)* — renders the planned/delivered/deferred requirements lists
that the form and CSV already capture and the scorecard already scores
(the `featureDelivery` factor), but which nothing rendered before.
Shows a delivery-rate bar (delivered / planned). Wired into
[`ProjectView.jsx`](src/components/ProjectView.jsx).

### 3. RCA/CAPA cards grouped by severity

[`src/components/RcaCapaGroups.jsx`](src/components/RcaCapaGroups.jsx)
*(new)* — replaces the flat issue-card grid in `ProjectView` with cards
bucketed under Critical → High → Medium → Low → Unspecified, worst
first. Each group past 2 cards collapses behind a toggle — except when
`?print=true` (PDF export), where everything stays expanded so the
report is never truncated.

### 4. Bug Leakage Analysis simplified

[`src/components/LeakageAnalysis.jsx`](src/components/LeakageAnalysis.jsx)
— removed the `"X% leaked"` text under each stage arrow and dropped the
QA→SIT / SIT→Prod percentage summary box at the bottom. The
Good/Fair/Poor badges stay; the raw percentages are still computed
internally, just no longer printed twice.

### 5. Scorecard engine bug fixes

[`server/scorecard.js`](server/scorecard.js):
- `||` → `??` in several places — a genuine `0` (e.g. 0% test pass
  rate, or a ≥14-day timeline slip that should legitimately score 0)
  was previously being treated as "missing" and silently bumped back
  up to a default value.
- Bug-metrics averaging had an operator-precedence bug
  (`criticalScore || 50 + escapedScore || 50`, evaluated as `criticalScore
  || (50 + escapedScore) || 50`) — replaced with an explicit average
  over whichever signals are actually present.
- SQA→production leakage rate was reading `release.stages.sqa` as a
  raw number, but stage data is actually `{ total, product, ... }` —
  the arithmetic silently produced `NaN` and disabled the leakage
  factor. New `stageCount()` helper extracts the numeric total from
  either shape.

### 6. Phase-2 aspect scores wired into the API

[`server/index.js`](server/index.js) — every release response now also
computes `scorecard.aspectScores` (Automation / Health / Compliance /
Features) via `calculateAspectScores()` (already present in
`phase2-scorecard.js` on `main`, just not called anywhere yet). This is
what feeds the additional tabs in `ScoreTabs.jsx`.

### 7. Real JIRA custom-field mapping for RCA/CAPA

[`server/jira.js`](server/jira.js) — `main`'s RCA/CAPA read from
placeholder field names (`customfield_rca` / `customfield_capa`) that
don't exist on a real JIRA instance. This branch maps the actual
custom-field IDs (RCA, Dev/QA preventive-corrective action fields, QA
RCA category), adds an `adfToText()` converter (JIRA rich-text fields
come back as Atlassian Document Format, not plain strings), and merges
Dev + QA CAPA text into one labeled block.

### 8. "Prefill from JIRA" in the release form

[`src/components/NewReleaseForm.jsx`](src/components/NewReleaseForm.jsx)
— given a list of JIRA issue IDs, fetches each issue and fills in
blank RCA/CAPA/severity/owner/due-date fields on matching (or newly
appended) issue cards. Strictly additive — anything already typed by
hand is never overwritten.

### 9. Visual refresh: All Releases page

[`src/components/AllReleases.jsx`](src/components/AllReleases.jsx) —
gradient heading, pill-style meta chips (project count, release count,
owner, date), a health-colored accent stripe per project card, and a
hover "View" affordance. Purely visual — same data, same accordion
behavior.

### 10. Smaller styling/wording tweaks

`ProjectHeader.jsx`, `ScoreTabs.jsx`, `ScoreRing.jsx`, `ScoreEvolution.jsx`,
`RollbackControl.jsx`, `JiraIssuesTable.jsx`, `TeamLearnings.jsx` — brand
color (`brand-500` instead of `blue-600`) and dark-mode class updates,
plus a pluralization fix ("Finalizes in 1 day" vs "1 days").

## Files changed

```
release-dashboard/index.html                        20 ++--
release-dashboard/package-lock.json                  39 --- (lockfile churn only)
release-dashboard/server/index.js                    12 ++-
release-dashboard/server/jira.js                     63 ++++--
release-dashboard/server/scorecard.js                43 ++--
release-dashboard/src/App.jsx                        66 ++-
release-dashboard/src/components/AllReleases.jsx     86 +++--
release-dashboard/src/components/FeatureDelivery.jsx 98 ++++++ (new)
release-dashboard/src/components/HistoryChart.jsx    37 ++-
release-dashboard/src/components/JiraIssuesTable.jsx 33 ++-
release-dashboard/src/components/LeakageAnalysis.jsx 27 +--
release-dashboard/src/components/NewReleaseForm.jsx  104 +++-
release-dashboard/src/components/ProjectHeader.jsx   24 +-
release-dashboard/src/components/ProjectView.jsx     24 +-
release-dashboard/src/components/RcaCapaGroups.jsx   84 ++++ (new)
release-dashboard/src/components/RollbackControl.jsx 3 +-
release-dashboard/src/components/ScoreBreakdown.jsx  15 +-
release-dashboard/src/components/ScoreEvolution.jsx  3 +-
release-dashboard/src/components/ScoreRing.jsx       2 +-
release-dashboard/src/components/ScoreTabs.jsx       5 +-
release-dashboard/src/components/StageBreakdown.jsx  35 +-
release-dashboard/src/components/TeamLearnings.jsx   113 +++--
release-dashboard/src/index.css                      366 +++ (mostly new)
release-dashboard/src/useTheme.js                    23 ++ (new)
release-dashboard/tailwind.config.js                 36 ++
```

## Not changed

- API routes and their response shapes (aside from the additive
  `aspectScores` field).
- CSV schema, ingestion, PDF export mechanics, JIRA polling cadence.
- `main` itself — this work lives entirely on this branch; `main` is
  untouched and still at the same commit it was before this branch
  diverged.

## How to verify

```bash
npm run dev
# open http://localhost:5173, toggle the theme switch top-right
# open any project → check Feature Delivery card, grouped RCA/CAPA cards,
# and the trimmed Bug Leakage Analysis card
```
