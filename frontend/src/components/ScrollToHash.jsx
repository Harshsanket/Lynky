/**
 * Scrolls to the element referenced by the URL hash (e.g. `#ios-shortcut`)
 * on navigation. Renders nothing.
 *
 * Extracted from `Layout` so it does not get re-created on every render.
 */

import { useEffect } from "react";
import { useLocation } from "react-router";

export default function ScrollToHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const rawId = hash.slice(1);

    let id = rawId;

    try {
      id = decodeURIComponent(rawId);
    } catch {
      // Malformed percent-encoding (e.g. `#%`) should not crash the app.
    }

    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [hash]);

  return null;
}