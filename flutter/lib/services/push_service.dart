import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'supabase_client.dart';

/// FCM/APNs registration → `public.push_subscriptions` (same table the web
/// client writes to). Mirrors `src/lib/push.ts` on web. Safe to call multiple
/// times; the row is upserted keyed by (user_id, endpoint).
class PushService {
  const PushService();

  static Future<void> ensureInitialized() async {
    if (kIsWeb) return; // web uses its own service worker path
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
    } catch (_) {
      return; // no GoogleService-Info.plist / google-services.json bundled
    }
  }

  /// Request permission, fetch the FCM token, and upsert a subscription for
  /// the currently signed-in user. No-op when signed-out or when Firebase
  /// isn't configured in the host app.
  Future<void> registerForCurrentUser() async {
    if (kIsWeb) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    if (Firebase.apps.isEmpty) return;

    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    String? token;
    try {
      if (Platform.isIOS) {
        // APNs may still be settling right after first-launch permission.
        await messaging.getAPNSToken();
      }
      token = await messaging.getToken();
    } catch (_) {}
    if (token == null || token.isEmpty) return;

    await _upsert(uid, token);

    // Persist rotated tokens so we don't lose delivery after OS updates.
    messaging.onTokenRefresh.listen((t) {
      final u = supabase.auth.currentUser?.id;
      if (u != null && t.isNotEmpty) _upsert(u, t);
    });
  }

  Future<void> _upsert(String userId, String token) async {
    try {
      await supabase.from('push_subscriptions').upsert(
        {
          'user_id': userId,
          'endpoint': token,
          'provider': Platform.isIOS ? 'apns' : 'fcm',
          'platform': Platform.isIOS ? 'ios' : 'android',
          'user_agent': 'pubstore-flutter',
        },
        onConflict: 'user_id,endpoint',
      );
    } catch (_) {}
  }

  Future<void> unregister() async {
    if (kIsWeb || Firebase.apps.isEmpty) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', uid)
            .eq('endpoint', token);
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}

const pushService = PushService();
