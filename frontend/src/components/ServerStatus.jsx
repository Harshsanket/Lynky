import { useEffect, useState } from "react";
import { getStatus, refreshStatus } from "../lib/status-cache";

/**
 * ServerStatus — pill showing backend connectivity.
 *
 * Uses the shared 30-second status cache instead of polling on every mount, so
 * StrictMode remounts and duplicate components do not multiply requests.
 */
const ServerStatus = () => {
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let cancelled = false;

    const apply = (result) => {
      if (!cancelled) {
        setStatus(result?.online ? "connected" : "disconnected");
      }
    };

    getStatus()
      .then(apply)
      .catch(() => {
        if (!cancelled) setStatus("disconnected");
      });

    const handleOnline = () => {
      refreshStatus().then(apply).catch(() => apply({ online: false }));
    };

    const handleApiError = () => {
      refreshStatus().then(apply).catch(() => apply({ online: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("lynky:api-error", handleApiError);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("lynky:api-error", handleApiError);
    };
  }, []);

  const statusConfig = {
    connecting: {
      color: "#3b82f6",
      label: "connecting ...",
      animate: true,
    },

    connected: {
      color: "#22c55e",
      label: "server is connected",
      animate: true,
    },

    disconnected: {
      color: "#ef4444",
      label: "server unable to reach",
      animate: false,
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <span
      className="flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs"
      style={{
        borderColor: "var(--color-border)",
        color: "var(--color-ink-soft)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          currentStatus.animate ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: currentStatus.color,
        }}
      />

      {currentStatus.label}
    </span>
  );
};

export default ServerStatus;
