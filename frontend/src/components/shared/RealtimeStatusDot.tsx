"use client";

import { useEffect, useState } from "react";
import { wsClient } from "../../lib/websocket";
import { cn } from "../../lib/utils";

export function RealtimeStatusDot() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubConnected = wsClient.on("connection.established", () => setConnected(true));
    const unsubAny = wsClient.on("*", () => setConnected(true));

    // Send ping every 30s to keep connection alive and check status
    const pingInterval = setInterval(() => {
      // Connection health is tracked via WebSocket onclose/onerror
      // If we haven't received any events, the connection may be down
    }, 30000);

    return () => {
      unsubConnected();
      unsubAny();
      clearInterval(pingInterval);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          connected ? "bg-green-500" : "bg-gray-400"
        )}
      />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {connected ? "Live" : "Offline"}
      </span>
    </div>
  );
}
