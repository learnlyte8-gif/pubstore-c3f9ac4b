import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/BecomeSupplier.tsx` — two-step supplier onboarding:
/// (1) benefits pitch and (2) store details form. Creates a row in
/// `suppliers` seeded with `profiles.verticals`.
class BecomeSupplierScreen extends StatefulWidget {
  const BecomeSupplierScreen({super.key});
  @override
  State<BecomeSupplierScreen> createState() => _BecomeSupplierScreenState();
}

class _Benefit {
  const _Benefit(this.icon, this.title, this.desc);
  final IconData icon;
  final String title;
  final String desc;
}

const _benefits = <_Benefit>[
  _Benefit(LucideIcons.globe, 'Global reach', 'Sell to buyers in 200+ countries'),
  _Benefit(LucideIcons.shield, 'Trade Assurance', 'Built-in payment & shipping protection'),
  _Benefit(LucideIcons.trendingUp, 'Smart promo tools', 'AI insights, deals, live shopping'),
  _Benefit(LucideIcons.zap, 'Fast onboarding', 'Start selling in under 10 minutes'),
];

class _BecomeSupplierScreenState extends State<BecomeSupplierScreen> {
  int _step = 0;
  final _name = TextEditingController();
  final _country = TextEditingController(text: 'Zimbabwe');
  final _about = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _redirectIfStoreExists();
  }

  Future<void> _redirectIfStoreExists() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final existing = await supabase
          .from('suppliers')
          .select('id')
          .eq('owner_id', uid)
          .isFilter('mirror_of', null)
          .limit(1)
          .maybeSingle();
      if (mounted && existing != null) Navigator.of(context).pop(true);
    } catch (_) {}
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty) {
      _snack('Store name is required');
      return;
    }
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      _snack('Please sign in to create a store.');
      return;
    }
    setState(() => _submitting = true);
    try {
      // Idempotent role upsert.
      await supabase.from('user_roles').delete().eq('user_id', uid).eq('role', 'supplier');
      await supabase.from('user_roles').insert({'user_id': uid, 'role': 'supplier'});

      // Seed supplier verticals from onboarding.
      List<String> verticals = const [];
      try {
        final profile = await supabase.from('profiles').select('verticals').eq('user_id', uid).maybeSingle();
        verticals = List<String>.from(profile?['verticals'] ?? const []);
      } catch (_) {}

      await supabase.from('suppliers').insert({
        'owner_id': uid,
        'name': _name.text.trim(),
        'country': _country.text.trim().isEmpty ? null : _country.text.trim(),
        'about': _about.text.trim().isEmpty ? null : _about.text.trim(),
        'verified': false,
        'gold': false,
        'trade_assurance': true,
        'rating': 0,
        'response_rate': 95,
        'response_time': '≤ 24h',
        'on_time_delivery': 100,
        'years_active': 0,
        'verticals': verticals,
      });
      if (mounted) {
        _snack('Welcome to PUBSTORE Sellers 🎉');
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _snack("Couldn't create store: $e");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String s) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Become a supplier')),
      body: _step == 0 ? _pitch() : _form(),
    );
  }

  Widget _pitch() => ListView(children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primary, AppColors.accent],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
            Icon(LucideIcons.store, size: 36, color: Colors.white),
            SizedBox(height: 8),
            Text('Start selling on PUBSTORE',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white, height: 1.15)),
            SizedBox(height: 4),
            Text('Set up your store and list your first product in minutes.',
                style: TextStyle(color: Colors.white70, fontSize: 13)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            for (final b in _benefits)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                      child: Icon(b.icon, size: 20, color: AppColors.primary)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(b.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    Text(b.desc, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ])),
                ]),
              ),
            const SizedBox(height: 4),
            FilledButton(
              onPressed: () => setState(() => _step = 1),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              child: const Text('Get started', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 8),
            const Text('No setup fees · 0% commission for first 30 days',
                style: TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ),
      ]);

  Widget _form() => ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Tell us about your store',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Store name *', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country / Region', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _about, maxLines: 4, decoration: const InputDecoration(labelText: 'What do you sell?', border: OutlineInputBorder())),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: const [
            Icon(LucideIcons.checkCircle2, size: 16, color: AppColors.primary),
            SizedBox(width: 8),
            Expanded(child: Text(
              'By continuing you agree to the PUBSTORE Seller Terms and Trade Assurance program.',
              style: TextStyle(fontSize: 11, color: AppColors.muted),
            )),
          ]),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _submitting ? null : _submit,
          icon: const Icon(LucideIcons.store, size: 16),
          label: Text(_submitting ? 'Creating…' : 'Create my store'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: AppColors.orange),
        ),
        TextButton(onPressed: _submitting ? null : () => setState(() => _step = 0), child: const Text('Back')),
      ]);
}
