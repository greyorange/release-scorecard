# Requirements Traceability Table — Release Scorecard

Maps user feedback items (1–15) to current implementation state and planned modifications.

| # | Feedback Point | Current State | Planned Modification | Components Affected | Data Model Changes | Timeline |
|---|---|---|---|---|---|---|
| 1 | **Scorecard should measure "quality of the release"** | Generic 5-factor weighted model (test pass rate, automation, bugs, escaped defects, SLA). No explicit "quality" definition. | Define and document quality dimensions: (a) Process adherence (SOPs, timelines), (b) Bug escape metrics (leakage count), (c) Feature delivery (gaps vs. requirements). Add quality certification field to scorecard. | `server/scorecard.js` (enhance breakdown labels), `src/components/ScoreRing.jsx` (show quality badge), `ProjectView.jsx` (quality summary). | Add `qualityDimensions` object to scorecard breakdown with sub-scores for process/bugs/features. | Phase 1 |
| 2 | **Answer: "Did we follow proper SOPs and timelines?"** | SLA adherence is one of 5 metrics. No SOP checklist or timeline verification. | Add SOP compliance tracking: release checklist fields (sign-off, approval gates, pre-release validation). Track planned vs. actual release dates. Surface timeline gaps in UI. | `NewReleaseForm.jsx` (add SOP checklist section), `MetricsGrid.jsx` (show SOP pass/fail), new `SopCompliance.jsx` component. `server/csvParser.js` (parse SOP fields). | Add `sopCompliance: { planDate, actualDate, approvals: [], validations: [] }` to release schema. | Phase 1 |
| 3 | **Answer: "Did we leak any bugs?"** | Bug counts tracked (critical, total, escaped defects). No explicit bug leakage analysis per stage. | Calculate stage-to-stage leakage rates: bugs that escaped from SQA to SIT, SIT to Prod. Track "blame attribution" — which stage let it through. Expose leakage % in scorecard. | `StageBreakdown.jsx` (add leakage % column), new `LeakageAnalysis.jsx` component, `server/scorecard.js` (compute leakage metrics). | Add `leakageMetrics: { sqaToSit: %, sitToProd: %, attribution: [] }` to stages. | Phase 1 |
| 4 | **Answer: "Did the release deliver expected functionality?"** | No feature/requirement tracking. Only test pass rate and automation coverage as proxy. | Add requirement checklist: list of planned features/stories vs. delivered. Track incomplete/deferred items. Calculate delivery gap %. | `NewReleaseForm.jsx` (requirements table section), `MetricsGrid.jsx` (add "Features Delivered" row), `server/csvParser.js` (parse requirement fields). | Add `requirements: { planned: [], delivered: [], deferred: [] }` with status per feature. | Phase 1 |
| 5 | **Share RCAs, CAPAs, and owners for gaps found** | RCA & CAPA cards shown (mock data). JIRA integration for issue linking. No bulk export or audit trail. | Auto-link RCAs to bug leaks and SOP failures. Show CAPA owner + due date prominently. Add CAPA completion tracking. Allow bulk export (RCA/CAPA matrix). | `IssueCard.jsx` (enhance ownership display), `TeamLearnings.jsx` (link to JIRA), new `CapaTracker.jsx`, `RcaMatrix.jsx` components. PDF export updated. | Add `rcaOwner`, `capaOwner`, `completionDate`, `status: [open, in-progress, closed]` to issues/capa objects. | Phase 2 |
| 6 | **Categorise releases into different type buckets** | All releases treated the same. No release type/category field. | Add release type enum: `major`, `minor`, `hotfix`, `patch`, `weekly`. Bucket releases by type in All Releases view. Apply type-specific scoring rules. | `NewReleaseForm.jsx` (add release type dropdown), `AllReleases.jsx` (group by type), `server/scorecard.js` (type-aware weights), `ProjectHeader.jsx` (show type badge). | Add `releaseType: enum [major, minor, hotfix, patch, weekly]` to release schema. | Phase 1 |
| 7 | **Organise releases hierarchically (major contains weeklies, etc.)** | Flat list of releases. Release picker shows all. No parent-child links. | Add release hierarchy: major versions have child minor/weekly releases. Support release series (e.g., v3.5.0 contains v3.5.0-wk01, v3.5.0-wk02). UI shows tree view or grouped timeline. | `AllReleases.jsx` (hierarchical tree view), `ReleasePicker.jsx` (nested pill groups), `server/store.js` (parent-child relationships), new `ReleaseHierarchy.jsx`. | Add `parentReleaseId`, `childReleases: []` to release schema. New index by series/parent. | Phase 2 |
| 8 | **Publish a release score for each release line item** | Score calculated and shown. Stored in scorecard object. No versioning or historical snapshots. | Ensure every release always has a score. Lock scores at defined calculation time (not live). Add score version/timestamp. Show score on All Releases grid. | `AllReleases.jsx` (add score column with color coding), `server/scorecard.js` (add calculated timestamp), `store.js` (persist score with release). | Add `scorecard.calculatedAt` (ISO timestamp) and `scorecard.version` to release. | Phase 1 |
| 9 | **Score should consider: leakages, timelines, product/solution gaps** | Current factors: test pass rate, automation, bugs, escaped defects, SLA. Weights: 25/20/20/20/15. | Reweight to emphasize: (a) Leakage rate (stage escapes), (b) Timeline adherence (plan vs. actual), (c) Requirement delivery gap (features vs. plan). New weights: leakage 25%, timeline 20%, features 20%, automation 15%, quality/bugs 20%. | `server/scorecard.js` (implement new weights), breakdown calculations updated, `ScoreBreakdown.jsx` (show new factors). | Scorecard breakdown: replace direct metrics with derived leakage/timeline/gap calculations. | Phase 1 |
| 10 | **Define how to attribute leaked issues to specific releases** | Bugs are counted per stage. No cross-release attribution (a Prod bug from v3.4 may be counted in v3.5 scorecard). | Implement bug attribution rule: a bug is attributed to the release where it was injected (root cause release), not where it was found. Track injection date and discovery date separately. Add release-to-release traceability. | `server/jira.js` (enhance JIRA sync to capture injected/discovered dates), `IssueCard.jsx` (show both dates), `StageBreakdown.jsx` (show injected release). CSV parser adds injection tracking. | Add `bug: { injectedInRelease, discoveredInRelease, injectionDate, discoveryDate }` fields. New store query for "bugs injected in this release". | Phase 2 |
| 11 | **Handle: bug found today may have been injected weeks ago (correct attribution)** | Current: bugs counted in release where found. No injection traceability. | Trace bug lifecycle: when was code committed, when did the feature branch merge, when was release cut, when was bug discovered. Attribute to **injection release** (where code entered), not discovery release. Requires JIRA + Git integration. | `server/jira.js` (parse commit dates from JIRA issue links), new `BugAttribution.jsx` (show injection timeline), `IssueCard.jsx` (show injected vs. found dates). | Add `injectionDate`, `injectionRelease`, `discoveryDate`, `discoveryRelease` to bug schema. Optionally link to git commit SHAs. | Phase 2 |
| 12 | **Define when scores are calculated (not open-ended)** | Scores calculated on-demand (every page load, every fetch). No fixed calculation point. | Freeze score at specific release milestones: at end of release week or `T+0` (release cut). Record calculation timestamp. Do not recalculate retroactively. Allow score **rollback** to a previous snapshot if bugs are reclassified. | `server/scorecard.js` (add `calculatedAt`, `frozenAt` fields, block recalc), `ProjectHeader.jsx` (show "score locked on [date]"), API endpoint to retrieve score at specific date. | Add `scorecard.frozenAt: ISO timestamp`, `scorecard.isLocked: boolean`. Add historical score log per release. | Phase 2 |
| 13 | **Use time-based criterion (1 week post-release)** | No time-based scoring criterion. Scores include all data at query time. | Define score calculation window: take snapshot at T+7 (1 week post-release). All bugs found within 7 days count toward release. Bugs found after day 7 don't affect score (attributed to next release). | `server/scorecard.js` (check release date + 7 days window), `NewReleaseForm.jsx` (capture release timestamp), `MetricsGrid.jsx` (show "as of day 7"). | Add `releaseDate`, `scoreSnapshotDate: releaseDate + 7d` to release. Validate all bug discovery dates against window. | Phase 1 |
| 14 | **Show score snapshots at 24h, 72h, 1w, 2w post-release** | Single score per release. No historical snapshots. | Calculate and store scorecard snapshots at T+24h, T+72h, T+7d, T+14d. Show as timeline/chart. Allows tracking "how did score evolve". Build snapshots automatically on release creation. | New `ScoreEvolution.jsx` component (line chart of scores over time), `HistoryChart.jsx` (extended to show score curve), `server/store.js` (new snapshots table/array). API to query snapshots by release. | Add `scoreSnapshots: [ { timestamp, score, breakdown } ]` array to release. Server generates entries at T+1d, T+3d, T+7d, T+14d. | Phase 2 |
| 15 | **Separate reporting for automation readiness, ongoing health, etc.** | Single scorecard view. No segmented reporting by aspect (automation, SOP, stability, etc.). | Create separate score views: (a) **Automation Readiness** (automation coverage, test pass rate), (b) **Release Health** (bugs, leakage, timelines), (c) **SOP Compliance** (approvals, checklists, sign-offs), (d) **Feature Delivery** (requirements met, gap %). Show all 4 in tabs. | New `ScoreTabs.jsx` (show Automation / Health / Compliance / Features), separate score calculations per aspect, `server/scorecard.js` (compute 4 independent breakdowns). | Add `scorecard.automation`, `scorecard.health`, `scorecard.compliance`, `scorecard.features` sub-scores. Maintain backward-compatible `scorecard.score` (composite). | Phase 2 |

