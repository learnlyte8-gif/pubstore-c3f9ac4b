#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-click Android AAB build for PUBSTORE / Kuki K-All-In-One Store
#
# Produces a release Android App Bundle (.aab) with:
#   - applicationId: com.kuki.kkallinonestore
#   - versionCode:   11
#   - versionName:   11.0
#
# Usage:
#   ./scripts/build-android-aab.sh
#
# Requirements (must be installed on your machine):
#   - Node.js + npm
#   - Java JDK 17+
#   - Android SDK (ANDROID_HOME / ANDROID_SDK_ROOT set)
#   - A signing keystore for release builds (see "Signing" section below)
#
# Signing (recommended):
#   Set these env vars before running, otherwise Gradle will produce an
#   *unsigned* bundle that Google Play will reject:
#     export PUBSTORE_KEYSTORE=/absolute/path/to/release.keystore
#     export PUBSTORE_KEYSTORE_PASSWORD=...
#     export PUBSTORE_KEY_ALIAS=...
#     export PUBSTORE_KEY_PASSWORD=...
# ---------------------------------------------------------------------------

set -euo pipefail

APP_ID="com.kuki.kkallinonestore"
VERSION_CODE=11
VERSION_NAME="11.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m! %s\033[0m\n" "$*"; }
die()  { printf "\n\033[1;31m✖ %s\033[0m\n" "$*"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Sanity checks
# ---------------------------------------------------------------------------
command -v npm >/dev/null   || die "npm not found in PATH."
command -v npx >/dev/null   || die "npx not found in PATH."
command -v java >/dev/null  || die "Java JDK not found in PATH (need 17+)."

# ---------------------------------------------------------------------------
# 2. Install deps + build the web bundle
# ---------------------------------------------------------------------------
log "Installing npm dependencies"
npm install

log "Building production web bundle (npm run build)"
npm run build

# ---------------------------------------------------------------------------
# 3. Make sure the Android Capacitor project exists
# ---------------------------------------------------------------------------
if [ ! -d "android" ]; then
  log "android/ not found — running 'npx cap add android'"
  npx cap add android
fi

# ---------------------------------------------------------------------------
# 4. Sync the web build into the native shell
# ---------------------------------------------------------------------------
log "Syncing web assets into Android project (npx cap sync android)"
npx cap sync android

# ---------------------------------------------------------------------------
# 5. Force the release identity (applicationId + versionCode/Name)
#    This patches android/app/build.gradle in-place so the values match
#    what the Play Store expects, regardless of what Capacitor scaffolded.
# ---------------------------------------------------------------------------
GRADLE_FILE="android/app/build.gradle"
[ -f "$GRADLE_FILE" ] || die "Missing $GRADLE_FILE — Android project not initialised."

log "Patching $GRADLE_FILE → applicationId=$APP_ID, versionCode=$VERSION_CODE, versionName=$VERSION_NAME"
# Use a portable in-place sed (works on Linux + macOS).
sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}
sed_inplace -E "s/applicationId \".*\"/applicationId \"$APP_ID\"/" "$GRADLE_FILE"
sed_inplace -E "s/versionCode [0-9]+/versionCode $VERSION_CODE/" "$GRADLE_FILE"
sed_inplace -E "s/versionName \".*\"/versionName \"$VERSION_NAME\"/" "$GRADLE_FILE"

# ---------------------------------------------------------------------------
# 6. Build the release AAB
# ---------------------------------------------------------------------------
cd android

if [ -n "${PUBSTORE_KEYSTORE:-}" ] && [ -n "${PUBSTORE_KEYSTORE_PASSWORD:-}" ] \
   && [ -n "${PUBSTORE_KEY_ALIAS:-}" ] && [ -n "${PUBSTORE_KEY_PASSWORD:-}" ]; then
  log "Building SIGNED release bundle"
  ./gradlew bundleRelease \
    -Pandroid.injected.signing.store.file="$PUBSTORE_KEYSTORE" \
    -Pandroid.injected.signing.store.password="$PUBSTORE_KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$PUBSTORE_KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$PUBSTORE_KEY_PASSWORD"
else
  warn "No keystore env vars set — building an UNSIGNED release bundle."
  warn "Google Play will reject this AAB until you sign it."
  ./gradlew bundleRelease
fi

OUT="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$OUT" ] || die "Build finished but AAB not found at $OUT"

log "✅ Done. AAB ready at:"
echo "    $OUT"
echo
echo "    applicationId : $APP_ID"
echo "    versionCode   : $VERSION_CODE"
echo "    versionName   : $VERSION_NAME"
