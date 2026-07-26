/* PT Kharade — background push service worker.
 *
 * Runs when the portal tab is CLOSED, so it can show a system notification
 * for a new order or a run update. The open-tab case is already covered by
 * the SSE live feed on the dashboard.
 *
 * Firebase config here is the PUBLIC client config (apiKey, projectId, etc.) —
 * safe to ship to the browser; it is not a secret. It is injected at build/
 * deploy time by replacing the placeholders below, or served via a small
 * config endpoint. Left as placeholders so the file is inert until a real
 * project is wired up — an unconfigured SW simply never receives a message.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Replace these with the real project's web config (or inject at deploy).
const FIREBASE_CONFIG = {
  apiKey: '__FIREBASE_API_KEY__',
  authDomain: '__FIREBASE_AUTH_DOMAIN__',
  projectId: '__FIREBASE_PROJECT_ID__',
  messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__FIREBASE_APP_ID__',
};

// Only initialise when configured — placeholders mean "push not set up".
if (!FIREBASE_CONFIG.projectId.startsWith('__')) {
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? 'PT Kharade';
    const body = payload.notification?.body ?? payload.data?.body ?? '';
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      // Collapse repeat pushes about the same order into one notification.
      tag: payload.data?.OrderId ?? undefined,
      data: payload.data ?? {},
    });
  });

  // Tapping the notification focuses the portal (or opens it) and deep-links
  // to the order when one is attached.
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const orderId = event.notification.data?.OrderId;
    const url = orderId ? `/orders/${orderId}` : '/dashboard';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const c of clients) {
          if ('focus' in c) { c.navigate(url); return c.focus(); }
        }
        return self.clients.openWindow(url);
      }),
    );
  });
}
