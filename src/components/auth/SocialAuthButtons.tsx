import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import CircleSpinner from "@/components/CircleSpinner";

type Provider = "google" | "apple" | "microsoft";

/** Where to send the user once the session is confirmed. Kept out of
 *  `redirect_uri` so the OAuth return URL stays a public same-origin URL. */
export const POST_OAUTH_REDIRECT_KEY = "pubstore.postOAuthRedirect";

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
);

const AppleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
    <path d="M16.36 12.78c.02 2.6 2.28 3.47 2.31 3.48-.02.06-.36 1.24-1.2 2.45-.72 1.05-1.47 2.09-2.66 2.11-1.16.02-1.54-.69-2.87-.69-1.33 0-1.75.67-2.85.71-1.14.04-2.01-1.13-2.74-2.17-1.6-2.31-2.82-6.53-1.18-9.39.81-1.42 2.27-2.32 3.85-2.34 1.12-.02 2.17.75 2.86.75.68 0 1.97-.93 3.32-.79.56.02 2.15.2 3.17 1.71-.08.05-1.89 1.11-1.87 3.31M14.2 3.9c.61-.74 1.02-1.77.91-2.8-.88.04-1.95.59-2.58 1.32-.57.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.59-1.22" />
  </svg>
);

const MicrosoftMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
    <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
    <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
    <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
  </svg>
);

const PROVIDERS: { id: Provider; label: string; Mark: () => JSX.Element }[] = [
  { id: "google", label: "Google", Mark: GoogleMark },
  { id: "apple", label: "Apple", Mark: AppleMark },
  { id: "microsoft", label: "Microsoft", Mark: MicrosoftMark },
];

export default function SocialAuthButtons({
  redirectTo,
  disabled,
}: {
  redirectTo: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    if (busy) return;
    setBusy(provider);
    try {
      try {
        sessionStorage.setItem(POST_OAUTH_REDIRECT_KEY, redirectTo);
      } catch {
        /* storage unavailable — fall back to the default destination */
      }
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Sign-in was cancelled");
        setBusy(null);
        return;
      }
      // Either the browser is redirecting, or the session is already set and
      // Auth.tsx's auth-state listener takes over from here.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(null);
    }
  };

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          or continue with
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 space-y-2">
        {PROVIDERS.map(({ id, label, Mark }) => (
          <button
            key={id}
            type="button"
            onClick={() => signIn(id)}
            disabled={disabled || busy !== null}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-lg border border-border bg-card/70 text-sm font-semibold text-foreground transition-colors hover:bg-card disabled:opacity-60"
          >
            {busy === id ? <CircleSpinner size={18} /> : <Mark />}
            <span>Continue with {label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
