# Release Scorecard

A dashboard that scores each software release 0–100 based on process
compliance, test/bug quality, feature delivery, and automation — so a
release manager can see at a glance whether a release is **Go**,
**Conditional**, or **No-Go**, and why.

The app itself lives in [`release-dashboard/`](release-dashboard/). For
install/run commands, the API surface, CSV import, JIRA integration, and
deployment (Docker/PM2), see
[`release-dashboard/README.md`](release-dashboard/README.md). This file
is the user guide: how to use the dashboard day to day, what to fill in
the release form, and how the score is actually calculated.

## Running it

```bash
cd release-dashboard
npm install
npm run dev
```

Open **http://localhost:5173**.

## How to use the dashboard

- **All Releases** (home page) — every project as a card, showing its
  latest release's score, Go/Conditional/No-Go badge, release type,
  release count, date, and owner. Click a project to expand its full
  release history; click a release row to open its scorecard. Filter
  chips (**All / Major / Minor / Hotfix / Patch / Weekly**) bucket the
  list by release type, with live counts.
- **+ New Release** — opens the release form (below) to score a new
  release from scratch.
- **Edit** (inside a release) — reopens the same form pre-filled with
  that release's data. Editing and saving updates the record in place
  unless you change the Project Name or Version, which creates a new
  release id.
- **Upload CSV** — bulk-import releases instead of using the form one
  at a time. See the CSV schema in `release-dashboard/README.md`.
- **Sync JIRA** — re-fetches live bug/issue data from JIRA for that
  release (only does anything if JIRA is configured in `.env`).
- **Export PDF** — renders the current release's scorecard to PDF.
- **🔧 Rollback** — admin panel to compare scoring-model versions, take
  backups, and roll back if a scoring change misbehaves.
- **☀️/🌙 toggle** (top right) — switches light/dark theme; the choice
  is remembered.
- **🔒 Locked score / view live** (on a release page, once the 7-day
  observation window has closed) — the score locks at T+7d so it
  doesn't silently drift if a later JIRA sync changes bug counts. This
  toggle swaps to the live, recalculated-right-now value without
  leaving the page.
- **Score Evolution** — a timeline card showing the score at 1, 3, 7,
  and 14 days post-release, so you can see whether quality issues were
  caught early or late.

## What to fill in the New Release form

Only **Project Name** and **Release Version** are required — fill in
whatever else you have. Everything else is optional and simply lowers
that factor's weight in the score if left blank (see scoring below).

The form is organized into sections:

**Release Info**
| Field | What it's for |
| --- | --- |
| Project Name * | Groups releases together as one project (e.g. `DHL Figgs`) |
| Release Version * | e.g. `v1.0.0` — shown on the release tab/card |
| Customer Name | Optional, shown alongside the project name |
| Owner | Person responsible for this release |
| Release Type | `major` / `minor` / `hotfix` / `patch` / `weekly` |
| Planned Release Date | Original target ship date |
| Actual Release Date | When it actually shipped |

**SOP & Timeline Compliance** — four yes/no checkboxes: pre-release SOP
completed, release notes ready, signoff obtained, rollback plan ready.
Feeds the **SOP & Timeline Adherence** score factor together with how
close Actual Release Date was to Planned Release Date.

**Feature Delivery** — three comma-separated lists: Planned Features,
Delivered Features, Deferred Features (e.g. `Feature A, Feature B`).
Delivered ÷ Planned becomes the **Feature Delivery** score factor and
drives the Feature Delivery card on the release page.

**Score Metrics** — Test Pass Rate %, Automation Coverage %, MTTR
(hours). Test Pass Rate and Automation Coverage feed **Product
Quality**; Automation Coverage alone also drives the separate
**Automation Readiness** factor and tab.

**Bug Counts** — SQA Bugs, SIT Bugs, Production Bugs, Critical Bugs
Open. SQA→Production counts drive bug **leakage** (part of Product
Quality and the Bug Leakage Analysis card); Critical Bugs Open feeds
the inverted bug-metrics component of Product Quality.

**Bug Classification** — Total Bugs, New Requirements, Duplicates,
Leaks from Testing, TBD. Purely informational — populates the Bug
Classification matrix card; does not affect the score.

