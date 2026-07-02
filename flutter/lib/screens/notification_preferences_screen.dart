import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/NotificationPreferences.tsx` — per-channel opt in/out
/// stored in `notification_preferences`.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});
  @override
  State<NotificationPreferencesScreen> createState() => _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends State<NotificationPreferencesScreen> {
  Map<String, dynamic> _prefs = {};
  bool _loading = true;

  static const _groups = <(String, String, List<(String, String)>)>[
    ('Orders', 'Updates about your purchases', [
      ('orders_push', 'Push notifications'),
      ('orders_email', 'Email'),
      ('orders_whatsapp', 'WhatsApp'),
    ]),
    ('Chats & messages', 'Buyer/supplier direct messages', [
      ('chat_push', 'Push notifications'),
      ('chat_email', 'Email'),
    ]),
    ('Deals & promos', 'Recommendations and discounts', [
      ('promo_push', 'Push notifications'),
      ('promo_email', 'Email'),
      ('promo_whatsapp', 'WhatsApp'),
    ]),
    ('Rides & delivery', 'Driver ETA and delivery updates', [
      ('rides_push', 'Push notifications'),
      ('rides_sms', 'SMS'),
    ]),
    ('Wallet', 'Top-ups, withdrawals, receipts', [
      ('wallet_push', 'Push notifications'),
      ('wallet_email', 'Email'),
    ]),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      setState(() => _loading = false);
      return;
    }
    final row = await supabase.from('notification_preferences').select('*').eq('user_id', uid).maybeSingle();
    if (!mounted) return;
    setState(() {
      _prefs = row == null ? {} : Map<String, dynamic>.from(row);
      _loading = false;
    });
  }

  Future<void> _toggle(String key, bool value) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _prefs[key] = value);
    await supabase.from('notification_preferences').upsert({'user_id': uid, key: value});
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(padding: const EdgeInsets.symmetric(vertical: 8), children: [
        for (final g in _groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(g.$1.toUpperCase(), style: const TextStyle(fontSize: 11, letterSpacing: 1.4, color: AppColors.muted, fontWeight: FontWeight.w900)),
              Text(g.$2, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ]),
          ),
          for (final t in g.$3)
            SwitchListTile(
              title: Text(t.$2),
              value: _prefs[t.$1] == true,
              onChanged: (v) => _toggle(t.$1, v),
            ),
          const Divider(height: 20),
        ],
      ]),
    );
  }
}
