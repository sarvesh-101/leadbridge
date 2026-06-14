import { useAuthStore } from "../stores/auth.store";
import { useUIStore } from "../stores/ui.store";
import type { WebSocketEvent } from "../types";

type EventHandler = (event: WebSocketEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private isConnecting = false;
  private url = "";

  connect() {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken || this.isConnecting) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//localhost:3000`;
    this.url = `${host}/ws?token=${accessToken}`;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log("[WS] Connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data);
          this.notifyHandlers(wsEvent.event, wsEvent);
        } catch (err) {
          console.error("[WS] Failed to parse message", err);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        console.log(`[WS] Disconnected (code: ${event.code})`);
        // Reconnect after 5 seconds unless intentionally closed
        if (event.code !== 1000 && event.code !== 4001) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error("[WS] Error", err);
        this.isConnecting = false;
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
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
