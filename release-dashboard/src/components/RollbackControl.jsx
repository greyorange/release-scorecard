import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export default function RollbackControl() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backups, setBackups] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState("features");
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, backupsRes, metricsRes] = await Promise.all([
          api.get("/admin/rollback/status"),
          api.get("/admin/rollback/backups"),
          api.get("/admin/rollback/metrics"),
        ]);
        setStatus(statusRes.data);
        setBackups(backupsRes.data);
        setMetrics(metricsRes.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleFeature = async (feature, enabled) => {
    try {
      const res = await api.post("/admin/rollback/feature-flags", {
        feature,
        enabled,
      });
      setStatus(res.data);
    } catch (err) {
      setError(`Failed to toggle ${feature}: ${err.message}`);
    }
  };

  const restoreBackup = async (backupId) => {
    if (!confirmAction) {
      setConfirmAction({ type: "restore", id: backupId });
      return;
    }
    try {
      const res = await api.post("/admin/rollback/restore", { backupId });
      setStatus(res.data);
      setConfirmAction(null);
      setError(null);
    } catch (err) {
      setError(`Restore failed: ${err.message}`);
      setConfirmAction(null);
    }
  };

  const createBackup = async () => {
    try {
      const res = await api.post("/admin/rollback/backup");
      setBackups([res.data, ...backups]);
      setError(null);
    } catch (err) {
      setError(`Backup failed: ${err.message}`);
    }
  };

  const revertToVersion = async (version) => {
    if (!confirmAction) {
      setConfirmAction({ type: "version", version });
      return;
    }
    try {
      const res = await api.post("/admin/rollback/version", { version });
      setStatus(res.data);
      setConfirmAction(null);
      setError(null);
    } catch (err) {
      setError(`Version revert failed: ${err.message}`);
      setConfirmAction(null);
    }
  };

  if (loading) return <div className="text-slate-500">Loading rollback status…</div>;

  const isProduction = process.env.REACT_APP_ENV === "production";

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Rollback Control Panel</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage feature flags, backups, and scorecard versions
        </p>
        {isProduction && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-sm font-semibold text-red-700">⚠️ PRODUCTION ENVIRONMENT</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-800">
          <span className="font-semibold">Error:</span> {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-600 hover:text-red-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card max-w-md">
            <h3 className="font-bold text-lg mb-2 text-slate-900">Confirm Action</h3>
            <p className="text-sm text-slate-600 mb-4">
              {confirmAction.type === "restore"
                ? `Restore from backup ${confirmAction.id}? This will overwrite current data.`
                : `Revert scorecard version to ${confirmAction.version}? This affects all displays.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === "restore") {
                    restoreBackup(confirmAction.id);
                  } else {
                    revertToVersion(confirmAction.version);
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: "features", label: "Feature Flags", icon: "🚩" },
          { id: "versions", label: "Score Versions", icon: "📊" },
          { id: "backups", label: "Backups", icon: "💾" },
          { id: "metrics", label: "Metrics", icon: "📈" },
          { id: "history", label: "History", icon: "📜" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Feature Flags Tab */}
      {activeTab === "features" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4 text-slate-900">Phase 1 Features</h2>
            <div className="space-y-3">
              {status?.features?.phase1?.map((feature) => (
                <FeatureToggle
                  key={feature.name}
                  feature={feature}
                  onToggle={toggleFeature}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-lg mb-4 text-slate-900">Phase 2 Features</h2>
            <div className="space-y-3">
              {status?.features?.phase2?.map((feature) => (
                <FeatureToggle
                  key={feature.name}
                  feature={feature}
                  onToggle={toggleFeature}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Score Versions Tab */}
      {activeTab === "versions" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4 text-slate-900">Active Scoring Version</h2>
            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <div className="text-sm text-slate-600">Currently Displayed</div>
              <div className="text-2xl font-bold text-slate-900">v{status?.currentVersion}</div>
              <div className="text-xs text-slate-500 mt-1">
                Active since {new Date(status?.versionChangedAt).toLocaleString()}
              </div>
            </div>

            <div className="grid gap-3">
              {["v1", "v2", "v3"].map((version) => (
                <div key={version} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <div className="font-semibold text-slate-900">{version}</div>
                    <div className="text-xs text-slate-500">
                      {version === "v1" && "Legacy 5-factor model"}
                      {version === "v2" && "New 3-factor quality model (SOP, Product, Features)"}
                      {version === "v3" && "Future: Extended 4-aspect model"}
                    </div>
                  </div>
                  <button
                    onClick={() => revertToVersion(version)}
                    disabled={status?.currentVersion === version}
                    className={`px-4 py-2 text-sm rounded-lg font-medium transition ${
                      status?.currentVersion === version
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {status?.currentVersion === version ? "Active" : "Switch"}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <strong>ℹ️ Both versions run in parallel.</strong> Switching only changes what users see; old data is preserved.
            </div>
          </div>

          {/* Version Comparison */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4 text-slate-900">Score Comparison (Sample)</h2>
            <VersionComparison data={metrics?.versionComparison} />
          </div>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-slate-900">Data Backups</h2>
              <button
                onClick={createBackup}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"
              >
                + Create Backup Now
              </button>
            </div>

            <div className="space-y-3">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-sm">No backups yet.</div>
                  <button
                    onClick={createBackup}
                    className="text-blue-600 hover:underline text-sm mt-2"
                  >
                    Create one now
                  </button>
                </div>
              ) : (
                backups.map((backup) => (
                  <BackupCard key={backup.id} backup={backup} onRestore={restoreBackup} />
                ))
              )}
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>⚠️ Backups are stored locally.</strong> Restore will overwrite current data. Always create a backup before major changes.
            </div>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === "metrics" && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <MetricCard
              title="Score Calculation Health"
              value={metrics?.scoreHealth?.successRate}
              unit="%"
              status={metrics?.scoreHealth?.successRate > 95 ? "good" : "warning"}
              details={metrics?.scoreHealth?.details}
            />
            <MetricCard
              title="Phase 1 Feature Usage"
              value={metrics?.usage?.phase1Releases}
              unit="releases"
              details={`${metrics?.usage?.phase1Percentage}% with new fields`}
            />
            <MetricCard
              title="Phase 2 Feature Usage"
              value={metrics?.usage?.phase2Releases}
              unit="releases"
              details={`${metrics?.usage?.phase2Percentage}% with hierarchy`}
            />
            <MetricCard
              title="API Response Time"
              value={metrics?.performance?.p99LatencyMs}
              unit="ms"
              status={metrics?.performance?.p99LatencyMs < 500 ? "good" : "warning"}
              details="p99 scorecard API calls"
            />
          </div>

          {/* Health Checks */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4 text-slate-900">System Health Checks</h2>
            <div className="space-y-2">
              {metrics?.healthChecks?.map((check) => (
                <div key={check.name} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">{check.name}</div>
                    <div className="text-xs text-slate-500">{check.message}</div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      check.status === "ok"
                        ? "bg-green-100 text-green-700"
                        : check.status === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {check.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4 text-slate-900">Rollback History</h2>
          <div className="space-y-3">
            {status?.history?.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No rollback history yet.</div>
            ) : (
              status?.history?.map((entry, i) => (
                <div key={i} className="flex gap-4 p-3 border border-slate-200 rounded-lg">
                  <div className="text-2xl">{getHistoryIcon(entry.type)}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{entry.action}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(entry.timestamp).toLocaleString()} by {entry.user}
                    </div>
                    {entry.reason && (
                      <div className="text-sm text-slate-600 mt-1">Reason: {entry.reason}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        entry.status === "success" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {entry.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Sub-components */

function FeatureToggle({ feature, onToggle }) {
  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
      <div className="flex-1">
        <div className="font-semibold text-slate-900">{feature.name}</div>
        <div className="text-xs text-slate-500">{feature.description}</div>
        {feature.phase && (
          <div className="text-[10px] text-slate-400 mt-1">Phase {feature.phase}</div>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={feature.enabled}
          onChange={(e) => onToggle(feature.name, e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
      </label>
    </div>
  );
}

function BackupCard({ backup, onRestore }) {
  const sizeGb = (backup.sizeBytes / 1e9).toFixed(2);
  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
      <div className="flex-1">
        <div className="font-semibold text-slate-900">{backup.id}</div>
        <div className="text-xs text-slate-500">
          {new Date(backup.createdAt).toLocaleString()} · {sizeGb} GB · {backup.releaseCount} release
          {backup.releaseCount !== 1 ? "s" : ""}
        </div>
        {backup.reason && (
          <div className="text-sm text-slate-600 mt-1">Note: {backup.reason}</div>
        )}
      </div>
      <button
        onClick={() => onRestore(backup.id)}
        className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium"
      >
        Restore
      </button>
    </div>
  );
}

function MetricCard({ title, value, unit, status = "neutral", details }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-600">{title}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{unit}</div>
      </div>
      {details && (
        <div className="text-xs text-slate-500 mt-2">{details}</div>
      )}
      {status === "good" && <div className="mt-2 h-1 bg-green-500 rounded-full" />}
      {status === "warning" && <div className="mt-2 h-1 bg-amber-500 rounded-full" />}
      {status === "bad" && <div className="mt-2 h-1 bg-red-500 rounded-full" />}
    </div>
  );
}

function VersionComparison({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-slate-500 py-4 text-sm">No comparison data available.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-900">Release</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-900">v1 Score</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-900">v2 Score</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-900">Δ</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const delta = row.v2 - row.v1;
            const deltaColor = delta > 5 ? "text-red-600" : delta < -5 ? "text-green-600" : "text-slate-600";
            return (
              <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-right">{row.v1}</td>
                <td className="px-4 py-3 text-right">{row.v2}</td>
                <td className={`px-4 py-3 text-right font-semibold ${deltaColor}`}>{delta > 0 ? "+" : ""}{delta}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getHistoryIcon(type) {
  if (type === "feature_flag") return "🚩";
  if (type === "backup_restore") return "💾";
  if (type === "version_change") return "📊";
  if (type === "manual_rollback") return "⏮️";
  return "📝";
}