---

## Summary

### Phase 1 (Immediate – Core Structure)
- Items 1, 2, 3, 4, 6, 8, 9, 13
- Focus: Add SOP/timeline/leakage tracking, release categorization, score locking, time-window calculation
- Files touched: `scorecard.js`, `csvParser.js`, `NewReleaseForm.jsx`, `MetricsGrid.jsx`, `StageBreakdown.jsx`, `store.js`
- New schema: SOP compliance, leakage metrics, requirements, release type, score timestamp

### Phase 2 (Enhanced – Traceability & Reporting)
- Items 5, 7, 10, 11, 12, 14, 15
- Focus: Bug attribution across releases, hierarchical release structure, score snapshots, multi-aspect scoring
- Files touched: `jira.js`, `IssueCard.jsx`, `AllReleases.jsx`, PDF export, new tabs component
- New schema: Injection vs. discovery dates, parent-child release links, score snapshots, per-aspect scores

### Data Model Evolution
**Core Release Object** gains:
- `releaseType: enum`
- `parentReleaseId, childReleases: []`
- `sopCompliance: { planDate, actualDate, approvals, validations }`
- `leakageMetrics: { sqaToSit, sitToProd, attribution }`
- `requirements: { planned, delivered, deferred }`
- `scorecard.calculatedAt` (Phase 1), `scorecard.frozenAt` (Phase 2)
- `scorecard.snapshots: []` (Phase 2)
- `scorecard.automation, health, compliance, features` (Phase 2)

