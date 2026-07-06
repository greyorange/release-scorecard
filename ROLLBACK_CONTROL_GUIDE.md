# Rollback Control Panel — Admin Guide

The **Rollback Control Panel** is an operations/admin interface for managing the Release Scorecard Dashboard during phased feature rollouts, scoring algorithm changes, and emergency rollbacks.

**Access:** `http://localhost:3000/admin/rollback` (or your domain + `/admin/rollback`)

---

## Overview

The control panel provides 5 main tabs for managing the scorecard deployment:

1. **Feature Flags** — Enable/disable Phase 1 and Phase 2 features independently
2. **Score Versions** — Switch between v1 (legacy), v2 (new 3-factor), and v3 (future) scoring
3. **Backups** — Create and restore data snapshots
4. **Metrics** — Monitor system health, API performance, feature usage
5. **History** — Audit trail of all rollback actions

---

## Tab 1: Feature Flags

### What it does

Toggle individual scorecard features on and off without redeploying code. Changes take effect immediately.

### Phase 1 Features (Core Structure)

| Feature | Purpose | When to Enable |
|---------|---------|---|
| **USE_SOP_COMPLIANCE** | Track pre-release checks (approvals, sign-offs, rollback plans) | After testing SOP checklist form |
| **USE_LEAKAGE_METRICS** | Calculate bug escape rates per testing stage | After validating stage-to-stage bug counts |
| **USE_RELEASE_TYPE** | Categorise releases (major, minor, hotfix, patch, weekly) | Before first release with type data |
| **USE_TIME_WINDOW_SCORING** | Lock scores at T+7 (1 week post-release) instead of live | After confirming 1-week observation window |

### Phase 2 Features (Advanced Traceability)

| Feature | Purpose | When to Enable |
|---------|---------|---|
| **USE_BUG_ATTRIBUTION** | Attribute bugs to injection release (not discovery release) | After JIRA injection date integration |
| **USE_RELEASE_HIERARCHY** | Show releases in parent-child tree (major contains weeklies, etc.) | After testing hierarchical data model |
| **USE_SCORE_SNAPSHOTS** | Store score evolution at 24h, 72h, 7d, 14d post-release | After snapshot generation logic tested |
| **USE_FOUR_ASPECT_SCORING** | Show separate scores: Automation, Health, Compliance, Features | After 4-aspect breakdown validated |

### How to Use

1. Find the feature in Phase 1 or Phase 2 section
2. Click the toggle switch to **Enable** or **Disable**
3. Feature status updates immediately (no page reload needed)
4. Check **Metrics** tab to verify feature adoption

### Example Rollout Timeline

```
Day 1:  Enable USE_SOP_COMPLIANCE
        Monitor: no errors? Feature adoption > 10%?
        
Day 3:  Enable USE_LEAKAGE_METRICS
        Verify: bug leakage % values look reasonable?
        
Day 5:  Enable USE_RELEASE_TYPE
        Check: all new releases have a release type?
        
Day 7:  Enable USE_TIME_WINDOW_SCORING
        Validate: scores lock after 7 days?
        
Week 2: Begin Phase 2 features (same cadence)
```

### Rollback if Issues

If a feature causes errors:
1. Click the toggle to **Disable**
2. Check **History** tab to see when it was disabled
3. Post-mortem: identify root cause, schedule fix
4. Feature remains in code (disabled) until fix deployed

---

## Tab 2: Score Versions

### What it does

Switch which scoring algorithm users see on the dashboard. All versions calculate in parallel; you control which one displays.

### Available Versions

| Version | Factors | Release | Notes |
|---------|---------|---------|-------|
| **v1** | 5-factor (test rate, automation, bugs, escaped defects, SLA) | 2024-01-01 | Legacy. Original model. Deprecated but stable. |
| **v2** | 3-factor (SOP adherence, product quality, feature delivery) | 2026-06-01 | **ACTIVE.** Recommended. New quality focus. |
| **v3** | 4-aspect (Automation, Health, Compliance, Features tabs) | TBD | Future. Multi-view reporting. Not yet active. |

### How to Switch

1. Click **Switch** button next to the version you want
2. Confirmation dialog appears (prevents accidents)
3. Click **Confirm** — all users immediately see the new version
4. Old data is preserved (users can compare v1 vs v2)

### Score Comparison

The **Score Comparison** table shows how v1 and v2 scores differ for recent releases:

```
Release          | v1 Score | v2 Score | Δ
Apotek v3.2      |    82    |    75    | -7
DHL Figgs v4.1   |    70    |    78    | +8
Project Alpha    |    65    |    68    | +3
```

