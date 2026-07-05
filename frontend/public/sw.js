/**
 * LeadBridge Service Worker
 *
 * Handles:
 * - Push notifications for new leads, bookings, and status changes
 * - Offline fallback page
 * - Cache-first strategy for static assets
 */

const CACHE_NAME = "leadbridge-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/auth/login",
  "/offline",
];

// ─── Install ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch (offline fallback) ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-HTTP(S) requests (e.g., WebSocket)
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.status === 200 &&
          event.request.destination === "document"
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline — serve cached page or fallback
        return caches.match(event.request).then((cached) => {
          return (
            cached ||
            caches.match("/offline") ||
            new Response("Offline", {
              status: 503,
              statusText: "Service Unavailable",
            })
          );
        });
      })
  );
});

// ─── Push Notifications ───────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const title = data.title || "LeadBridge";
    const options = {
      body: data.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag || "default",
      data: {
        url: data.url || "/dashboard",
        leadId: data.leadId,
        bookingId: data.bookingId,
      },
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [
        {
          action: "open",
          title: "Open LeadBridge",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[SW] Failed to show notification:", err);
  }
});

// ─── Notification Click ───────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen =
    event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ─── Background Sync ──────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-leads") {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const pendingRequests = await cache.match("/pending-sync");
    if (pendingRequests) {
      const requests = await pendingRequests.json();
      for (const req of requests) {
        try {
          await fetch(req.url, {
            method: req.method,
            headers: req.headers,
            body: req.body ? JSON.stringify(req.body) : undefined,
          });
        } catch (err) {
          console.error("[SW] Sync failed for:", req.url, err);
        }
      }
      await cache.delete("/pending-sync");
    }
  } catch (err) {
    console.error("[SW] Sync failed:", err);
  }
}
