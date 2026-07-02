import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Unsubscribe.tsx` — one-tap email unsubscribe using a
/// token in the deep link.
class UnsubscribeScreen extends StatefulWidget {
  const UnsubscribeScreen({super.key, required this.token});
  final String token;
  @override
  State<UnsubscribeScreen> createState() => _UnsubscribeScreenState();
}

class _UnsubscribeScreenState extends State<UnsubscribeScreen> {
  bool _busy = true;
  bool _ok = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    try {
      final res = await supabase.functions.invoke('handle-email-unsubscribe', body: {'token': widget.token});
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = res.data?['ok'] == true || res.status == 200;
      });
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = '$e'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: _busy
              ? const Column(mainAxisSize: MainAxisSize.min, children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text('Processing your request…'),
                ])
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_ok ? LucideIcons.mailX : LucideIcons.alertCircle, size: 64, color: _ok ? AppColors.success : AppColors.destructive),
                  const SizedBox(height: 16),
                  Text(_ok ? 'You’ve been unsubscribed' : 'Couldn’t unsubscribe', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  Text(_ok ? 'We won’t send you promotional emails from PUBSTORE again. You’ll still receive order and account updates.' : (_error ?? 'The link may have expired. Try again from the latest email.'), textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
                ]),
        ),
      ),
    );
  }
}
