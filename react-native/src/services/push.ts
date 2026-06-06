// Push notifications — Firebase Cloud Messaging on Android, APNs on iOS.
// Mirrors the web `src/lib/push.ts` helper. Wire up after running
// `npx react-native init` and adding the google-services.json / GoogleService-Info.plist.

import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (res !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function getFcmToken(): Promise<string | null> {
  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

export function onForegroundMessage(cb: (msg: unknown) => void) {
  return messaging().onMessage(cb);
}
