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

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private url = "";
  private reconnectAttempts = 0;
  private connectionId = 0;

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
        // Ignore if a newer connection attempt superseded this one
        if (connId !== this.connectionId) return;
        this.isConnecting = false;
        this.reconnectAttempts = 0; // Reset on successful connection
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

        // Don't reconnect on intentional close (code 1000) or auth reject (4001)
        if (event.code !== 1000 && event.code !== 4001) {
          this.scheduleReconnect();
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
      console.warn(`[WS] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached — giving up`);
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
