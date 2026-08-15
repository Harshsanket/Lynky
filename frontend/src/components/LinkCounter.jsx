import { useEffect, useState } from "react";
import { getTotalLinks } from "../api/stats.api";

const LinkCounter = () => {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getTotalLinks()
      .then((count) => {
        if (!cancelled) setTotal(count);
      })
      .catch(() => {
        if (!cancelled) setTotal(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (total === null) return null;

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