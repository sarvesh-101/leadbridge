import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * WebSocket Plugin — Real-time lead event streaming using @fastify/websocket.
 *
 * Clients connect via: wss://api.leadbridge.com/ws?token=<jwt>
 * Server validates JWT on connection, subscribes client to their clientId channel.
 * Events are published to Redis "lead:events" channel and forwarded to connected clients.
 */

const clients = new Map<string, Set<import("ws")>>();

export function getConnectedClientsCount(): number {
  let count = 0;
  for (const sockets of clients.values()) {
    count += sockets.size;
  }
  return count;
}

const websocketPlugin = fp(async (fastify: FastifyInstance) => {
  // Subscribe to Redis pub/sub for lead events (optional in dev)
  let subClient: Redis | null = null;
  if (config.NODE_ENV !== "development" || config.REDIS_URL !== "redis://localhost:6379") {
    try {
      subClient = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });
      await subClient.connect();

      subClient.subscribe("lead:events", (err) => {
        if (err) {
          logger.error({ err }, "Failed to subscribe to lead:events");
          return;
        }
        logger.info("WS: Subscribed to lead:events Redis channel");
      });

      subClient.on("message", (channel: string, message: string) => {
        if (channel !== "lead:events") return;

        try {
          const event = JSON.parse(message);
          const clientSockets = clients.get(event.clientId);

          if (clientSockets) {
            const payload = JSON.stringify({
              event: event.event,
              data: event.data,
              timestamp: event.timestamp,
            });

            for (const ws of clientSockets) {
              if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(payload);
              }
            }
          }
        } catch (err: any) {
          logger.error({ err: err.message }, "WS: Failed to process message");
        }
      });
    } catch (err) {
      logger.warn({ err }, "WS: Redis unavailable — running without pub/sub");
      subClient = null;
    }
  } else {
    logger.warn("WS: Redis not configured — running without pub/sub");
  }

  // WebSocket route
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(4001, "Missing authentication token");
      return;
    }

    // Validate JWT
    let decoded: { sub: string; role: string; clientId?: string; type: string };
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as typeof decoded;
      if (decoded.type !== "access") {
        socket.close(4003, "Invalid token type");
        return;
      }
    } catch {
      socket.close(4002, "Invalid or expired token");
      return;
    }

    const clientId = decoded.clientId || decoded.sub;
    logger.info({ clientId }, "WS: Client connected");

    // Register client
    if (!clients.has(clientId)) {
      clients.set(clientId, new Set());
    }
    clients.get(clientId)!.add(socket);

    // Send connection confirmation
    socket.send(JSON.stringify({
      event: "connection.established",
      data: { clientId, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    }));

    // Handle disconnection
    socket.on("close", () => {
      const clientSockets = clients.get(clientId);
      if (clientSockets) {
        clientSockets.delete(socket);
        if (clientSockets.size === 0) {
          clients.delete(clientId);
        }
      }
      logger.info({ clientId }, "WS: Client disconnected");
    });

    socket.on("error", (err: Error) => {
      logger.error({ clientId, err: err.message }, "WS: Client error");
    });

    // Handle pings
    socket.on("message", (data: import("ws").RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ event: "pong", data: {}, timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore invalid messages
      }
    });
  });

  // Cleanup
  fastify.addHook("onClose", async () => {
    if (subClient) {
      subClient.unsubscribe();
      subClient.quit();
    }
    for (const [, sockets] of clients) {
      for (const ws of sockets) {
        ws.close(1001, "Server shutting down");
      }
    }
    clients.clear();
  });
});

export default websocketPlugin;
