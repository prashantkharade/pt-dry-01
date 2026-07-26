import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { PUBLIC_FIREBASE_API_KEY, PUBLIC_FIREBASE_AUTH_DOMAIN, PUBLIC_FIREBASE_PROJECT_ID, PUBLIC_FIREBASE_MESSAGING_SENDER_ID, PUBLIC_FIREBASE_APP_ID, PUBLIC_FIREBASE_VAPID_KEY } from '$env/static/public';

/////////////////////////////////////////////////////////////////////////
//  Web push for the admin portal.
//
//  This adds BACKGROUND notifications — new order, run update — for staff
//  who have closed the tab. The open-tab case is already handled by the SSE
//  live feed, so this is purely additive and entirely optional.
//
//  Env-gated: with no PUBLIC_FIREBASE_* vars this is a no-op. It never
//  interrupts a working portal to ask for notification permission unless
//  the operator has actually configured Firebase.
/////////////////////////////////////////////////////////////////////////

const configured =
  !!PUBLIC_FIREBASE_PROJECT_ID &&
  !!PUBLIC_FIREBASE_API_KEY &&
  !!PUBLIC_FIREBASE_VAPID_KEY;

/** A stable per-browser id, persisted so re-registration updates in place. */
function deviceId(): string {
  const key = 'ptk_web_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Register this browser for push, if configured and permitted.
 *
 * Returns quietly on every "not now" path — unsupported browser, no config,
 * permission denied. None of those is an error the operator needs to see.
 */
export async function registerWebPush(): Promise<void> {
  if (!configured) return;
  if (!(await isSupported().catch(() => false))) return;

  // Ask only after the user is in the app; a permission prompt on a public
  // page is the fastest way to get permanently blocked.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  try {
    const app = initializeApp({
      apiKey: PUBLIC_FIREBASE_API_KEY,
      authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: PUBLIC_FIREBASE_APP_ID,
    });
    const messaging = getMessaging(app);

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    // Foreground messages: the browser won't show a system notification while
    // the tab is focused, so surface them ourselves (a toast could go here).
    onMessage(messaging, (payload) => {
      // eslint-disable-next-line no-console
      console.info('[push] foreground message', payload.notification?.title);
    });

    // Hand the token to the BFF, which forwards it to identity-service.
    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DeviceId: deviceId(), FcmToken: token, DeviceName: navigator.userAgent.slice(0, 80) }),
    });
  } catch (e) {
    // Never break the portal over a push failure.
    // eslint-disable-next-line no-console
    console.warn('[push] registration failed', e);
  }
}
