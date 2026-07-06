# Prompt history — Release Scorecard Dashboard

This is the chronological prompt-by-prompt log of how the tool was built.
Each row is one user instruction and a one-line summary of what it produced.

| #  | Prompt (verbatim or summarised) | Output |
| -- | --- | --- |
| 1  | "I need a tool to publish the release scorecard on a dashboard, fetch from CSV …" — picked **Streamlit** | `publish_release_scorecard.py` (single-file Python dashboard reading `release_scorecard.csv`) |
| 2  | "install and launch the dashboard and also create a readme" | `pip install streamlit plotly`, server up on `:8501`, `README.md` written |
| 3  | "add one button to download the whole scorecard as pdf" | `build_pdf()` + Streamlit `st.download_button` using reportlab |
| 4  | "command to stop and free the port" | `lsof … | xargs kill` recipe |
| 5  | "generate a scorecard csv for following: Customer / Build versions / SQA Bugs / CAPA / Automation… Project DHL Figgs" | `generate_dhl_figgs_scorecard.py` + `dhl_figgs_scorecard.csv` (23-column DHL schema) |
| 6  | "modify publish scorecard for dhl_figgs_scorecard.csv …" + KeyError on upload | Streamlit dashboard made **schema-aware** — auto-detects columns, skips missing sections, KPIs adapt |
| 7  | "create a new folder and then follow the project plan" (9-phase plan referencing JIRA, scorecard engine, React, PDF, Docker) | Built **release-dashboard/** — Node/Express API + React SPA + ingestCSV script + Dockerfile + docker-compose |
| 8  | PDF download came back damaged | Fixed `puppeteer.page.pdf()` returning `Uint8Array`; wrapped with `Buffer.from(pdf)` |
| 9  | "i have added a new csv to data but it is not showing" | Added **auto-ingest on server start** + `fs.watch` on `data/` with debounced re-parse |
| 10 | "i need to see all release scorecards" | New `GET /api/releases`, `AllReleases.jsx` grid view, `ReleasePicker` pills |
| 11 | "i need a simplified way of uploading data … JIRA IDs as links" | `sample_release_simple.csv`, `data/README.md`, `POST /api/upload`, `GET /api/config`, `GET /api/sample/release-csv`, JIRA badges on `IssueCard` |
| 12 | "I want a UI interface where user enters details and clicks Generate" | `NewReleaseForm.jsx`, `POST /api/releases`, shared `jsonToCsvConverter` |
| 13 | "push this code to the branch" | Initial commit `f6d734d` pushed to `origin/main` (later squashed into the feature commits) |
| 14 | "show the attached JIRA as a table with id, summary, status" | `JiraIssuesTable.jsx`, server `fetchIssuesByIds()` via `issuekey in (…)` JQL, `POST /api/jira/issues` |
| 15 | "Update the GreyOrange logo on top" | `Logo` component in `App.jsx` — tries `/logo.svg` → `/logo.png` → text wordmark |
| 16 | "remove the Published / Release Manager line next to the logo" | Stripped that block from the nav header |
| 17 | "provide an option to edit the created scorecard" | `PUT /api/releases/:id` (deletes old CSV on rename), `/projects/:id/edit` route, edit-aware `NewReleaseForm`, `Edit` button on `ProjectHeader` |
| 18 | "for Apotek 5 critical bugs but score shows 0" | Inverted-metric cap raised 5 → 20 for `criticalBugsOpen` and `escapedDefects` |
| 19 | "Critical Bugs row in Score Breakdown not displaying" | Added per-row labels: `92 (raw: 92)` for filled, `no data` for null |
| 20 | "on exporting PDF I want the JIRA table also displayed" | `window.__pdfReady` signal + `page.waitForFunction(...)` in `pdf.js` (replaces `networkidle0`) |
| 21 | "below Team Learnings add a section like JIRA Issues for stories" | Second `JiraIssuesTable` instance with `storyIds` data + `title` prop |
| 22 | "rename Stories to CAPA Actions, move below Team Learnings" | Heading + table title relabel, form section moved, CSV column → `CAPA Action IDs` (legacy `Story IDs` still parses) |
| 23 | "show me logic of Score Breakdown" | Walkthrough only (no code change) |
| 24 | "I want to host this tool on a VM" | Deployment guide for Docker + bare-Node + PM2 + nginx + TLS |
| 25 | "add a section next to Scorecard with Total / New Requirements / Duplicates / Leaks / TBD matrix" | `BugClassification.jsx` matrix card; parser, JSON converter, form, ProjectView layout all wired |
| 26 | "bug classification is not coming in the Generated PDF report" | Diagnosed as stale `dist/` + mock-data fallback; rebuild path documented |
| 27 | "push these changes to branch" | Commit `2932554` pushed to `origin/main` |
| 28 | "Give me a table of all the prompts … and a replication script" | This file + `replicate.sh` |

## Recurring side-quests (interleaved with the numbered turns)

- Frequent "kill the server / free :3000" — single `lsof | awk | xargs kill` one-liner ran several times.
- Several "task-notification: background command exited 143" — benign SIGTERMs from those kills; no action required.
- Date drift between sessions — annotated automatically by the runtime; no semantic effect.

## Architecture deltas captured per turn

| Layer | Significant changes (cumulative) |
| --- | --- |
| **Server (Express)** | CSV ingest + watcher; weighted 0–100 scorecard; CRUD on releases; JIRA client (filter ID, JQL template, post-2025 `/search/jql` endpoint); puppeteer PDF with ready-signal wait; JSON ↔ CSV converter; static-serve built SPA |
| **Frontend (React + Tailwind)** | All Releases grid; Project View with ScoreRing / BugClassification / MetricsGrid / ScoreBreakdown / StageBreakdown / HistoryChart / JiraIssuesTable (×2) / RCA-CAPA cards / TeamLearnings; NewReleaseForm (create + edit); ReleasePicker; UploadCsv; Logo |
| **Data model** | Release record: identity + metrics + 3-stage bug counts + bug classification matrix + issues + team learnings + JIRA + CAPA Action IDs |
| **Scoring** | 5-dim weighted model with renormalisation over available inputs; inverted-metric cap configurable in `INVERTED_CAPS` |
| **Deploy** | Dockerfile (node:20-alpine + system Chromium), docker-compose with optional Redis, VM walkthrough |