**Bug Schema** gains (Phase 2):
- `injectionDate, injectionRelease`
- `discoveryDate, discoveryRelease`
- `capaOwner, completionDate`

---

## Implementation Notes

1. **Backward Compatibility**: New fields are optional; existing releases without them score successfully with available inputs.
2. **CSV Parser**: Extend to recognize new column headers; map to schema fields.
3. **UI Fallback**: If injection data unavailable, use current logic (discovery-based).
4. **Snapshot Automation**: Cron job or on-access lazy calculation to populate score snapshots.
5. **Bug Attribution**: Requires JIRA + Git metadata; graceful degradation if unavailable.

---

## Verified Implementation Status (2026-08-17)

The table above documents what was *planned*. This section documents what
was actually checked against the running code — several items marked
"Complete" in `IMPLEMENTATION_COMPLETE.md` turned out to be built but never
wired into a route or page (dead code that silently did nothing). Status
below reflects the real, verified state, branch `Relase_Scorecard_Shivang`,
commit `b3e1f4b` — **none of this is in `main` yet**.

| # | Feedback point | Status | Fixed in (commit) | Notes / real gap |
|---|---|---|---|---|
| 1 | Define "quality of release" | ✅ Done | `main` (`6122169`) | `qualityDimensions` in `server/scorecard.js` |
| 2 | SOP & timeline checklist | ✅ Done | `main` (`6122169`) | `SopCompliance.jsx` |
| 3 | Bug leakage per stage | ✅ Done | `main` (`6122169`); UI trimmed in `54786ce` | Aggregate leakage % + badge only — no per-bug "which stage let it through" list |
| 4 | Feature delivery vs. plan | ✅ Done | `54786ce` | `FeatureDelivery.jsx` — was in the schema/form but nothing rendered it before |
| 5 | RCA/CAPA sharing + owner/due-date + CAPA completion tracking + bulk export | 🟡 Partial | `b3e1f4b` | Added `status` (open/in-progress/closed) + `completedDate` end-to-end, and a client-side CSV export button. Missing: an audit trail (who changed status/when — needs a new change-log store) and a true cross-project bulk export (current export is per-release, client-side only) |
| 6 | Bucket releases by type | ✅ Done | `b3e1f4b` | Filter chips (major/minor/hotfix/patch/weekly) on All Releases, with live counts |
| 7 | Hierarchical releases (major → weeklies) | ❌ Not wired | — | `server/releaseHierarchy.js` + `ReleaseHierarchy.jsx` exist but are never imported by any route or page; the form has no way to set `parentReleaseId` either |
| 8 | Score locked at calc time + versioned | 🟡 Mostly done | `b3e1f4b` | Score locks once the 7-day observation window closes, persisted independent of later JIRA syncs, with a live/locked toggle in the UI. "Versioned" in the original sense (per-release scoring-algorithm history) isn't implemented — only a global v1/v2/v3 switch exists in `rollbackControl.js` |
| 9 | Reweight toward leakage/timeline/features | ✅ Addressed | `main` (`6122169`) | Final split (SOP 25/Product Quality 40/Features 20/Automation 15) differs from this doc's original sketch but addresses the same intent |
| 10 | Bug injection-vs-discovery attribution | ❌ Not wired | — | `server/bugAttribution.js` + `BugAttribution.jsx` exist but are never imported by any route or page |
| 11 | Correct cross-release attribution | ❌ Not wired | — | Same module as #10; would need JIRA + git commit metadata to do properly |
| 12 | Score calculated at a fixed point, not open-ended | ✅ Done | `b3e1f4b` | `finalizeScore()` (already written in `phase2-scorecard.js`) is now actually called |
| 13 | T+7d scoring window | ✅ Done | `b3e1f4b` | Same mechanism as #12 |
| 14 | Score snapshots at 24h/72h/1w/2w | ✅ Done | `b3e1f4b` | Real snapshots persisted as each mark passes; `ScoreEvolution.jsx` now rendered on the release page (previously built but never imported). Limitation: a release whose marks already elapsed before this shipped gets all 4 captured at once with identical, up-to-date (not historical) values — flagged explicitly in the UI |
| 15 | Independent Automation/Health/Compliance/Features tabs | ✅ Done | `54786ce` | `calculateAspectScores()` existed but `server/index.js` never called it — the tabs were rendering with empty data on `main` |

**Tally: 10 of 15 fully done, 2 partial (5, 8), 3 still disconnected (7, 10, 11).**
All of the above lives only on `Relase_Scorecard_Shivang` — pushed to
`origin/Relase_Scorecard_Shivang`, not merged into `main`.
