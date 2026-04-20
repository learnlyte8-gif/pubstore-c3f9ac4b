import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pubstore.install.dismissedAt";
const SHOW_AFTER_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

/**
 * Shows a small floating banner inviting users to install the app.
 * - Android/Chrome: uses the native beforeinstallprompt event.
 * - iOS Safari: shows the manual "Add to Home Screen" instructions.
 * - Hidden in iframes (Lovable preview), already-installed apps,
 *   and for 7 days after a user dismisses it.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isInIframe() || isStandalone()) return;
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissed < SHOW_AFTER_MS) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIos()) {
      // iOS never fires beforeinstallprompt — show the manual hint after a short delay.
      const t = setTimeout(() => setShowIos(true), 4000);
      return () => { window.removeEventListener("beforeinstallprompt", onBip); clearTimeout(t); };
    }
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!deferred && !showIos) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-3 right-3 z-40 mx-auto max-w-sm">
      <div className="rounded-2xl bg-card border border-border shadow-elevated p-3 flex items-center gap-3 animate-fade-up">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-background font-bold shrink-0">
          P
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Install PUBSTORE</p>
          {deferred ? (
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              Add it to your home screen for one-tap shopping.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 flex items-center gap-1">
              Tap <Share className="w-3 h-3 inline" /> then <span className="font-semibold">Add to Home Screen</span>.
            </p>
          )}
        </div>
        {deferred && (
          <button
            onClick={install}
            className="bg-foreground text-background text-xs font-bold px-3 h-9 rounded-full inline-flex items-center gap-1 shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-muted-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
