# Social sign-in on the PUBSTORE website

## What's available

The backend's built-in social sign-in supports exactly three providers:

- Google
- Apple
- Microsoft

Facebook is not offered, so it can't be added this way. If Facebook matters, that would need a separate custom integration — not part of this plan.

## What you'll get

On the sign-in screen (`/auth`), below the existing email + password form:

- A divider ("or continue with")
- Three buttons: Continue with Google, Continue with Apple, Continue with Microsoft, each with its brand mark and styled to match the current dark PUBSTORE look
- One flow for both login and signup — a first-time social user gets an account created automatically and lands on the setup screen; a returning user goes straight to the app or wherever they were headed

Sign-in returns people to **pubstore.app** (or whatever address they started on, including the preview), never a Lovable-branded page.

## Behaviour details

- New social users are routed through onboarding, exactly like new email users, so name/phone/profile completion still happens.
- Anyone arriving via an external app authorisation link still gets sent back to complete that authorisation.
- Existing email accounts using the same address get linked to the social identity by matching email, so nobody ends up with a duplicate account.
- A cancelled or failed provider sign-in shows a short message and leaves the form usable.

## Technical notes

- Enable `google`, `apple`, `microsoft` via the managed social-auth configuration in the same change, so the first click doesn't error with "Unsupported provider".
- Sign-in calls `lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin })` from `src/integrations/lovable/index.ts` (auto-generated — not edited). The intended destination is kept separately in session storage and applied only after the session is confirmed, so `redirect_uri` stays a public same-origin URL.
- New buttons live in a small `src/components/auth/SocialAuthButtons.tsx` and are rendered from `src/pages/Auth.tsx` in the `credentials` step; the existing password/OTP logic is untouched.
- The existing `onAuthStateChange` handler in `Auth.tsx` already routes on session, so social sessions reuse the same onboarding/redirect path.
- Custom domains are already covered by the managed OAuth broker; no DNS or provider console work is required from you.
