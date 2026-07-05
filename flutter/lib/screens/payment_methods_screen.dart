import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/PaymentMethods.tsx` — matches the real schema
/// (brand, last4, holder, exp_month, exp_year, is_default).
class PaymentMethodsScreen extends StatefulWidget {
  const PaymentMethodsScreen({super.key});
  @override
  State<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends State<PaymentMethodsScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return [];
    final rows = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', uid)
        .order('is_default', ascending: false)
        .order('created_at', ascending: false);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _delete(String id) async {
    await supabase.from('payment_methods').delete().eq('id', id);
    _refresh();
  }

  Future<void> _makeDefault(String id) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('payment_methods').update({'is_default': false}).eq('user_id', uid);
    await supabase.from('payment_methods').update({'is_default': true}).eq('id', id);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Payment methods', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final rows = snap.data ?? const [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (rows.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Column(children: [
                    Icon(LucideIcons.creditCard, size: 44, color: AppColors.muted),
                    SizedBox(height: 10),
                    Text('No payment methods', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    SizedBox(height: 6),
                    Text('Add a card to speed up checkout.',
                        textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                  ]),
                ),
              ...rows.map((m) {
                final isDefault = m['is_default'] == true;
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isDefault ? AppColors.primary : AppColors.border),
                  ),
                  child: Row(children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, Color(0xFF60A5FA)],
                          begin: Alignment.topLeft, end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.creditCard, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text('${m['brand'] ?? 'Card'} •••• ${m['last4'] ?? ''}',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                          if (isDefault) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
                              child: const Text('Default', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                            ),
                          ],
                        ]),
                        const SizedBox(height: 2),
                        Text(
                          '${m['holder'] ?? '—'}${(m['exp_month'] != null && m['exp_year'] != null) ? ' · Exp ${m['exp_month'].toString().padLeft(2, '0')}/${m['exp_year'].toString().substring(m['exp_year'].toString().length - 2)}' : ''}',
                          style: const TextStyle(fontSize: 11, color: AppColors.muted),
                        ),
                      ]),
                    ),
                    if (!isDefault)
                      IconButton(
                        icon: const Icon(LucideIcons.star, size: 16),
                        onPressed: () => _makeDefault(m['id'].toString()),
                        tooltip: 'Set default',
                      ),
                    IconButton(
                      icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.destructive),
                      onPressed: () => _delete(m['id'].toString()),
                    ),
                  ]),
                );
              }),
              const SizedBox(height: 4),
              FilledButton.icon(
                onPressed: () async {
                  final saved = await showModalBottomSheet<bool>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: AppColors.background,
                    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
                    builder: (_) => const _AddCardSheet(),
                  );
                  if (saved == true) _refresh();
                },
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                icon: const Icon(LucideIcons.plus, size: 16),
                label: const Text('Add payment method'),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                  Icon(LucideIcons.shield, color: AppColors.primary, size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Secured by Trade Assurance', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      SizedBox(height: 4),
                      Text('Payments are protected end-to-end. We never store your full card details on our servers.',
                          style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
                    ]),
                  ),
                ]),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _AddCardSheet extends StatefulWidget {
  const _AddCardSheet();
  @override
  State<_AddCardSheet> createState() => _AddCardSheetState();
}

class _AddCardSheetState extends State<_AddCardSheet> {
  final _form = GlobalKey<FormState>();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  final _exp = TextEditingController();
  bool _saving = false;

  String _detectBrand(String num) {
    final n = num.replaceAll(RegExp(r'\s+'), '');
    if (RegExp(r'^4').hasMatch(n)) return 'Visa';
    if (RegExp(r'^5[1-5]').hasMatch(n)) return 'Mastercard';
    if (RegExp(r'^3[47]').hasMatch(n)) return 'Amex';
    if (RegExp(r'^6').hasMatch(n)) return 'Discover';
    return 'Card';
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _saving = true);
    try {
      final num = _number.text.replaceAll(RegExp(r'\s+'), '');
      final parts = _exp.text.split('/');
      final m = int.tryParse(parts[0].trim());
      var y = int.tryParse(parts.length > 1 ? parts[1].trim() : '');
      if (y != null && y < 100) y = 2000 + y;
      final existing = await supabase.from('payment_methods').select('id').eq('user_id', uid).limit(1);
      final isFirst = (existing as List).isEmpty;
      await supabase.from('payment_methods').insert({
        'user_id': uid,
        'brand': _detectBrand(num),
        'last4': num.substring(num.length - 4),
        'holder': _holder.text.trim(),
        'exp_month': m,
        'exp_year': y,
        'is_default': isFirst,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _form,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('New card', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _number,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(19)],
              decoration: const InputDecoration(labelText: 'Card number', hintText: '4242 4242 4242 4242', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.replaceAll(' ', '').length < 12) ? 'Invalid card number' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _holder,
              decoration: const InputDecoration(labelText: 'Cardholder', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _exp,
              decoration: const InputDecoration(labelText: 'Expiry (MM/YY)', hintText: '12/27', border: OutlineInputBorder()),
              validator: (v) => (v == null || !v.contains('/')) ? 'MM/YY' : null,
            ),
            const SizedBox(height: 10),
            const Text('Card stored for display only. No real charges.',
                style: TextStyle(fontSize: 10, color: AppColors.muted)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
              child: _saving
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save'),
            ),
          ]),
        ),
      ),
    );
  }
}
