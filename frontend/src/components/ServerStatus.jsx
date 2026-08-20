import { useEffect, useState } from "react";
import { checkBackendHealth } from "../api/ping.api";

/**
 * ServerStatus — pill showing backend connectivity. Pings `/ping` every
 * second for up to 2 minutes (so a cold start isn't flagged as offline).
 */
const ServerStatus = () => {
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      const endTime = Date.now() + 2 * 60 * 1000;

      while (!cancelled && Date.now() < endTime) {
        try {
          const result = await checkBackendHealth();

          if (cancelled) return;

          if (result.online) {
            setStatus("connected");
            return;
          }
        } catch {
          // Keep trying until the 2-minute timeout.
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!cancelled) {
        setStatus("disconnected");
      }
    };

    checkServer();

    return () => {
      cancelled = true;
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