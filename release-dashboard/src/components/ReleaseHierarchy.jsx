// Phase 2: Release Hierarchy Tree
// Shows releases organized by parent-child relationships
// Major releases contain weekly/hotfix sub-releases

import { useNavigate } from "react-router-dom";

export default function ReleaseHierarchy({ hierarchy = {}, onSelectRelease = null }) {
  const nav = useNavigate();
  const tree = hierarchy.tree || [];

  if (tree.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-3">Release Hierarchy</h3>
        <div className="text-center py-6 text-slate-500 text-sm">
          No hierarchical data available. Enable Phase 2 features to see release families.
        </div>
      </div>
    );
  }

  const handleSelect = (releaseId) => {
    if (onSelectRelease) {
      onSelectRelease(releaseId);
    } else {
      nav(`/projects/${releaseId}`);
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-4">Release Hierarchy</h3>
      <div className="space-y-2">
        {tree.map((root) => (
          <TreeNode key={root.id} node={root} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, onSelect, depth = 0 }) {
  const hasChildren = node.childCount > 0;
  const indent = depth * 20;

  const scoreColor =
    node.score >= 80
      ? "bg-green-100 text-green-700"
      : node.score >= 60
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  const typeColor = {
    major: "bg-blue-100 text-blue-700",
    minor: "bg-slate-100 text-slate-700",
    weekly: "bg-purple-100 text-purple-700",
    hotfix: "bg-red-100 text-red-700",
    patch: "bg-amber-100 text-amber-700",
  }[node.releaseType] || "bg-slate-100 text-slate-700";

  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className={`w-full text-left p-3 rounded-lg border transition hover:shadow-md ${
          hasChildren ? "border-blue-200 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
        }`}
        style={{ marginLeft: `${indent}px` }}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left side: expand icon + name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren && (
              <span className="text-xs text-slate-500 shrink-0">
                {node.childCount === 1 ? "▶" : "▼"} {node.childCount}
              </span>
            )}
            {!hasChildren && <span className="text-xs text-slate-300 shrink-0">└</span>}

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 truncate">{node.releaseVersion}</div>
              <div className="text-xs text-slate-600 truncate">{node.projectName}</div>
            </div>
          </div>

          {/* Right side: badges and score */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeColor}`}>
              {node.releaseType?.toUpperCase() || "MINOR"}
            </span>
            {node.score != null && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${scoreColor}`}>
                {node.score}
              </span>
            )}
            {node.recommendation && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  node.recommendation === "go"
                    ? "bg-green-100 text-green-700"
                    : node.recommendation === "conditional"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {node.recommendation.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Children */}
      {hasChildren && node.children && (
        <div className="space-y-1 mt-1">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
