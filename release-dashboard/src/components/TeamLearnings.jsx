// Default teams shown even when they have no learnings, in this fixed order.
// Any extra teams that appear in the data are appended (alphabetical) so the
// CSV can introduce new teams without a code change.
const DEFAULT_TEAMS = ["Engineering", "QA", "Product", "Solutions"];

// Per-team visual identity — accent color + icon. Unknown teams fall back to
// a neutral slate treatment so new teams still render cleanly.
const TEAM_STYLES = {
  Engineering: { icon: "🛠️", ring: "ring-indigo-100", bar: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700" },
  QA: { icon: "🔍", ring: "ring-emerald-100", bar: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700" },
  Product: { icon: "🧭", ring: "ring-violet-100", bar: "bg-violet-500", soft: "bg-violet-50 text-violet-700" },
  Solutions: { icon: "💡", ring: "ring-amber-100", bar: "bg-amber-500", soft: "bg-amber-50 text-amber-700" },
};
const FALLBACK_STYLE = { ring: "ring-slate-100", bar: "bg-slate-400", soft: "bg-slate-100 text-slate-600" };
// Fun, stable emoji for teams that aren't in the default set — picked
// deterministically from the team name so the same team always looks the same.
const FALLBACK_ICONS = ["🚀", "🎯", "⚡", "🔧", "📊", "🧪", "🛡️", "🎨", "🤝", "🌟"];
function iconFor(team, style) {
  if (style.icon) return style.icon;
  let hash = 0;
  for (let i = 0; i < team.length; i++) hash = (hash * 31 + team.charCodeAt(i)) >>> 0;
  return FALLBACK_ICONS[hash % FALLBACK_ICONS.length];
}

export default function TeamLearnings({ learnings = [] }) {
  const present = new Set();
  for (const l of learnings) {
    if (l?.team) present.add(String(l.team).trim());
  }
  const extras = [...present]
    .filter((t) => !DEFAULT_TEAMS.includes(t))
    .sort((a, b) => a.localeCompare(b));
  const teams = [...DEFAULT_TEAMS, ...extras];

  const byTeam = teams.reduce((acc, t) => ({ ...acc, [t]: [] }), {});
  for (const l of learnings) {
    const team = (l.team && String(l.team).trim()) || "Engineering";
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(l);
  }

  // Grid widens with team count: 4 default = 4 columns; more = wrap.
  const colsClass =
    teams.length > 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid gap-4 ${colsClass}`}>
      {teams.map((team) => {
        const style = TEAM_STYLES[team] || FALLBACK_STYLE;
        const items = byTeam[team];
        return (
          <div
            key={team}
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition hover:shadow-md hover:border-slate-300"
          >
            {/* Accent bar */}
            <div className={`h-1 w-full ${style.bar}`} />

            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ring-4 ${style.ring} ${style.soft}`}
              >
                {iconFor(team, style)}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-slate-800 leading-tight truncate">{team}</h4>
                <span className="text-[11px] text-slate-400">
                  {items.length === 0
                    ? "No learnings"
                    : `${items.length} learning${items.length !== 1 ? "s" : ""}`}
                </span>
              </div>
              {items.length > 0 && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${style.soft}`}>
                  {items.length}
                </span>
              )}
            </div>

            {/* Body */}
            <div className="px-3 pb-3 flex-1">
              {items.length === 0 ? (
                <div className="flex h-full min-h-[64px] items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  Nothing logged yet
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((l, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:bg-white hover:border-slate-200"
                    >
                      <p className="text-sm leading-snug text-slate-700">{l.learning}</p>
                      {(l.owner || l.dueDate) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {l.owner && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                              <span className="text-slate-400">👤</span>
                              {l.owner}
                            </span>
                          )}
                          {l.dueDate && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                              <span className="text-slate-400">📅</span>
                              {l.dueDate}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
