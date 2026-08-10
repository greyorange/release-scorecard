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
      <nav className="site-nav no-print">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center group">
            <Logo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <NavLink to="/" label="All Releases" exact />
            <NavLink to="/new" label="+ New Release" />
            <NavLink to="/admin/rollback" label="🔧 Rollback" />
            {error && (
              <span className="pill-conditional" title={error}>
                offline mode
              </span>
            )}
            <ThemeToggle />
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
      <span className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white text-base font-bold shadow-brand">
          G
        </span>
        <span className="text-lg font-bold tracking-tight leading-none">
          <span className="text-slate-900">Grey</span>
          <span className="text-gradient">Orange</span>
        </span>
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
        "text-sm px-3 py-1.5 rounded-lg border transition-colors",
        isActive
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 text-slate-700 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

// Light/dark slider. Applies the `dark` class to <html> and persists the
// choice; initial state mirrors what the pre-paint script already set.
function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const apply = (next) => {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore storage errors */
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => apply(!dark)}
      className={[
        "relative inline-flex h-7 w-[54px] shrink-0 items-center rounded-full border transition-colors duration-300 no-print",
        dark ? "bg-slate-800 border-white/10" : "bg-amber-100 border-amber-200",
      ].join(" ")}
    >
      <span
        className={[
          "relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] leading-none shadow transition-transform duration-300",
          dark ? "translate-x-[29px] shadow-brand" : "translate-x-[3px]",
        ].join(" ")}
      >
        {dark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

