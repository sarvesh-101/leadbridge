import { useAuthStore } from "../stores/auth.store";
import { useUIStore } from "../stores/ui.store";
import type { WebSocketEvent } from "../types";

type EventHandler = (event: WebSocketEvent) => void;

/**
 * Exponential backoff parameters for WebSocket reconnection.
 * Base: 1s, max: 30s, with random jitter to avoid thundering herd.
 */
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Polling fallback interval (used when WebSocket is unavailable).
 * Polls the leads endpoint every 15 seconds for real-time updates.
 */
const POLLING_INTERVAL_MS = 15000;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private url = "";
  private reconnectAttempts = 0;
  private connectionId = 0;

  // Polling fallback state
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = "";
  private isPolling = false;

  connect() {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken || this.isConnecting) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//localhost:3000`;
    this.url = `${host}/ws?token=${accessToken}`;

    // Increment connection ID to invalidate stale connect() calls
    const connId = ++this.connectionId;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (connId !== this.connectionId) return;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.stopPolling(); // Stop polling when WS connects
        console.log("[WS] Connected");
      };

      this.ws.onmessage = (event) => {
        if (connId !== this.connectionId) return;
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data);
          this.notifyHandlers(wsEvent.event, wsEvent);
        } catch (err) {
          console.error("[WS] Failed to parse message", err);
        }
      };

      this.ws.onclose = (event) => {
        if (connId !== this.connectionId) return;
        this.isConnecting = false;
        console.log(`[WS] Disconnected (code: ${event.code}, attempt: ${this.reconnectAttempts})`);

        if (event.code !== 1000 && event.code !== 4001) {
          this.scheduleReconnect();
        } else {
          // Intentional close — start polling as fallback
          this.startPolling();
        }
      };

      this.ws.onerror = () => {
        if (connId !== this.connectionId) return;
        this.isConnecting = false;
      };
    } catch (err) {
      if (connId !== this.connectionId) return;
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.connectionId++; // Invalidate any in-flight connections
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.stopPolling();
    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Start polling as fallback when WebSocket is unavailable.
   * Uses a lightweight endpoint to check for recent lead changes.
   */
  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log("[WS] WebSocket unavailable — starting polling fallback");

    this.pollingTimer = setInterval(async () => {
      try {
        const { accessToken, isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated || !accessToken) {
          this.stopPolling();
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
        const params = new URLSearchParams({
          limit: "10",
          ...(this.lastPollTimestamp ? { updatedSince: this.lastPollTimestamp } : {}),
        });

        const response = await fetch(`${apiBase}/leads?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          this.lastPollTimestamp = new Date().toISOString();

          // Emit events for any new/changed leads
          if (data.leads?.length) {
            data.leads.forEach((lead: any) => {
              this.notifyHandlers("lead.status_changed", {
                event: "lead.status_changed",
                data: { leadId: lead.id, newStatus: lead.status },
                timestamp: new Date().toISOString(),
              });
            });
          }
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling fallback.
   */
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
  }

  private notifyHandlers(event: string, data: WebSocketEvent) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }

    // Also notify wildcard handlers
    const wildcardHandlers = this.handlers.get("*");
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(data));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[WS] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — switching to polling`);
      this.startPolling();
      return;
    }

    if (this.reconnectTimer) return;

    // Exponential backoff with jitter: base^attempt * (0.5 + random)
    const exponentialDelay = RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts);
    const cappedDelay = Math.min(exponentialDelay, RECONNECT_MAX_MS);
    const jitter = cappedDelay * (0.5 + Math.random() * 0.5); // 50-100% of capped delay
    const delay = Math.round(jitter);

    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new WebSocketClient();

// React hook for WebSocket events
import { useEffect } from "react";

export function useWebSocket(event: string, handler: EventHandler) {
  useEffect(() => {
    const unsubscribe = wsClient.on(event, handler);
    return unsubscribe;
  }, [event, handler]);
}

export function useLeadStatusUpdates(onStatusChange: (leadId: string, newStatus: string) => void) {
  useWebSocket("lead.status_changed", (event) => {
    if (event.data.leadId && event.data.newStatus) {
      onStatusChange(event.data.leadId as string, event.data.newStatus as string);
    }
  });
}
