import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Verification.tsx` — KYC / seller verification flow.
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});
  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  late Future<Map<String, dynamic>?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>?> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return null;
    final row = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
    return row == null ? null : Map<String, dynamic>.from(row);
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.destructive;
      case 'pending':
        return AppColors.warning;
      default:
        return AppColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Identity verification')),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final v = snap.data;
          final status = (v?['status'] ?? 'not_submitted').toString();
          return ListView(padding: const EdgeInsets.all(20), children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _statusColor(status).withOpacity(.10),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _statusColor(status).withOpacity(.4)),
              ),
              child: Row(children: [
                Icon(
                  status == 'approved' ? LucideIcons.badgeCheck : status == 'rejected' ? LucideIcons.badgeX : LucideIcons.badgeAlert,
                  color: _statusColor(status),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_label(status), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _statusColor(status))),
                    if ((v?['rejection_reason'] ?? '').toString().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('${v!['rejection_reason']}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      ),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            const Text('Why verify?', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const _Bullet('Unlock higher wallet limits & instant withdrawals'),
            const _Bullet('Sell across all verticals with a trusted-seller badge'),
            const _Bullet('Priority customer support and dispute resolution'),
            const SizedBox(height: 24),
            const Text('What you’ll need', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const _Bullet('Government-issued ID (passport, driver’s licence or national ID)'),
            const _Bullet('A short selfie for face-matching'),
            const _Bullet('Proof of address (utility bill, bank statement)'),
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: status == 'approved'
                  ? null
                  : () async {
                      final uid = supabase.auth.currentUser?.id;
                      if (uid == null) return;
                      await supabase.from('user_verifications').upsert({
                        'user_id': uid,
                        'status': 'pending',
                        'submitted_at': DateTime.now().toIso8601String(),
                      });
                      setState(() => _future = _load());
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Submitted for review')),
                        );
                      }
                    },
              icon: const Icon(LucideIcons.upload),
              label: Text(status == 'approved' ? 'Verified' : status == 'pending' ? 'Submitted — awaiting review' : 'Submit for verification'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ]);
        },
      ),
    );
  }

  String _label(String s) => switch (s) {
        'approved' => 'You’re verified',
        'pending' => 'Under review',
        'rejected' => 'Verification rejected',
        _ => 'Not submitted',
      };
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(padding: EdgeInsets.only(top: 3), child: Icon(LucideIcons.check, size: 14, color: AppColors.success)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.foreground))),
        ]),
      );
}
