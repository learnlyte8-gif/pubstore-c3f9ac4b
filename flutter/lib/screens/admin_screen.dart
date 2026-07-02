import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Admin.tsx` — platform admin console: users, orders,
/// suppliers, moderation queues. Gated by `has_role(uid, 'admin')`.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  bool _loading = true;
  bool _isAdmin = false;
  Map<String, int> _counts = {};

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final res = await supabase.rpc('has_role', params: {'_user_id': uid, '_role': 'admin'});
      _isAdmin = res == true;
      if (_isAdmin) {
        final users = await supabase.from('profiles').select('id');
        final orders = await supabase.from('orders').select('id');
        final suppliers = await supabase.from('suppliers').select('id');
        final pendingVerif = await supabase.from('user_verifications').select('id').eq('status', 'pending');
        _counts = {
          'users': (users as List).length,
          'orders': (orders as List).length,
          'suppliers': (suppliers as List).length,
          'pending_verif': (pendingVerif as List).length,
        };
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!_isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.shieldOff, size: 44, color: AppColors.destructive),
              SizedBox(height: 10),
              Text('Not authorised', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              SizedBox(height: 6),
              Text('You need an admin role to access this area.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
            ]),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Admin console')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.5,
          children: [
            _kpi('Users', '${_counts['users'] ?? 0}', LucideIcons.users, AppColors.primary),
            _kpi('Orders', '${_counts['orders'] ?? 0}', LucideIcons.shoppingBag, AppColors.success),
            _kpi('Suppliers', '${_counts['suppliers'] ?? 0}', LucideIcons.store, AppColors.warning),
            _kpi('Pending KYC', '${_counts['pending_verif'] ?? 0}', LucideIcons.badgeAlert, AppColors.destructive),
          ],
        ),
        const SizedBox(height: 24),
        const Text('Moderation queues', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        for (final t in const [
          ('Identity verifications', LucideIcons.badgeCheck),
          ('Reported listings', LucideIcons.flag),
          ('Withdrawal requests', LucideIcons.arrowDownToLine),
          ('Ad approvals', LucideIcons.megaphone),
          ('Refunds & disputes', LucideIcons.gavel),
        ])
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
            child: ListTile(leading: Icon(t.$2), title: Text(t.$1), trailing: const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.muted)),
          ),
      ]),
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color color) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Icon(icon, color: color, size: 22),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ]),
      );
}
