import { Link } from "react-router-dom";

// Release-type → badge styling. Neutral fallback keeps unknown types readable.
const RELEASE_TYPE_STYLE = {
  major: "bg-violet-50 text-violet-700 ring-violet-200",
  minor: "bg-blue-50 text-blue-700 ring-blue-200",
  hotfix: "bg-red-50 text-red-700 ring-red-200",
  patch: "bg-amber-50 text-amber-700 ring-amber-200",
  weekly: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default function ProjectHeader({ release, onSync, onExport, syncing }) {
  const rec = release.scorecard?.recommendation;
  const pillClass = `pill-${rec || "neutral"}`;
  const rt = release.releaseType;
  const rtStyle = RELEASE_TYPE_STYLE[rt] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {release.customerName || release.projectName}
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
          <span>
            {release.projectName}{" "}
            <span className="text-slate-400 font-normal">{release.releaseVersion}</span>
          </span>
          {rt && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1 ${rtStyle}`}>
              {rt}
            </span>
          )}
        </h2>
        <div className="mt-1 text-sm text-slate-600 flex flex-wrap gap-x-4">
          {release.releaseDate && <span>📅 {release.releaseDate}</span>}
          {release.owner && <span>👤 {release.owner}</span>}
          {release.currentBuildVersion && (
            <span className="text-slate-400">from {release.currentBuildVersion}</span>
          )}
          <span className={pillClass}>{rec ? rec.toUpperCase() : "UNKNOWN"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 no-print">
        <Link
          to={`/projects/${release.id}/edit`}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
        >
          Edit
        </Link>
        <button
          onClick={onSync}
          disabled={syncing}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync JIRA"}
        </button>
        <button
          onClick={onExport}
          className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          Export PDF
        </button>
      </div>
    </header>
  );
}
