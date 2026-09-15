# Social Sign-In on Mobile — Porting Guide

Goal: the mobile app (native / wrapped) offers the same one-tap **Google, Apple and Microsoft** sign-in as pubstore.app, returns people into the app (never a browser page they can't leave), and shows **"Continue to Pubstore"** on every consent screen.

This guide assumes the web setup already in place:
- `src/components/auth/SocialAuthButtons.tsx` — the three buttons, shared login/signup flow.
- `src/pages/Auth.tsx` — hosts the buttons, stores the post-login redirect in `sessionStorage` under `POST_OAUTH_REDIRECT_KEY`, and routes to `/home` or `/onboarding` depending on `profile_completed`.
- Lovable Cloud managed social auth: Google, Apple, Microsoft providers enabled.
- Facebook is **not** available via managed OAuth — skip it on mobile too.

---

## 1. Where each piece runs

| Piece | Web | Mobile |
| --- | --- | --- |
| Button UI | `SocialAuthButtons.tsx` | Recreate natively (or reuse if React Native + shared components) |
| OAuth start | Supabase `signInWithOAuth({ provider, redirectTo })` opens a browser redirect | Same SDK call, but the browser session must return to the app via a **deep link / custom URL scheme** |
| Session storage | Browser localStorage (`sb-<project>-auth-token`) | Secure store via the Supabase client `storage` adapter (Expo SecureStore / AsyncStorage) |
| Post-login routing | `Auth.tsx` → `/home` or `/onboarding` | Deep-link handler reads the session, then routes to Home or Onboarding with the same `profile_completed` check |

The backend, the `auth.users` records and the `profile_completed` routing rule are shared — a user who signs up with Google on web is the same account on mobile.

## 2. Redirect URLs (the critical part)

Web uses `https://pubstore.app/auth` as the OAuth return URL. Mobile cannot use an https page as the final hop — the browser would stay open. Use a custom scheme instead:

```
tapson-mobile://auth/callback        # same scheme family already used for Pesepay callbacks
```

Rules:
- Add **both** `https://pubstore.app/auth` and `tapson-mobile://auth/callback` to the allowed redirect URLs in the backend auth settings.
- Never point `redirectTo` at an in-app protected route directly; always land on the auth callback and route in code afterward (mirrors the web rule).
- Keep one shared constant for the callback path so web and mobile configs stay in sync.

## 3. Starting sign-in (mobile code shape)

```ts
import { supabase } from "./supabase";

async function signInWith(provider: "google" | "apple" | "microsoft") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: "tapson-mobile://auth/callback",
      skipBrowserRedirect: true, // we open the URL ourselves
    },
  });
  if (error) throw error;
  // Open data.url in an in-app browser session:
  // Expo:    WebBrowser.openAuthSessionAsync(data.url, "tapson-mobile://auth/callback")
  // RN CLI:  Linking.openURL(data.url)
}
```

On the callback, extract `access_token` / `refresh_token` (or the `code` for PKCE) from the deep-link URL and hand it to the SDK:

```ts
// PKCE flow (recommended): exchange the code
const { error } = await supabase.auth.exchangeCodeForSession(code);
```

After `exchangeCodeForSession` resolves, the session lives in secure storage and the rest of the app behaves exactly like web.

## 4. Routing after sign-in (parity with `Auth.tsx`)

Web logic, ported 1:1:

1. Session exists → fetch the profile.
2. `profile_completed === true` → go to **Home**.
3. Otherwise → go to **Onboarding**, carrying the originally intended destination.
4. If the user cancelled the consent screen → return to the sign-in screen with a short "Sign-in was cancelled" message (web does the same via toast).

Note: on web, external OAuth return URLs (`/.lovable/oauth/...`) bypass the onboarding gate via `window.location.href = redirectTo`. On mobile there is no such external hop — the deep link always lands in your handler, so the `profile_completed` check always runs. This is intentional and safer.

## 5. Branding the consent screens ("Continue to Pubstore")

The managed providers show Lovable's name on Google/Apple consent screens. For parity with a branded web setup, mobile uses the **same custom credentials**:

### Google
- One Google Cloud project ("Pubstore") with an OAuth consent screen configured (name + logo = what users see).
- Create **three** OAuth clients, all in the same project so the branding is identical:
  - *Web application* — for pubstore.app (already used by web custom-credential setup).
  - *iOS* — bundle ID of the app.
  - *Android* — package name + SHA-1 signing certificate fingerprint.
- In the backend auth settings (Google provider → own credentials), paste the **Web application** client ID/secret — the backend always talks to Google as a web client; the iOS/Android client IDs are used only if you later switch to native Google Sign-In SDKs.
- Every redirect URI used (web domain, preview domain, and any proxy) must be whitelisted in both Google Cloud and the backend settings.

### Apple
- Paid Apple Developer account required ($99/yr).
- App ID with "Sign In with Apple" capability + a **Services ID** whose return URLs include the backend's Apple callback.
- Sign in with Apple key (.p8) entered in the backend Apple provider settings.
- On iOS, Apple **requires** "Sign in with Apple" to be offered if any other third-party login exists — so Apple sign-in is mandatory, not optional, on iOS.

### Microsoft
- Azure app registration with the mobile redirect added; paste client ID/secret into the backend Microsoft provider.

Once custom credentials are in place, **web and mobile consent screens both read "Pubstore"** because both flow through the same Google/Apple/Microsoft apps.

## 6. Cancellation, errors, edge cases

| Case | Behaviour (match web) |
| --- | --- |
| User closes the browser sheet | No session; show "Sign-in was cancelled", stay on the sign-in screen |
| Provider returns an error (`access_denied`, server error) | Toast/alert with a short message, stay on the sign-in screen |
| Email already exists from password signup | Accounts link automatically by email — do **not** create a duplicate; show normal routing |
| New social user | Route to onboarding (profile completion), same as web |
| Deep link arrives with no session | Ignore it; log to console; do not crash the auth screen |

## 7. Testing checklist

- [ ] Google sign-in returns to the app and lands on Home for an existing profile.
- [ ] Apple sign-in on a physical iOS device (Simulator hides real Apple sheet quirks).
- [ ] Microsoft sign-in end-to-end.
- [ ] Brand-new Google account → routed to onboarding, completes profile, lands on Home.
- [ ] Cancel mid-consent → back on the sign-in screen, no stuck spinner.
- [ ] Consent screen shows "Pubstore" (after custom credentials), not Lovable.
- [ ] Same email on web + mobile = one account, one wallet, one order history.
- [ ] Sign-out on mobile clears secure storage; reopening the app returns to the sign-in screen.

## 8. Non-goals / known limits

- No Facebook login (not supported by managed OAuth; would need a separate custom integration — out of scope).
- No anonymous sign-ins.
- Auth settings (client IDs, secrets, redirect URL allow-list) live in the backend — mobile never ships secrets in the bundle.
