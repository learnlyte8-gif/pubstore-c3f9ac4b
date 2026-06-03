# PUBSTORE — Flutter scaffold

Minimal Flutter project scaffold for the PUBSTORE app. This is **not** generated
by `flutter create` — it only contains the files specific to this app
(`pubspec.yaml`, `lib/main.dart`, this README, analysis options, a basic test).

## Finish scaffolding locally

The native `android/` and `ios/` folders, Gradle wrapper, and platform configs
must be generated on your machine (the Lovable sandbox has no Flutter SDK):

```bash
# 1. Copy this folder out of the web repo
cp -R flutter ~/pubstore-flutter
cd ~/pubstore-flutter

# 2. Let Flutter generate the native shells + tooling in place
flutter create --org com.kuki --project-name pubstore .

# 3. Install packages and run
flutter pub get
flutter run
```

`flutter create .` will add `android/`, `ios/`, `.metadata`, `analysis_options.yaml`,
etc. without overwriting `lib/main.dart` or `pubspec.yaml`.

## What the starter does

`lib/main.dart` opens the published web app (`https://pubstore.lovable.app`)
inside a `WebView`. Treat that as a placeholder while you port screens to
native Flutter widgets. Replace `_appUrl` or rebuild `HomeShell` with real
Flutter pages as you go.

## Suggested next steps

- Connect Supabase via `supabase_flutter` using the same project URL / anon key
  as the web app (`src/integrations/supabase/client.ts`).
- Mirror the web routes (`/home`, `/categories`, `/messages`, `/wishlist`,
  `/profile`) with a `BottomNavigationBar`.
- Reuse product / restaurant images by hitting the same Supabase storage
  buckets the web app uses.
