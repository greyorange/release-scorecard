import { useEffect, useState } from "react";

// Tracks whether the app is currently in dark mode by watching the `dark`
// class on <html>. Lets non-CSS surfaces (e.g. Recharts, which takes colors
// as props) restyle live when the theme slider is toggled.
export function useIsDark() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() =>
      setDark(el.classList.contains("dark")),
    );
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}
