import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

type Props = {
  /** Where to go if there's no history to pop. Defaults to /home. */
  fallback?: string;
  className?: string;
  label?: string;
  /** Render as just the icon button without label. */
  iconOnly?: boolean;
};

/**
 * Native-style back button. Pops history when possible, falls back to a route.
 * Skips going back to common entry/auth routes.
 */
export default function BackButton({
  fallback = "/home",
  className = "",
  label = "Back",
  iconOnly = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const onClick = () => {
    const idx = (window.history.state && (window.history.state as any).idx) ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
    // Defensive: if path didn't change after a tick, force fallback.
    const from = location.pathname;
    setTimeout(() => {
      if (window.location.pathname === from) {
        navigate(fallback, { replace: true });
      }
    }, 250);
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`w-9 h-9 rounded-full hover:bg-muted active:scale-90 flex items-center justify-center transition ${className}`}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 h-9 px-2 -ml-1 rounded-md text-sm font-semibold text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition ${className}`}
    >
      <ArrowLeft className="w-[18px] h-[18px]" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Thin sticky header row containing a back button. Useful for pages that
 * don't have their own header bar.
 */
export function PageBackBar({
  title,
  fallback,
  right,
}: {
  title?: string;
  fallback?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-[var(--shell-header-h,0px)] z-30 bg-background/95 backdrop-blur border-b border-border/60">
      <div className="flex items-center gap-2 px-3 h-11">
        <BackButton fallback={fallback} iconOnly />
        {title && <h1 className="text-sm font-bold truncate">{title}</h1>}
        {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
      </div>
    </div>
  );
}
