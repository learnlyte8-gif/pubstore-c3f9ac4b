import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: For release builds, the `server` block is intentionally omitted so
// the APK/AAB loads its bundled web assets instead of the Lovable preview.
// If you want hot-reload while developing locally, temporarily add:
//   server: {
//     url: 'https://14b25a14-b8c0-40f2-9b82-31f038ad2828.lovableproject.com?forceHideBadge=true',
//     cleartext: true,
//   },
const config: CapacitorConfig = {
  appId: 'com.kuki.kkallinonestore',
  appName: 'pubstore',
  webDir: 'dist',
};

export default config;