**High Δ values (>10):** Investigate. May indicate:
- Different weightings affecting the score
- New data (SOP compliance, leakage metrics) changing result
- Bug in score calculation

### When to Switch Versions

- **v1 → v2:** Once Phase 1 features are stable and stakeholders accept new model
- **v2 → v3:** Once Phase 2 features complete and 4-aspect reporting validated
- **Emergency → v1:** If v2 has critical bug; revert to known stable version

### Risk Mitigation

- Both v1 and v2 scores stored in each release record
- Users can toggle display: "Show v1 score" / "Show v2 score" comparison
- History tab logs all version changes with timestamps
- Switching does NOT recalculate scores (only changes what's shown)

---

## Tab 3: Backups

### What it does

Create point-in-time snapshots of `store.json` (all releases, CAPA entries, metadata). Restore if data is corrupted or a bad deployment happens.

### Backup Contents

Each backup includes:
- All release records (scores, SOP status, bug attribution, etc.)
- CAPA entries (RCA, corrective actions, owners)
- Release metadata (dates, types, hierarchy, etc.)
- Compressed JSON file (~1–10 MB depending on data volume)

### How to Create a Backup

**Manual:**
1. Click **+ Create Backup Now** button
2. Optional: enter a note (e.g., "Pre-Phase-2-rollout")
3. Backup is created immediately; appears at top of list

**Automatic:**
- Backups are also created before each restore (safety net)

### How to Restore a Backup

1. Find the backup in the list (newest first)
2. Click **Restore** button
3. Confirmation dialog: "This will overwrite current data"
4. Click **Confirm**
5. System automatically creates a pre-restore backup
6. Data reverted to snapshot time
7. Check **History** tab to see restore entry

### Example Scenario

```
2026-07-02 14:00  Deploy Phase 2 features
                  Enable USE_BUG_ATTRIBUTION
                  
2026-07-02 14:30  Bug found: bug attribution crashes on null dates
                  
ROLLBACK STEPS:
1. Go to Backups tab
2. Find "backup-2026-07-02T14-00" (pre-deployment)
3. Click Restore → Confirm
4. Current data auto-backed up as "backup-2026-07-02T14-35"
5. System reverted to 14:00 state
6. Disable USE_BUG_ATTRIBUTION feature flag
7. Investigate + fix bug
8. Re-deploy after fix tested
```

### Backup Retention

- Backups stored in `server/backups/` directory
- No automatic cleanup (disk space is operator's responsibility)
- Recommended: Keep last 7 days + 1 monthly archive
- If backups grow large: manually delete old ones via file system

---

## Tab 4: Metrics

### What it does

Real-time monitoring of scorecard health, feature usage, API performance, and system checks.

### Key Metrics

**Score Calculation Health**
- **Success Rate:** % of releases with a calculated score
- **Healthy:** >95%
- **Action if low:** Some releases missing required fields (SOP compliance, leakage, etc.)

**Feature Usage**
- **Phase 1 Releases:** # of releases with SOP/leakage data
- **Phase 2 Releases:** # of releases with hierarchy/bug attribution
- **Healthy:** Phase 1 >80%, Phase 2 >50% (after enablement)

**API Response Time**
- **p99 Latency:** 99th percentile response time (milliseconds)
- **Healthy:** <500ms
- **Action if high:** Database queries slow; check server load

**System Health Checks**

| Check | Status | Meaning |
|-------|--------|---------|
| Data Integrity | OK | Store.json valid; all releases parseable |
| Backup System | OK | Backups directory exists; backups available |
| Scoring Engine | OK | >80% of releases have scores |
| Phase 1 Features | OK | Some Phase 1 features enabled |

---

## Tab 5: History

### What it does

Audit log of all rollback actions: feature toggles, version changes, backups, restores.

### Log Entries

Each entry shows:
- **Icon:** 🚩 (feature), 📊 (version), 💾 (backup), ⏮️ (rollback)
- **Action:** What happened (e.g., "Enabled USE_SOP_COMPLIANCE")
- **Timestamp:** When it happened (UTC)
- **User:** Who did it (email or "system")
- **Reason:** Why (optional note)
- **Status:** Success or error

### Example History

```
⏮️  Restored from backup: backup-2026-07-02T14-00
    2026-07-02 14:35:22 UTC by ashish.r@greyorange.com
    Status: SUCCESS
    Reason: Bug attribution crash; pre-restore backup: backup-2026-07-02T14-35

🚩  Disabled feature: USE_BUG_ATTRIBUTION
    2026-07-02 14:35:05 UTC by ashish.r@greyorange.com
    Status: SUCCESS
    Reason: Null pointer in bug injection date parsing

📊  Changed scoring version to v2
    2026-07-01 09:00:00 UTC by ashish.r@greyorange.com
    Status: SUCCESS

💾  Created backup: backup-2026-07-01T09-00
    2026-07-01 08:55:00 UTC by system
    Reason: Pre-Phase-2-rollout
```

### Querying History

- **Most recent:** Shown at top
- **Search:** (not yet implemented; use browser Ctrl+F)
- **Export:** Copy history to external audit system (manual)

---

## Emergency Rollback Procedure

If a feature or version breaks scorecard:

### Step 1: Disable the Feature (5 seconds)

1. Go to **Feature Flags** tab
2. Find the problematic feature (e.g., USE_BUG_ATTRIBUTION)
3. Click toggle to **Disable**
4. Feature off immediately; no page reload needed

### Step 2: Check Metrics (30 seconds)

1. Go to **Metrics** tab
2. Verify error rate decreased
3. Check **Health Checks** for new errors

### Step 3: Optional — Restore Data (2 minutes)

If data was corrupted:

1. Go to **Backups** tab
2. Find pre-incident backup
3. Click **Restore** → **Confirm**

### Step 4: Log the Incident (1 minute)

1. Check **History** tab
2. Note the timestamp and action
3. Create a post-mortem ticket (JIRA, Linear, etc.)

---

## FAQ

### Q: Can I roll back a specific release without restoring all data?

**A:** No. Backups are all-or-nothing. The current design restores entire `store.json`.  
**Workaround:** Manually edit the CSV file for one release in `data/` and re-upload.

### Q: What happens if I disable a feature but data was already created with it?

**A:** Data is preserved. Disabling only stops new data from being created/used.  
**Example:** Disable USE_BUG_ATTRIBUTION → existing bug attribution records remain in database, just not displayed/calculated.

### Q: Can I run v1 and v2 scores in parallel to compare?

**A:** Yes! Both are always calculated. You can switch between them on the display.  
**Feature:** Coming soon — show both v1 and v2 scores side-by-side on release detail page.

### Q: How do I know if a feature is safe to enable?

**A:** Check the feature description + metrics:
1. Read the feature description (what it does)
2. Check **Metrics** → **Health Checks** (system OK?)
3. Enable on a small subset first (gradual rollout)
4. Monitor **Metrics** tab for errors
5. Check **History** for any issues
6. Roll out to everyone once confident

### Q: What if I restore the wrong backup?

**A:** Don't worry! Before any restore, the system creates an automatic backup of the current state.  
You can restore again from that auto-backup.

### Q: Can I schedule backups?

**A:** Not yet. Backups are manual or automatic (pre-restore).  
**Workaround:** Set a calendar reminder, or add a cron job:
```bash
# Backup daily at 2 AM
0 2 * * * curl -X POST http://localhost:3000/api/admin/rollback/backup \
  -H "Content-Type: application/json" \
  -d '{"reason":"Daily backup"}'
```

---

## Best Practices

### Before Deploying a Phase

1. **Create a backup** with note "Pre-Phase-N-rollout"
2. **Test features locally** before enabling in production
3. **Enable features gradually** (10% → 50% → 100% of users)
4. **Monitor metrics** for 24 hours after each feature
5. **Document the rollout** in CHANGELOG.md

### Naming Backups

Use descriptive notes to make restores easy:

```
✓ "Pre-Phase-1-rollout"
✓ "Before v2 scoring switch"
✓ "Baseline: all Phase 1 features enabled"
✓ "Bug attribution dev — testing"

✗ "backup1"
✗ "test"
✗ "data"
```

### Monitoring Checklist

After enabling a feature:

- [ ] **Errors?** Check server logs for exceptions
- [ ] **Performance?** Metrics tab shows p99 latency still <500ms?
- [ ] **Data quality?** Sample releases have correct new fields?
- [ ] **User feedback?** Any complaints on Slack?
- [ ] **Usage stats?** Feature is actually being used (metrics show >10%)?

---

## Support

**Issues or questions?**

1. Check **History** tab for recent changes
2. Review **Metrics** → **Health Checks** for system status
3. Contact: `ashish.r@greyorange.com` (or your ops team)
4. Create a GitHub issue: [Release_Scorecard/issues](https://github.com/ashishrathoregreyorange/Release_Scorecard/issues)

---

## Related Files

- `/server/rollbackControl.js` — Backend implementation
- `/src/components/RollbackControl.jsx` — Frontend UI
- `/server/index.js` — API routes (`/api/admin/rollback/*`)
- `ROLLBACK_STRATEGY.md` — Detailed rollback architecture

