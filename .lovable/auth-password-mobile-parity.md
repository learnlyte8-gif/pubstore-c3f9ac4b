# Auth: password-first + email verification code — mobile parity

Web reference: `src/pages/Auth.tsx`.

## Flow (single screen, two steps)

1. **Credentials step** — fields: full name (optional), email, password (min 8, max 72), phone (optional, country picker → E.164).
   - `signInWithPassword({ email, password })`
     - success → upsert phone on `profiles` if provided → route.
     - error `email not confirmed` → `auth.resend({ type: 'signup', email })` → go to code step.
     - error `invalid login credentials` → treat as new user: `signUp({ email, password, data: { display_name, phone, phone_country } })`.
       - `signUp` error `already registered` → "Wrong password for this email".
       - returns a session (auto-confirm on) → route.
       - no session → go to code step.
     - any other error → surface message.
   - "Forgot password?" → `resetPasswordForEmail(email, { redirectTo: <origin>/auth })`.
2. **Code step** — 6–8 numeric digits, `autocomplete: one-time-code`.
   - `verifyOtp({ email, token, type: 'email' })`.
   - On success upsert phone (the `handle_new_user` trigger only fires at creation).
   - Resend cooldown 45s via `auth.resend({ type: 'signup', email })`.
   - "Change email" returns to step 1 and clears the code.

## Routing after session

`onAuthStateChange` + `getSession` → read `profiles.profile_completed`:
- false/missing → `/onboarding?redirect=<target>`
- true → `<target>` (default `/home`)
- external OAuth consent target (`/.lovable/oauth/...`) → hard-navigate there, skip onboarding gate.

## Backend expectations

- Email provider enabled, **email confirmation required** (auto-confirm off) so codes are sent.
- Anonymous sign-ups stay disabled.
- Password strength/HIBP settings are project-level; client enforces 8–72 chars.
- Auth email templates are managed centrally; the confirmation email must include the numeric code token.

## React Native (`react-native/src/screens/AuthScreen.tsx`)

Replace the current sign-in/sign-up toggle with the same two-step state machine:

```ts
type Step = 'credentials' | 'code';
// supabase.auth.signInWithPassword -> fallback supabase.auth.signUp
// supabase.auth.verifyOtp({ email, token, type: 'email' })
// supabase.auth.resend({ type: 'signup', email })
```

Native notes:
- `TextInput` for code: `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS), `autoComplete="sms-otp"` (Android).
- Password field: `secureTextEntry`, `textContentType="password"`, show/hide toggle.
- Omit `emailRedirectTo`; codes are verified in-app, no deep link needed.
- Reset password uses the deep link scheme (`tapson-mobile://auth`) as `redirectTo`.
- After success `navigation.reset` to `MainTabs`, or to Onboarding when `profile_completed` is false.

## Flutter (`flutter/lib/services/auth_service.dart`)

Add to `AuthService`:

```dart
Future<AuthResponse> signInWithPassword({required String email, required String password});
Future<AuthResponse> signUpWithPassword({
  required String email, required String password,
  String? displayName, String? phoneE164, String? phoneCountry,
});
Future<User?> verifyEmailOtp({required String email, required String token}); // exists
Future<void> resendSignupCode(String email) =>
    supabase.auth.resend(type: OtpType.signup, email: email);
Future<void> resetPassword(String email) =>
    supabase.auth.resetPasswordForEmail(email, redirectTo: 'tapson-mobile://auth');
```

Keep `upsertPhone` for the post-verification write. Remove/retire `sendEmailOtp` once the
password flow ships so both platforms behave identically. Google sign-in stays unchanged.

## Parity checklist

- [ ] Password validated 8–72 chars before any network call
- [ ] Unknown email + password auto-creates the account (no separate "Sign up" mode)
- [ ] Wrong password on an existing email shows a distinct error
- [ ] Unconfirmed accounts resend a code instead of failing
- [ ] Code step accepts 6–8 digits, 45s resend cooldown, change-email escape hatch
- [ ] Phone upsert to `profiles` on both sign-in and verification paths
- [ ] Onboarding gate honours `profile_completed`
- [ ] Guest browsing entry point preserved
