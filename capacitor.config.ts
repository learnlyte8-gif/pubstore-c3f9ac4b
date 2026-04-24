import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuki.kkallinonestore',
  appName: 'pubstore',
  webDir: 'dist',
  server: {
    url: 'https://14b25a14-b8c0-40f2-9b82-31f038ad2828.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    buildOptions: {
      // versionCode and versionName are set in android/app/build.gradle
    },
  },
};

export default config;
