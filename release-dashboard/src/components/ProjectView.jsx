import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProject, fetchHistory, syncProject, pdfUrl, fetchConfig } from "../api.js";
import { mockProjects } from "../data/mockData.js";
import ProjectHeader from "./ProjectHeader.jsx";
import ScoreRing from "./ScoreRing.jsx";
import MetricsGrid from "./MetricsGrid.jsx";
import ScoreBreakdown from "./ScoreBreakdown.jsx";
import HistoryChart from "./HistoryChart.jsx";
import RcaCapaGroups from "./RcaCapaGroups.jsx";
import TeamLearnings from "./TeamLearnings.jsx";
import JiraIssuesTable from "./JiraIssuesTable.jsx";
import BugClassification from "./BugClassification.jsx";
import SopCompliance from "./SopCompliance.jsx";
import LeakageAnalysis from "./LeakageAnalysis.jsx";
import FeatureDelivery from "./FeatureDelivery.jsx";
import ScoreTabs from "./ScoreTabs.jsx";
import StageBreakdown from "./StageBreakdown.jsx";
import ScoreEvolution from "./ScoreEvolution.jsx";

export default function ProjectView() {
  const { id } = useParams();
  const [release, setRelease] = useState(null);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState({ jiraBaseUrl: null });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  // Once a release's score is locked (7-day observation window closed),
  // the locked value is what's shown by default. This flips the display to
  // the live, recalculated-right-now value without a second request.
  const [viewLive, setViewLive] = useState(false);
  // PDF-export readiness — set true when the page has finished fetching
  // everything it'll show, so puppeteer waits for the JIRA + Stories
  // tables before snapshotting. Tracked as a Set so adding another lazy
  // table later doesn't require new state.
  const [readyTables, setReadyTables] = useState(() => new Set());
  const markReady = (key) =>
    setReadyTables((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  const expectedTables = [];
  if ((release?.jiraIds?.length || 0) > 0) expectedTables.push("issues");
  if ((release?.storyIds?.length || 0) > 0) expectedTables.push("stories");
  const pageReady =
    Boolean(release) && expectedTables.every((k) => readyTables.has(k));

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__pdfReady = pageReady;
    }
  }, [pageReady]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRelease(null);
    setReadyTables(new Set());
    setViewLive(false);
    if (typeof window !== "undefined") window.__pdfReady = false;
    (async () => {
      try {
        const [proj, hist, cfg] = await Promise.all([
          fetchProject(id),
          fetchHistory(id),
          fetchConfig().catch(() => ({ jiraBaseUrl: null })),
        ]);
        if (cancelled) return;
        setRelease(proj);
        setHistory(hist.history || []);
        setConfig(cfg);
      } catch (err) {
        if (cancelled) return;
        const fallback = mockProjects.find((p) => p.id === id) || mockProjects[0];
        setRelease(fallback);
        setError("API unreachable — showing mock data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const updated = await syncProject(id);
      setRelease(updated);
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    window.open(pdfUrl(id), "_blank");
  };

  // Bulk RCA/CAPA export — the audit-trail piece of "share RCAs/CAPAs and
  // owners for gaps found" that doesn't need a server round trip.
  const exportIssuesCsv = () => {
    const cols = ["JIRA ID", "Title", "Severity", "Status", "Owner", "Due Date", "Completed Date", "RCA", "CAPA"];
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = (release.issues || []).map((i) => [
      i.jiraId, i.title, i.severity, i.status, i.owner, i.dueDate, i.completedDate, i.rca, i.capa,
    ]);
    const csv = [cols, ...rows].map((r) => r.map(escape).join(",")).join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${release.id}-rca-capa.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!release) {
    return <div className="text-slate-500">Loading release…</div>;
  }

  const rawScorecard = release.scorecard || {};
  const isLocked = Boolean(rawScorecard.isLocked);
  // Locked (frozen) score is the default view; the toggle swaps in the
  // live-recalculated values from `.live` without changing anything else
  // (finalization/snapshots aren't affected — they're the same either way).
  const scorecard =
    viewLive && rawScorecard.live ? { ...rawScorecard, ...rawScorecard.live } : rawScorecard;

  const score = scorecard.score ?? null;
  const rec = scorecard.recommendation;

  return (
    <div className="space-y-6">
      <ProjectHeader
        release={release}
        onSync={handleSync}
        onExport={handleExport}
        syncing={syncing}
      />

      {error && (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card flex flex-col items-center justify-center">
          <ScoreRing score={score} recommendation={rec} />
          {isLocked && (
            <button
              type="button"
              onClick={() => setViewLive((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              title={
                viewLive
                  ? "Showing the live score, recalculated from current data"
                  : "Showing the score locked at the end of the observation window"
              }
            >
              {viewLive ? "🔄 Live score — back to locked" : "🔒 Locked score — view live"}
            </button>
          )}
          {scorecard.rationale && (
            <p className="mt-3 text-xs text-center text-slate-500">
              {scorecard.rationale}
            </p>
          )}
        </div>
        <BugClassification data={release.bugClassification} />
      </section>

      <ScoreTabs scorecard={scorecard} />

      <MetricsGrid release={release} />

      {release.sopCompliance && (
        <SopCompliance sopCompliance={release.sopCompliance} />
      )}

      <FeatureDelivery
        requirements={release.requirements}
        featureScore={scorecard.qualityDimensions?.featureDelivery}
      />

      <section className="grid lg:grid-cols-2 gap-4">
        <ScoreBreakdown scorecard={scorecard} />
        <LeakageAnalysis stages={release.stages} leakageMetrics={release.leakageMetrics} />
      </section>

      <StageBreakdown stages={release.stages} />

      <ScoreEvolution scorecard={scorecard} />

      {history.length > 1 && <HistoryChart history={history} />}

      {release.jiraIds?.length > 0 && (
        <JiraIssuesTable
          ids={release.jiraIds.map((j) => (typeof j === "string" ? j : j.id))}
          jiraBaseUrl={config.jiraBaseUrl}
          onLoaded={() => markReady("issues")}
        />
      )}

      <section>
        <div className="flex items-center justify-between">
          <h3 className="section-title">RCA &amp; CAPA</h3>
          {release.issues?.length > 0 && (
            <button
              type="button"
              onClick={exportIssuesCsv}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline no-print"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>
        {release.issues?.length ? (
          <RcaCapaGroups issues={release.issues} jiraBaseUrl={config.jiraBaseUrl} />
        ) : (
          <div className="card text-sm text-slate-500">No issues logged.</div>
        )}
      </section>

      <section>
        <h3 className="section-title">Team Learnings</h3>
        <TeamLearnings learnings={release.teamLearnings} />
      </section>

      {release.storyIds?.length > 0 && (
        <JiraIssuesTable
          ids={release.storyIds.map((j) => (typeof j === "string" ? j : j.id))}
          jiraBaseUrl={config.jiraBaseUrl}
          onLoaded={() => markReady("stories")}
          title="CAPA Actions"
        />
      )}
    </div>
  );
}
