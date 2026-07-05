/**
 * PWA — Service Worker Registration & Push Notification Setup
 *
 * Registers the service worker and handles push notification
 * subscription through the browser's Push API.
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.log("[PWA] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log(
      "[PWA] Service worker registered:",
      registration.scope
    );

    return registration;
  } catch (err) {
    console.error("[PWA] Service worker registration failed:", err);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!("Notification" in window)) {
    console.log("[PWA] Notifications not supported");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("[PWA] Notification permission denied");
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.pushManager) {
    console.log("[PWA] Push messaging not supported");
    return null;
  }

  try {
    // Get existing subscription first
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe with a VAPID public key (configure on backend)
      // For now, subscribe without key for testing
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined, // Will be configured when VAPID keys are set up
      });
    }

    return subscription;
  } catch (err) {
    console.error("[PWA] Push subscription failed:", err);
    return null;
  }
}

/**
 * Initialize PWA features.
 * Call this from a useEffect in the root layout or dashboard layout.
 * No need for load event wrapper — useEffect already runs after mount.
 */
export function initPWA() {
  if (typeof window === "undefined") return;
  registerServiceWorker();
}
