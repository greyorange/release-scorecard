import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { fetchProjects } from "./api.js";
import { mockProjects } from "./data/mockData.js";
import ProjectTabs from "./components/ProjectTabs.jsx";
import ProjectView from "./components/ProjectView.jsx";
import AllReleases from "./components/AllReleases.jsx";
import NewReleaseForm from "./components/NewReleaseForm.jsx";
import RollbackControl from "./components/RollbackControl.jsx";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProjects();
        setProjects(data.length ? data : mockProjects);
      } catch (err) {
        console.error(err);
        setError("Failed to reach API — showing mock data.");
        setProjects(mockProjects);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <NavLink to="/" label="All Releases" exact />
            <NavLink to="/new" label="+ New Release" />
            <NavLink to="/admin/rollback" label="🔧 Rollback" />
            {error && (
              <span className="pill-conditional" title={error}>
                offline mode
              </span>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-slate-500">Loading…</div>
        ) : (
          <>
            {projects.length > 0 && <ProjectTabs projects={projects} />}
            <Routes>
              <Route path="/" element={<AllReleases />} />
              <Route path="/new" element={<NewReleaseForm />} />
              <Route path="/projects/:id/edit" element={<NewReleaseForm />} />
              <Route path="/projects/:id" element={<ProjectView />} />
              <Route path="/admin/rollback" element={<RollbackControl />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </>
        )}
      </main>
    </div>
  );
}

// Logo for the top nav. Tries /logo.svg first, then /logo.png, then a
// brand-coloured text fallback. Drop the file into release-dashboard/public/
// to make it appear — no other config needed.
function Logo() {
  const candidates = ["/logo.svg", "/logo.png"];
  const [idx, setIdx] = useState(0);
  const exhausted = idx >= candidates.length;

  if (exhausted) {
    // Fallback when no file is present.
    return (
      <span className="text-lg font-semibold tracking-tight">
        <span className="text-slate-900">Grey</span>
        <span className="text-orange-500">Orange</span>
      </span>
    );
  }
  return (
    <img
      src={candidates[idx]}
      alt="GreyOrange"
      className="h-10 w-auto"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

function NavLink({ to, label, exact }) {
  const { pathname } = useLocation();
  const isActive = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={[
        "text-sm px-3 py-1.5 rounded-lg border",
        isActive
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

