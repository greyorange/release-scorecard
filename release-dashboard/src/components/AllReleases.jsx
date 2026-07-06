import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAllReleases } from "../api.js";
import UploadCsv from "./UploadCsv.jsx";

function healthColor(rec) {
  if (rec === "go") return { bg: "bg-emerald-500", text: "text-white", label: "GO" };
  if (rec === "conditional") return { bg: "bg-amber-400", text: "text-white", label: "CONDITIONAL" };
  if (rec === "nogo") return { bg: "bg-red-500", text: "text-white", label: "NO-GO" };
  return { bg: "bg-slate-300", text: "text-slate-600", label: "UNKNOWN" };
}

function groupByProject(releases) {
  const map = new Map();
  for (const r of releases) {
    const key = r.projectName || r.customerName || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  for (const [, group] of map) {
    group.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
  }
  return map;
}

export default function AllReleases() {
  const nav = useNavigate();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const reload = useCallback(async () => {
    try {
      setReleases(await fetchAllReleases());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) return <div className="text-slate-500">Loading releases…</div>;
  if (error) return <div className="card text-amber-700">Failed to load: {error}</div>;

  if (!releases.length) {
    return (
      <div className="space-y-4">
        <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">No releases yet</h2>
            <p className="text-sm text-slate-500">
              Generate a scorecard by filling in the form, or upload a CSV.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/new")}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              Generate Release Scorecard
            </button>
            <UploadCsv onUploaded={reload} />
          </div>
        </div>
      </div>
    );
  }

  const grouped = groupByProject(releases);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            All Releases{" "}
            <span className="text-slate-400 font-normal">
              ({grouped.size} project{grouped.size !== 1 ? "s" : ""},{" "}
              {releases.length} release{releases.length !== 1 ? "s" : ""})
            </span>
          </h2>
          <p className="text-xs text-slate-500">click a project to expand its releases</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/new")}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            Generate Release Scorecard
          </button>
          <UploadCsv onUploaded={reload} />
        </div>
      </div>

      <div className="space-y-3">
        {[...grouped.entries()].map(([projectName, projectReleases]) => (
          <ProjectAccordion
            key={projectName}
            projectName={projectName}
            releases={projectReleases}
            isOpen={expanded.has(projectName)}
            onToggle={() => toggleExpand(projectName)}
            onNavigate={(id) => nav(`/projects/${id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreRingMini({ score, rec }) {
  const size = 56;
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const fill = score != null ? (score / 100) * circ : 0;
  const strokeColor =
    rec === "go" ? "#10b981" :
    rec === "conditional" ? "#f59e0b" :
    rec === "nogo" ? "#ef4444" : "#94a3b8";

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={5}
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="text-sm font-bold text-slate-900" style={{ position: "relative" }}>
        {score != null ? score : "—"}
      </span>
    </div>
  );
}

function ProjectAccordion({ projectName, releases, isOpen, onToggle, onNavigate }) {
  const latest = releases[0];
  const sc = latest?.scorecard || {};
  const rec = sc.recommendation;
  const { bg, text, label } = healthColor(rec);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
      >
        <ScoreRingMini score={sc.score ?? null} rec={rec} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900">
            {latest?.customerName && latest.customerName !== projectName && (
              <span className="text-xs font-normal text-slate-500 mr-1">
                {latest.customerName} ·{" "}
              </span>
            )}
            {projectName}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${text}`}>
              {label}
            </span>
            <span className="text-xs text-slate-400">
              {releases.length} release{releases.length !== 1 ? "s" : ""}
            </span>
            {latest?.releaseDate && (
              <span className="text-xs text-slate-400">latest: {latest.releaseDate}</span>
            )}
            {latest?.owner && (
              <span className="text-xs text-slate-400">· {latest.owner}</span>
            )}
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-2 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            Releases — click to open scorecard
          </div>
          {releases.map((r, i) => {
            const rsc = r.scorecard || {};
            const rrec = rsc.recommendation;
            const { bg: rbg, text: rtxt, label: rlabel } = healthColor(rrec);
            return (
              <button
                key={r.id}
                onClick={() => onNavigate(r.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                  i !== releases.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2"
                  style={{
                    borderColor:
                      rrec === "go" ? "#10b981" :
                      rrec === "conditional" ? "#f59e0b" :
                      rrec === "nogo" ? "#ef4444" : "#cbd5e1",
                  }}
                >
                  <span className="text-xs font-bold text-slate-700">
                    {rsc.score != null ? rsc.score : "—"}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {r.projectName}{" "}
                    <span className="text-slate-400 font-normal text-xs">{r.releaseVersion}</span>
                  </div>
                  {r.releaseDate && (
                    <div className="text-xs text-slate-400">{r.releaseDate}</div>
                  )}
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rbg} ${rtxt}`}>
                  {rlabel}
                </span>

                <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
