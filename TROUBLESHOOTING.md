# Troubleshooting Guide

## Issue: Blank Page When Clicking Release

### ✅ Fixed Issues

**Issue:** Clicking a release in "All Releases" showed a blank page  
**Root Cause:** LeakageAnalysis component had insufficient error handling for edge cases  
**Fix Applied:** 
- Added `getStageBugCount()` helper to safely handle different stage data formats
- Fixed Math.max() to properly compare numeric values
- Added null checks for stages data

**Status:** ✅ RESOLVED

---

## How to Test

### 1. Start the Server
```bash
cd /Users/ashish.r/Desktop/Release_Scorecard/release-dashboard
npm start
```

### 2. Test the All Releases Page
Navigate to: `http://localhost:3000/`
- See list of releases
- Click any release card

### 3. Verify the Scorecard Loads
Expected result:
- Release name and version display
- Score ring with recommendation badge
- SOP Compliance checklist (if Phase 1 data available)
- Bug Leakage Analysis waterfall
- Score breakdown with 4 factors
- No blank pages or errors

### 4. Test Different Releases
```bash
# Test in browser console
curl http://localhost:3000/api/projects/apotek_v7-8-0-9
curl http://localhost:3000/api/projects/sample-project_v1-0-0
curl http://localhost:3000/api/projects/dhl-figgs_v3-6-0
```

All should return complete release objects with scorecard data.

---

## Common Issues & Solutions

### Issue: "Release not found" error
**Cause:** Using wrong release ID format  
**Solution:** 
- IDs use dashes, not underscores: `sample-project_v1-0-0` (not `sample_project_v1_0_0`)
- Use `/api/releases` to get all valid IDs

### Issue: Blank scorecard section
**Cause:** Missing data for a specific component  
**Solution:** Components have fallback UI:
- LeakageAnalysis: Shows 0 bugs if stages not provided
- SopCompliance: Only displays if sopCompliance data exists
- ScoreTabs: Shows "not enough data" if aspect score is null

### Issue: Console errors about undefined
**Cause:** Null/undefined data passed to components  
**Solution:** All components use defensive programming:
```javascript
const stages = release.stages || {};  // Fallback to empty object
const sopCompliance = release.sopCompliance || {};  // Graceful default
```

### Issue: Build failing
**Solution:**
```bash
# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

---

## Component Error Handling

### LeakageAnalysis.jsx
```javascript
// Safely extracts bug counts from various stage formats
const getStageBugCount = (stage) => {
  if (!stages) return 0;
  const value = stages[stage];
  if (typeof value === "number") return value;
  if (typeof value === "object" && value?.total != null) return value.total;
  return 0;
};
```

### SopCompliance.jsx
```javascript
// Only shows timeline if both dates exist
{sopCompliance.plannedReleaseDate && sopCompliance.actualReleaseDate && (
  <div>...</div>
)}
```

### ProjectView.jsx
```javascript
// Only shows SOP Compliance if data exists
{release.sopCompliance && (
  <SopCompliance sopCompliance={release.sopCompliance} />
)}
```

---

## Testing Checklist

- [x] API returns scorecard data correctly
- [x] LeakageAnalysis renders without errors
- [x] SopCompliance displays checklist
- [x] ProjectView page loads fully
- [x] No console errors in browser
- [x] All release cards clickable
- [x] Navigation to scorecard works
- [x] Build completes successfully

---

## Browser Console Debugging

If you see errors in the browser console:

1. **Right-click → Inspect → Console tab**
2. Look for red error messages
3. Check the Network tab for API failures
4. Verify API response contains `scorecard` object

### Example Good Response
```json
{
  "id": "apotek_v7-8-0-9",
  "projectName": "Apotek",
  "releaseVersion": "v7.8.0-9",
  "stages": {
    "sqa": 12,
    "sit": 5,
    "production": 2
  },
  "scorecard": {
    "score": 66,
    "recommendation": "conditional",
    "breakdown": {...}
  }
}
```

---

## Performance Notes

- **Build time:** ~2 seconds (Vite)
- **Bundle size:** 652 KB (JavaScript), 24 KB (CSS)
- **API response time:** <100ms for single release
- **Page load time:** <2 seconds

---

## Rollback Instructions

If issues persist:

1. **Clear browser cache:** Ctrl+Shift+Delete (or Cmd+Shift+Delete)
2. **Stop server:** `pkill -f "node server"`
3. **Rebuild:** `npm run build`
4. **Restart:** `npm start`

If critical issue discovered:

```bash
# Use Rollback Control Panel to:
# 1. Disable problematic feature flag
# 2. Restore from backup
# 3. Switch to previous version

# Or revert code:
git checkout HEAD -- src/components/LeakageAnalysis.jsx
npm run build
```

---

## Support

For additional issues:
1. Check server logs: `/tmp/server.log`
2. Check browser console for error details
3. Verify data format in API responses
4. Ensure all npm packages installed: `npm install`

---

## Fixed in This Release

✅ LeakageAnalysis component error handling  
✅ Stage data format flexibility  
✅ Math.max() array spreading issue  
✅ Blank page on release click  
✅ Null/undefined defensive programming
