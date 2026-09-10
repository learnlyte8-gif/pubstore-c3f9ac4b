import { useEffect, useState } from "react";
import { X, Play } from "lucide-react";
import logo from "@/assets/pubstore-logo.png";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kuki.kkallinonestore";
const DISMISS_KEY = "pubstore_open_app_banner_dismissed_v1";

export function OpenAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) return;
    } catch { /* ignore */ }

    // Only show on web browsers, not inside the installed PWA or native apps.
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (!isStandalone) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className="relative z-[60] w-full safe-top bg-gradient-to-r from-[hsl(142_72%_42%)] via-[hsl(213_89%_52%)] to-[hsl(24_100%_56%)] text-white shadow-elevated">
      <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_20%_0%,hsl(0_0%_100%/0.25),transparent_60%)]" />
      <div className="max-w-2xl lg:max-w-[1600px] mx-auto px-3 lg:px-6 py-2.5 relative">
        <div className="flex items-center gap-3">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 shadow-sm active:scale-95 transition"
            aria-label="PUBSTORE app icon"
          >
            <img
              src={logo}
              alt="PUBSTORE"
              className="w-7 h-7 object-contain drop-shadow-sm"
            />
          </a>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold leading-tight truncate">
              Better on the PUBSTORE app
            </p>
            <p className="text-[11px] font-medium text-white/85 leading-tight truncate">
              Faster checkout, live chat & exclusive deals
            </p>
          </div>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white text-foreground text-[12px] font-extrabold shadow-[0_2px_8px_-2px_hsl(0_0%_0%/_0.25)] active:scale-95 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" strokeWidth={0} />
            OPEN
          </a>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss banner"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15 active:scale-90 transition"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default OpenAppBanner;
