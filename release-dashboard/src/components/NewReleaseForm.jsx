import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createRelease, fetchJiraIssuesByIds, fetchProject, updateRelease } from "../api.js";

// Form-driven release entry. Doubles as the edit form: when the URL has
// a :id param (route /projects/:id/edit), we fetch the existing release
// and prefill the inputs, then submit via PUT instead of POST.

const SEVERITIES = ["critical", "high", "medium", "low"];
const ISSUE_STATUSES = ["open", "in-progress", "closed"];

const emptyIssue = () => ({
  jiraId: "", title: "", severity: "medium",
  rca: "", capa: "", owner: "", dueDate: "",
  status: "open", completedDate: "",
});

const emptyLearning = () => ({ team: "", note: "", owner: "", dueDate: "" });

export default function NewReleaseForm() {
  const nav = useNavigate();
  const { id: editingId } = useParams(); // undefined for /new, set for /projects/:id/edit
  const isEditing = Boolean(editingId);
  const [submitting, setSubmitting] = useState(false);
  const [prefilling, setPrefilling] = useState(isEditing);
  const [error, setError] = useState(null);

  // Top-level fields
  const [project, setProject] = useState("");
  const [customer, setCustomer] = useState("");
  const [version, setVersion] = useState("");
  const [releaseType, setReleaseType] = useState("minor");
  const [owner, setOwner] = useState("");
  const [plannedReleaseDate, setPlannedReleaseDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");

  // SOP Compliance (Phase 1)
  const [sopCompleted, setSopCompleted] = useState(false);
  const [releaseNotesReady, setReleaseNotesReady] = useState(false);
  const [signoffObtained, setSignoffObtained] = useState(false);
  const [rollbackPlanReady, setRollbackPlanReady] = useState(false);

  // Feature tracking (Phase 1)
  const [plannedFeaturesStr, setPlannedFeaturesStr] = useState("");
  const [deliveredFeaturesStr, setDeliveredFeaturesStr] = useState("");
  const [deferredFeaturesStr, setDeferredFeaturesStr] = useState("");

  const [testPassRate, setTestPassRate] = useState("");
  const [automationCoverage, setAutomationCoverage] = useState("");
  const [mttrHours, setMttrHours] = useState("");

  const [sqaBugs, setSqaBugs] = useState("");
  const [sitBugs, setSitBugs] = useState("");
  const [prodBugs, setProdBugs] = useState("");
  const [criticalOpen, setCriticalOpen] = useState("");

  const [jiraIdsStr, setJiraIdsStr] = useState("");
  const [storyIdsStr, setStoryIdsStr] = useState("");

  // Bug classification matrix
  const [bcTotal, setBcTotal] = useState("");
  const [bcNewReq, setBcNewReq] = useState("");
  const [bcDuplicates, setBcDuplicates] = useState("");
  const [bcLeaks, setBcLeaks] = useState("");
  const [bcTbd, setBcTbd] = useState("");

  const [issues, setIssues] = useState([emptyIssue()]);
  const [learnings, setLearnings] = useState([emptyLearning()]);

  // Edit mode — fetch the release and back-translate from the canonical
  // record schema into the form's field-by-field state.
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    setPrefilling(true);
    setError(null);
    (async () => {
      try {
        const r = await fetchProject(editingId);
        if (cancelled) return;
        setProject(r.projectName || "");
        setCustomer(r.customerName || "");
        setVersion(r.releaseVersion || "");
        setReleaseType(r.releaseType || "minor");
        setOwner(r.owner || "");
        setPlannedReleaseDate(r.sopCompliance?.plannedReleaseDate ? String(r.sopCompliance.plannedReleaseDate).slice(0, 10) : "");
        setReleaseDate(r.releaseDate ? String(r.releaseDate).slice(0, 10) : "");
        setSopCompleted(r.sopCompliance?.preReleaseSopCompleted || false);
        setReleaseNotesReady(r.sopCompliance?.releaseNotesReady || false);
        setSignoffObtained(r.sopCompliance?.signoffObtained || false);
        setRollbackPlanReady(r.sopCompliance?.rollbackPlanReady || false);
        setPlannedFeaturesStr((r.requirements?.planned || []).join(", "));
        setDeliveredFeaturesStr((r.requirements?.delivered || []).join(", "));
        setDeferredFeaturesStr((r.requirements?.deferred || []).join(", "));
        setTestPassRate(r.testPassRate ?? "");
        setAutomationCoverage(r.automationCoverage ?? "");
        setMttrHours(r.mttr ?? "");
        setSqaBugs(r.stages?.sqa?.total ?? "");
        setSitBugs(r.stages?.sit?.total ?? "");
        setProdBugs(r.stages?.production?.total ?? "");
        setCriticalOpen(r.criticalBugsOpen ?? "");
        const idList = (r.jiraIds || []).map((j) => (typeof j === "string" ? j : j.id));
        setJiraIdsStr(idList.join(", "));
        const storyList = (r.storyIds || []).map((j) => (typeof j === "string" ? j : j.id));
        setStoryIdsStr(storyList.join(", "));
        const bc = r.bugClassification || {};
        setBcTotal(bc.total ?? "");
        setBcNewReq(bc.newRequirements ?? "");
        setBcDuplicates(bc.duplicates ?? "");
        setBcLeaks(bc.leaksFromTesting ?? "");
        setBcTbd(bc.tbd ?? "");
        const formIssues = (r.issues || []).map((i) => ({
          jiraId: i.jiraId || "",
          title: i.title || "",
          severity: i.severity || "medium",
          rca: i.rca || "",
          capa: i.capa || "",
          owner: i.owner || "",
          dueDate: i.dueDate ? String(i.dueDate).slice(0, 10) : "",
          status: i.status || "open",
          completedDate: i.completedDate ? String(i.completedDate).slice(0, 10) : "",
        }));
        setIssues(formIssues.length ? formIssues : [emptyIssue()]);
        const formLearnings = (r.teamLearnings || []).map((l) => ({
          team: l.team || "",
          note: l.learning || l.note || "",
          owner: l.owner || "",
          dueDate: l.dueDate ? String(l.dueDate).slice(0, 10) : "",
        }));
        setLearnings(formLearnings.length ? formLearnings : [emptyLearning()]);
      } catch (err) {
        if (cancelled) return;
        setError(`Failed to load release: ${err.response?.data?.error || err.message}`);
      } finally {
        if (!cancelled) setPrefilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const updateIssue = (idx, field, value) => {
    setIssues((arr) => arr.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  // Prefill RCA/CAPA cards from the JIRA IDs above. Strictly additive: only
  // blank fields are filled, so anything already typed survives a re-fetch.
  // Cards are matched by JIRA ID; unknown IDs get a new card appended.
  // NB: `prefilling` above is the edit-mode load flag — these are distinct.
  const [jiraFetching, setJiraFetching] = useState(false);
  const [jiraMsg, setJiraMsg] = useState(null);

  const prefillFromJira = async () => {
    const ids = jiraIdsStr.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setJiraFetching(true);
    setJiraMsg(null);
    try {
      const res = await fetchJiraIssuesByIds(ids);
      if (res.enabled === false) {
        setJiraMsg({ kind: "warn", text: "JIRA is not configured — nothing to prefill." });
        return;
      }
      const fetched = res.issues || [];
      let filledFields = 0;
      let addedCards = 0;

      // Merge synchronously against current state rather than inside a
      // setIssues updater — React defers updaters, so counters tallied in
      // one always read back as zero.
      const next = [...issues];
      {
        for (const src of fetched) {
          if (src.missing) continue;
          // JIRA's own workflow status ("Done", "In Progress", "To Do", ...)
          // doesn't match our open/in-progress/closed tracking vocabulary —
          // map it with a simple heuristic rather than leaving it unset.
          const jiraStatus = String(src.status || "").toLowerCase();
          const mappedStatus = /done|closed|resolved/.test(jiraStatus)
            ? "closed"
            : /progress/.test(jiraStatus)
              ? "in-progress"
              : "";
          const incoming = {
            jiraId: src.id || "",
            title: src.title || "",
            severity: src.severity || "",
            owner: src.owner || "",
            dueDate: src.dueDate || "",
            rca: src.rca || "",
            capa: src.capa || "",
            status: mappedStatus,
          };
          let i = next.findIndex(
            (c) => c.jiraId.trim().toUpperCase() === String(src.id).toUpperCase(),
          );
          // Reuse a still-untouched blank card before appending a new one.
          if (i === -1) {
            i = next.findIndex((c) => !c.jiraId.trim() && !c.title.trim() && !c.rca.trim());
            if (i === -1) {
              next.push(emptyIssue());
              i = next.length - 1;
            }
            addedCards++;
          }
          const merged = { ...next[i] };
          for (const [k, v] of Object.entries(incoming)) {
            // severity and status always have a default, so only overwrite
            // when still at that default (i.e. blank-ish, not a deliberate edit).
            const isBlank =
              !String(merged[k] ?? "").trim() ||
              (k === "severity" && merged[k] === "medium") ||
              (k === "status" && merged[k] === "open");
            if (v && isBlank && merged[k] !== v) {
              merged[k] = v;
              filledFields++;
            }
          }
          next[i] = merged;
        }
      }
      setIssues(next);

      const noData = fetched.filter((f) => !f.missing && !f.rca && !f.capa).map((f) => f.id);
      const missing = fetched.filter((f) => f.missing).map((f) => f.id);
      const bits = [`Filled ${filledFields} field${filledFields === 1 ? "" : "s"} across ${fetched.length - missing.length} issue${fetched.length - missing.length === 1 ? "" : "s"}`];
      if (addedCards) bits.push(`${addedCards} card${addedCards === 1 ? "" : "s"} added`);
      if (noData.length) bits.push(`no RCA/CAPA in JIRA for ${noData.join(", ")}`);
      if (missing.length) bits.push(`not found: ${missing.join(", ")}`);
      setJiraMsg({ kind: noData.length || missing.length ? "warn" : "ok", text: bits.join(" · ") });
    } catch (err) {
      setJiraMsg({ kind: "error", text: err.response?.data?.error || err.message });
    } finally {
      setJiraFetching(false);
    }
  };
  const updateLearning = (idx, field, value) => {
    setLearnings((arr) => arr.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const numOrUndef = (s) => {
    if (s === "" || s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const buildPayload = () => {
    const payload = { project: project.trim(), version: version.trim() };
    if (customer.trim()) payload.customer = customer.trim();
    if (owner.trim()) payload.owner = owner.trim();
    if (releaseType) payload.releaseType = releaseType;
    if (plannedReleaseDate) payload.plannedReleaseDate = plannedReleaseDate;
    if (releaseDate) payload.releaseDate = releaseDate;

    const sopCompliance = {};
    if (sopCompleted || releaseNotesReady || signoffObtained || rollbackPlanReady) {
      sopCompliance.preReleaseSopCompleted = sopCompleted;
      sopCompliance.releaseNotesReady = releaseNotesReady;
      sopCompliance.signoffObtained = signoffObtained;
      sopCompliance.rollbackPlanReady = rollbackPlanReady;
      if (plannedReleaseDate) sopCompliance.plannedReleaseDate = plannedReleaseDate;
      if (releaseDate) sopCompliance.actualReleaseDate = releaseDate;
      payload.sopCompliance = sopCompliance;
    }

    const requirements = {};
    const planned = plannedFeaturesStr.split(",").map(s => s.trim()).filter(Boolean);
    const delivered = deliveredFeaturesStr.split(",").map(s => s.trim()).filter(Boolean);
    const deferred = deferredFeaturesStr.split(",").map(s => s.trim()).filter(Boolean);
    if (planned.length || delivered.length || deferred.length) {
      if (planned.length) requirements.planned = planned;
      if (delivered.length) requirements.delivered = delivered;
      if (deferred.length) requirements.deferred = deferred;
      payload.requirements = requirements;
    }

    const metrics = {};
    if (numOrUndef(testPassRate) !== undefined) metrics.testPassRate = numOrUndef(testPassRate);
    if (numOrUndef(automationCoverage) !== undefined) metrics.automationCoverage = numOrUndef(automationCoverage);
    if (numOrUndef(mttrHours) !== undefined) metrics.mttrHours = numOrUndef(mttrHours);
    if (Object.keys(metrics).length) payload.metrics = metrics;

    const bugs = {};
    if (numOrUndef(sqaBugs) !== undefined) bugs.sqa = numOrUndef(sqaBugs);
    if (numOrUndef(sitBugs) !== undefined) bugs.sit = numOrUndef(sitBugs);
    if (numOrUndef(prodBugs) !== undefined) bugs.production = numOrUndef(prodBugs);
    if (numOrUndef(criticalOpen) !== undefined) bugs.criticalOpen = numOrUndef(criticalOpen);
    if (Object.keys(bugs).length) payload.bugs = bugs;

    const jiraIds = jiraIdsStr.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (jiraIds.length) payload.jiraIds = jiraIds;

    const storyIds = storyIdsStr.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (storyIds.length) payload.storyIds = storyIds;

    const bugClassification = {};
    if (numOrUndef(bcTotal) !== undefined) bugClassification.total = numOrUndef(bcTotal);
    if (numOrUndef(bcNewReq) !== undefined) bugClassification.newRequirements = numOrUndef(bcNewReq);
    if (numOrUndef(bcDuplicates) !== undefined) bugClassification.duplicates = numOrUndef(bcDuplicates);
    if (numOrUndef(bcLeaks) !== undefined) bugClassification.leaksFromTesting = numOrUndef(bcLeaks);
    if (numOrUndef(bcTbd) !== undefined) bugClassification.tbd = numOrUndef(bcTbd);
    if (Object.keys(bugClassification).length) payload.bugClassification = bugClassification;

    const cleanedIssues = issues
      .filter((i) => i.title.trim())
      .map((i) => ({
        jiraId: i.jiraId.trim() || undefined,
        title: i.title.trim(),
        severity: i.severity || "medium",
        rca: i.rca.trim() || undefined,
        capa: i.capa.trim() || undefined,
        owner: i.owner.trim() || undefined,
        dueDate: i.dueDate || undefined,
        status: i.status || "open",
        completedDate: i.status === "closed" ? i.completedDate || undefined : undefined,
      }));
    if (cleanedIssues.length) payload.issues = cleanedIssues;

    const cleanedLearnings = learnings
      .filter((l) => l.team.trim() && l.note.trim())
      .map((l) => ({
        team: l.team.trim(),
        note: l.note.trim(),
        owner: l.owner.trim() || undefined,
        dueDate: l.dueDate || undefined,
      }));
    if (cleanedLearnings.length) payload.learnings = cleanedLearnings;

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!project.trim() || !version.trim()) {
      setError("Project Name and Release Version are required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = isEditing
        ? await updateRelease(editingId, buildPayload())
        : await createRelease(buildPayload());
      nav(`/projects/${result.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {isEditing ? "Edit Release Scorecard" : "New Release Scorecard"}
          </h2>
          <p className="text-sm text-slate-500">
            {isEditing
              ? "Update any field and save. Changing Project or Version will move this release to a new id."
              : "Fill what you have. Only Project Name and Release Version are required."}
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting || prefilling}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting
            ? (isEditing ? "Saving…" : "Generating…")
            : (isEditing ? "Save Changes" : "Generate Release Scorecard")}
        </button>
      </div>

      {prefilling && (
        <div className="card text-sm text-slate-500">Loading release…</div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      {/* ---------------- Identity ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Release Info</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Project Name *" value={project} onChange={setProject} placeholder="DHL Figgs" />
          <Field label="Release Version *" value={version} onChange={setVersion} placeholder="v1.0.0" />
          <Field label="Customer Name" value={customer} onChange={setCustomer} placeholder="Acme Corp" />
          <Field label="Owner" value={owner} onChange={setOwner} placeholder="Ashish R" />
          <SelectField label="Release Type" value={releaseType} onChange={setReleaseType} options={["major", "minor", "hotfix", "patch", "weekly"]} />
          <Field label="Planned Release Date" type="date" value={plannedReleaseDate} onChange={setPlannedReleaseDate} />
          <Field label="Actual Release Date" type="date" value={releaseDate} onChange={setReleaseDate} />
        </div>
      </section>

      {/* ---------------- SOP Compliance (Phase 1) ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">SOP & Timeline Compliance</h3>
        <p className="text-xs text-slate-500 -mt-1">
          Track release process completion and timeline adherence.
        </p>
        <div className="space-y-2">
          <CheckboxField
            label="Pre-release SOP Completed"
            checked={sopCompleted}
            onChange={setSopCompleted}
          />
          <CheckboxField
            label="Release Notes Ready"
            checked={releaseNotesReady}
            onChange={setReleaseNotesReady}
          />
          <CheckboxField
            label="Signoff Obtained"
            checked={signoffObtained}
            onChange={setSignoffObtained}
          />
          <CheckboxField
            label="Rollback Plan Ready"
            checked={rollbackPlanReady}
            onChange={setRollbackPlanReady}
          />
        </div>
      </section>

      {/* ---------------- Feature Delivery (Phase 1) ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Feature Delivery</h3>
        <p className="text-xs text-slate-500 -mt-1">
          Track planned vs delivered vs deferred features. Use comma-separated values.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field
            label="Planned Features"
            value={plannedFeaturesStr}
            onChange={setPlannedFeaturesStr}
            placeholder="Feature A, Feature B, Feature C"
          />
          <Field
            label="Delivered Features"
            value={deliveredFeaturesStr}
            onChange={setDeliveredFeaturesStr}
            placeholder="Feature A, Feature B"
          />
          <Field
            label="Deferred Features"
            value={deferredFeaturesStr}
            onChange={setDeferredFeaturesStr}
            placeholder="Feature C"
          />
        </div>
      </section>

      {/* ---------------- Metrics ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Score Metrics</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Test Pass Rate %" type="number" value={testPassRate} onChange={setTestPassRate} placeholder="92" />
          <Field label="Automation Coverage %" type="number" value={automationCoverage} onChange={setAutomationCoverage} placeholder="75" />
          <Field label="MTTR (hrs)" type="number" value={mttrHours} onChange={setMttrHours} placeholder="18" />
        </div>
      </section>

      {/* ---------------- Bug counts ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Bug Counts</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="SQA Bugs" type="number" value={sqaBugs} onChange={setSqaBugs} placeholder="12" />
          <Field label="SIT Bugs" type="number" value={sitBugs} onChange={setSitBugs} placeholder="5" />
          <Field label="Production Bugs" type="number" value={prodBugs} onChange={setProdBugs} placeholder="2" />
          <Field label="Critical Bugs Open" type="number" value={criticalOpen} onChange={setCriticalOpen} placeholder="1" />
        </div>
      </section>

      {/* ---------------- Bug Classification matrix ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Bug Classification</h3>
        <p className="text-xs text-slate-500 -mt-1">
          Counts that feed the matrix card next to the Scorecard. All fields optional.
        </p>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Field label="Total Bugs" type="number" value={bcTotal} onChange={setBcTotal} placeholder="20" />
          <Field label="New Requirements" type="number" value={bcNewReq} onChange={setBcNewReq} placeholder="5" />
          <Field label="Duplicates" type="number" value={bcDuplicates} onChange={setBcDuplicates} placeholder="3" />
          <Field label="Leaks from Testing" type="number" value={bcLeaks} onChange={setBcLeaks} placeholder="8" />
          <Field label="TBD" type="number" value={bcTbd} onChange={setBcTbd} placeholder="4" />
        </div>
      </section>

      {/* ---------------- JIRA IDs ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">JIRA Issues</h3>
        <Field
          label="Comma-separated JIRA IDs (rendered as the Attached JIRA Issues table)"
          value={jiraIdsStr}
          onChange={setJiraIdsStr}
          placeholder="GM-1001, GM-1002, GM-1003"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prefillFromJira}
            disabled={jiraFetching || !jiraIdsStr.trim()}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {jiraFetching ? "Fetching…" : "Prefill RCA / CAPA cards from JIRA"}
          </button>
          <span className="text-xs text-slate-500">Fills blank fields only — your edits are never overwritten.</span>
        </div>
        {jiraMsg && (
          <div
            className={`text-sm rounded-md px-3 py-2 ${
              jiraMsg.kind === "error"
                ? "bg-red-50 text-red-700"
                : jiraMsg.kind === "warn"
                ? "bg-amber-50 text-amber-800"
                : "bg-green-50 text-green-800"
            }`}
          >
            {jiraMsg.text}
          </div>
        )}
      </section>

      {/* ---------------- Issue cards ---------------- */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">RCA / CAPA Cards</h3>
          <button
            type="button"
            onClick={() => setIssues((arr) => [...arr, emptyIssue()])}
            className="text-sm text-sky-700 hover:underline"
          >
            + Add issue
          </button>
        </div>
        <div className="space-y-3">
          {issues.map((issue, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Issue {idx + 1}
                </span>
                {issues.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIssues((arr) => arr.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    remove
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <Field label="JIRA ID" value={issue.jiraId} onChange={(v) => updateIssue(idx, "jiraId", v)} placeholder="GM-1001" />
                <Field label="Title" value={issue.title} onChange={(v) => updateIssue(idx, "title", v)} placeholder="Short summary" />
                <SelectField label="Severity" value={issue.severity} onChange={(v) => updateIssue(idx, "severity", v)} options={SEVERITIES} />
                <Field label="Owner" value={issue.owner} onChange={(v) => updateIssue(idx, "owner", v)} />
                <Field label="Due Date" type="date" value={issue.dueDate} onChange={(v) => updateIssue(idx, "dueDate", v)} />
                <SelectField label="Status" value={issue.status || "open"} onChange={(v) => updateIssue(idx, "status", v)} options={ISSUE_STATUSES} />
                {issue.status === "closed" && (
                  <Field label="Completed Date" type="date" value={issue.completedDate} onChange={(v) => updateIssue(idx, "completedDate", v)} />
                )}
              </div>
              <Field label="RCA" textarea value={issue.rca} onChange={(v) => updateIssue(idx, "rca", v)} placeholder="Root cause" />
              <Field label="CAPA" textarea value={issue.capa} onChange={(v) => updateIssue(idx, "capa", v)} placeholder="Corrective action" />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Team learnings ---------------- */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Team Learnings</h3>
          <button
            type="button"
            onClick={() => setLearnings((arr) => [...arr, emptyLearning()])}
            className="text-sm text-sky-700 hover:underline"
          >
            + Add learning
          </button>
        </div>
        <div className="space-y-2">
          {learnings.map((l, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Learning {idx + 1}
                </span>
                {learnings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLearnings((arr) => arr.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    remove
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Field label="Team" value={l.team} onChange={(v) => updateLearning(idx, "team", v)} placeholder="Engineering" />
                <Field label="Note" value={l.note} onChange={(v) => updateLearning(idx, "note", v)} placeholder="What we learned" />
                <Field label="Owner" value={l.owner} onChange={(v) => updateLearning(idx, "owner", v)} />
                <Field label="Due Date" type="date" value={l.dueDate} onChange={(v) => updateLearning(idx, "dueDate", v)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CAPA Actions (formerly "Story IDs") ---------------- */}
      <section className="card space-y-3">
        <h3 className="font-semibold text-slate-800">CAPA Actions</h3>
        <Field
          label="Comma-separated JIRA keys (rendered as the CAPA Actions table)"
          value={storyIdsStr}
          onChange={setStoryIdsStr}
          placeholder="GM-2001, GM-2002, GM-2003"
        />
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nav(isEditing ? `/projects/${editingId}` : "/")}
          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || prefilling}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting
            ? (isEditing ? "Saving…" : "Generating…")
            : (isEditing ? "Save Changes" : "Generate Release Scorecard")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-300"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
