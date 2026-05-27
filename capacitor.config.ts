import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: For release builds, remove the `server` block so the APK/AAB loads
// its bundled web assets instead of the Lovable preview URL.
const config: CapacitorConfig = {
  appId: 'app.lovable.14b25a14b8c040f29b8231f038ad2828',
  appName: 'pubstore',
  webDir: 'dist',
  // Uncomment the server block below for live hot-reload during development.
  // server: {
  //   url: 'https://14b25a14-b8c0-40f2-9b82-31f038ad2828.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
};

export default config;
