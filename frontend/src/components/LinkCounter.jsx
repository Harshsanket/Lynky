import { useEffect, useState } from "react";
import { getStatus, refreshStatus } from "../lib/status-cache";

const LINKS_UPDATED_EVENT = "lynky:links-updated";

/**
 * LinkCounter — pill showing the global "links cleaned & shortened" count.
 * Reads the same cached `/status` response as ServerStatus and refreshes after
 * a successful shorten, throttled by the cache to at most once per 30s.
 */
const LinkCounter = () => {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (result) => {
      if (
        !cancelled &&
        typeof result?.totalLinks === "number" &&
        Number.isFinite(result.totalLinks)
      ) {
        setTotal(result.totalLinks);
      }
    };

    getStatus().then(apply).catch(() => undefined);

    const refresh = () => {
      refreshStatus().then(apply).catch(() => undefined);
    };

    window.addEventListener(LINKS_UPDATED_EVENT, refresh);

    return () => {
      cancelled = true;
      window.removeEventListener(LINKS_UPDATED_EVENT, refresh);
    };
  }, []);

  if (typeof total !== "number" || !Number.isFinite(total)) return null;

  return (
    <span
      className="flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs"
      style={{
        borderColor: "var(--color-border)",
        color: "var(--color-ink-soft)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {total.toLocaleString()} links cleaned & shortened
    </span>
  );
};

export default LinkCounter;