**JIRA Issues** — comma-separated JIRA IDs (e.g. `GM-1001, GM-1002`).
Renders as the Attached JIRA Issues table. Click **"Prefill RCA / CAPA
cards from JIRA"** to auto-fetch each issue's RCA/CAPA/severity/owner
from JIRA and fill in matching blank fields below — it only fills
blanks, so anything you've already typed is safe.

**RCA / CAPA Cards** — one card per issue: JIRA ID, Title, Severity
(critical/high/medium/low), Owner, Due Date, RCA (root cause), CAPA
(corrective action). These render on the release page grouped by
severity, worst first.

**Team Learnings** — Team, Note, Owner, Due Date. Freeform retro notes;
no scoring impact.

**CAPA Actions** — comma-separated JIRA keys, rendered as a separate
CAPA Actions table on the release page.

## How a release is scored

Every release gets an overall **Quality Score (0–100)** from four
weighted factors ([`server/scorecard.js`](release-dashboard/server/scorecard.js)):

| Factor | Weight | Based on |
| --- | --- | --- |
| **SOP & Timeline Adherence** | 25% | The 4 compliance checkboxes + how close actual release date was to planned (≥14 days late scores 0 on the timeline half) |
| **Product Quality** | 40% | Test Pass Rate + Automation Coverage (25%), Critical Bugs Open + Escaped Defects inverted — fewer is better (50%), and SQA→Production bug leakage rate — less leakage is better (25%) |
| **Feature Delivery** | 20% | Delivered features ÷ Planned features |
| **Automation Readiness** | 15% | Automation Coverage % on its own |

**If a factor has no data, it's skipped and the remaining factors'
weights are scaled up to fill the gap** — a release with only Test Pass
Rate filled in still gets a real score, just based on less information.

The final score maps to a recommendation:
- **≥ 80 → Go**
- **60–79 → Conditional**
- **< 60 → No-Go**

Alongside the overall Quality Score, the release page also shows four
**independent aspect scores** (Automation, Health, Compliance,
Features tabs) — these don't feed into the overall score, they're
separate lenses on the same data:

| Tab | What it measures |
| --- | --- |
| Automation | Automation Coverage % as-is |
| Health | `100 − (5 × Critical Bugs Open) − (3 × Escaped Defects)`, floored at 0 |
| Compliance | % of the 4 SOP checkboxes completed |
| Features | Delivered ÷ Planned features, same as the Feature Delivery factor above |

Fill in more fields → more accurate score. A release with only a title
and version will show `score: null` ("Not enough scoring inputs
available") until at least one factor has data.

## Feedback / feature-request status

15 improvement points were tracked against this tool (full detail in
[`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md)). Verified
against the running code — not just doc claims — as of this branch:

| # | Ask | Status | Fixed in |
| --- | --- | --- | --- |
| 1 | Define "quality of release" | ✅ Done | `main` |
| 2 | SOP & timeline checklist | ✅ Done | `main` |
| 3 | Bug leakage per stage | ✅ Done | `main` / `54786ce` |
| 4 | Feature delivery vs. plan | ✅ Done | `54786ce` |
| 5 | RCA/CAPA sharing + completion tracking + bulk export | 🟡 Partial | `b3e1f4b` |
| 6 | Bucket releases by type | ✅ Done | `b3e1f4b` |
| 7 | Hierarchical releases (major → weeklies) | ❌ Not wired | — |
| 8 | Score locked at calc time + versioned | 🟡 Mostly done | `b3e1f4b` |
| 9 | Reweight toward leakage/timeline/features | ✅ Addressed | `main` |
| 10 | Bug injection-vs-discovery attribution | ❌ Not wired | — |
| 11 | Correct cross-release attribution | ❌ Not wired | — |
| 12 | Score calculated at a fixed point | ✅ Done | `b3e1f4b` |
| 13 | T+7d scoring window | ✅ Done | `b3e1f4b` |
| 14 | Score snapshots at 24h/72h/1w/2w | ✅ Done | `b3e1f4b` |
| 15 | Independent Automation/Health/Compliance/Features tabs | ✅ Done | `54786ce` |

**10 of 15 fully done, 2 partial, 3 not yet wired.** All of this lives on
branch `Relase_Scorecard_Shivang` only — nothing here is in `main` yet.
See `REQUIREMENTS_TRACEABILITY.md` for the notes/gaps behind each row.
