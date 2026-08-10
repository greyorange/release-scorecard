import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useIsDark } from "../useTheme.js";

const STAGE_KEYS = [
  { key: "sqa", label: "QA" },
  { key: "sit", label: "SIT/UAT/HAT" },
  { key: "production", label: "Production" },
];

// Renders the bugs-per-stage chart. Two modes depending on how much detail
// the underlying CSV carries:
//   - Rich schema (DHL CSV): stacked Product / Module / SA-SI bars.
//   - Simple schema (form-entered): single "Bugs" bar per stage using the
//     stage total. Without this fallback, simple-schema releases had an
//     empty chart even with bug counts entered.
export default function StageBreakdown({ stages }) {
  const isDark = useIsDark();
  if (!stages) return null;

  const axis = isDark ? "#8b93a3" : "#64748b";
  const tooltipStyle = isDark
    ? { background: "#12161d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e6e9ef" }
    : { borderRadius: 12 };

  const hasCategoryBreakdown = STAGE_KEYS.some(({ key }) => {
    const s = stages[key] || {};
    return (s.product || 0) + (s.module || 0) + (s.saSi || 0) > 0;
  });

  if (hasCategoryBreakdown) {
    const data = STAGE_KEYS.map(({ key, label }) => {
      const s = stages[key] || {};
      return {
        stage: label,
        Product: s.product || 0,
        Module: s.module || 0,
        "SA/SI": s.saSi || 0,
      };
    });
    return (
      <ChartCard title="Bugs by Stage & Category">
        <BarChart data={data}>
          <XAxis dataKey="stage" fontSize={12} stroke={axis} tick={{ fill: axis }} />
          <YAxis fontSize={12} stroke={axis} tick={{ fill: axis }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
          <Legend wrapperStyle={{ color: axis, fontSize: 12 }} />
          <Bar dataKey="Product" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Module" stackId="a" fill="#f97316" />
          <Bar dataKey="SA/SI" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    );
  }

  // Fallback: totals-only view (form-entered releases carry stage totals only).
  const totalsData = STAGE_KEYS.map(({ key, label }) => ({
    stage: label,
    Bugs: (stages[key] || {}).total || 0,
  }));
  const allZero = totalsData.every((d) => d.Bugs === 0);
  if (allZero) return null;

  return (
    <ChartCard title="Bugs by Stage">
      <BarChart data={totalsData}>
        <XAxis dataKey="stage" fontSize={12} stroke={axis} tick={{ fill: axis }} />
        <YAxis fontSize={12} stroke={axis} tick={{ fill: axis }} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
        <Bar dataKey="Bugs" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartCard>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="section-title">{title}</h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}
