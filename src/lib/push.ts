// Web Push subscription helpers.
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key — safe to ship in the frontend.
const VAPID_PUBLIC_KEY =
  "BI1sNRQWMdr3EkAdRFLkwF8orl0LaIPZ8ACaVFI4Z8fLGrzdmyuKiS46wl9przAzK8xE156g6aKnxGl8j0hYtw0";

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Get the current permission + active subscription state without prompting. */
export async function getPushState(): Promise<{
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  try {
    const reg = await ensureRegistration();
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: !!sub,
    };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
}

/** Prompt for permission, subscribe, and persist the subscription server-side. */
export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Notifications are not supported on this device." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Sign in first." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Permission denied" };

  const reg = await ensureRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast to BufferSource — TS lib types are stricter than the runtime spec.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth"));

  if (!endpoint || !p256dh || !auth) return { ok: false, reason: "Invalid subscription" };

  // Upsert by endpoint
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Unsubscribe from this device and remove the row from the DB. */
export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  return { ok: true };
}
