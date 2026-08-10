import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useIsDark } from "../useTheme.js";

export default function HistoryChart({ history = [] }) {
  const isDark = useIsDark();
  if (history.length < 2) return null;
  const data = history.map((r) => ({
    release: r.releaseVersion,
    score: r.scorecard?.score ?? null,
  }));

  const grid = isDark ? "rgba(255,255,255,0.09)" : "#e2e8f0";
  const axis = isDark ? "#8b93a3" : "#64748b";
  const line = "#f97316"; // GreyOrange brand accent

  return (
    <div className="card">
      <h3 className="section-title">Score Trend</h3>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="release" fontSize={12} stroke={axis} tick={{ fill: axis }} />
            <YAxis domain={[0, 100]} fontSize={12} stroke={axis} tick={{ fill: axis }} />
            <Tooltip
              contentStyle={
                isDark
                  ? {
                      background: "#12161d",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#e6e9ef",
                    }
                  : { borderRadius: 12 }
              }
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={line}
              strokeWidth={2.5}
              dot={{ r: 4, fill: line, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
