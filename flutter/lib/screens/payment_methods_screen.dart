import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/PaymentMethods.tsx`.
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

  IconData _iconFor(String kind) {
    switch (kind) {
      case 'card':
        return LucideIcons.creditCard;
      case 'mobile_money':
        return LucideIcons.smartphone;
      case 'wallet':
        return LucideIcons.wallet;
      case 'bank':
        return LucideIcons.building2;
      default:
        return LucideIcons.circleDollarSign;
    }
  }

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
      appBar: AppBar(
        title: const Text('Payment methods'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.plus),
            onPressed: () async {
              final saved = await showModalBottomSheet<bool>(
                context: context,
                isScrollControlled: true,
                builder: (_) => const _AddPaymentSheet(),
              );
              if (saved == true) _refresh();
            },
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snap.data ?? const [];
          if (rows.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons.creditCard, size: 44, color: AppColors.muted),
                  SizedBox(height: 10),
                  Text('No payment methods', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  SizedBox(height: 6),
                  Text('Add a card, mobile-money or wallet to check out faster.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                ]),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final m = rows[i];
              final isDefault = m['is_default'] == true;
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDefault ? AppColors.primary : AppColors.border),
                ),
                child: Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
                    child: Icon(_iconFor((m['kind'] ?? '').toString()), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${m['label'] ?? m['kind']}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                      if ((m['last4'] ?? '').toString().isNotEmpty)
                        Text('•••• ${m['last4']}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      if (isDefault) const Text('Default', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                  PopupMenuButton<String>(
                    onSelected: (v) {
                      if (v == 'default') _makeDefault(m['id'].toString());
                      if (v == 'delete') _delete(m['id'].toString());
                    },
                    itemBuilder: (_) => [
                      if (!isDefault) const PopupMenuItem(value: 'default', child: Text('Set default')),
                      const PopupMenuItem(value: 'delete', child: Text('Remove')),
                    ],
                  ),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}

class _AddPaymentSheet extends StatefulWidget {
  const _AddPaymentSheet();
  @override
  State<_AddPaymentSheet> createState() => _AddPaymentSheetState();
}

class _AddPaymentSheetState extends State<_AddPaymentSheet> {
  String _kind = 'card';
  final _label = TextEditingController();
  final _last4 = TextEditingController();
  bool _saving = false;

  Future<void> _save() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _saving = true);
    try {
      await supabase.from('payment_methods').insert({
        'user_id': uid,
        'kind': _kind,
        'label': _label.text.trim().isEmpty ? _kind : _label.text.trim(),
        'last4': _last4.text.trim(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Add payment method', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _kind,
              decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'card', child: Text('Card')),
                DropdownMenuItem(value: 'mobile_money', child: Text('Mobile money')),
                DropdownMenuItem(value: 'wallet', child: Text('Wallet')),
                DropdownMenuItem(value: 'bank', child: Text('Bank')),
              ],
              onChanged: (v) => setState(() => _kind = v ?? 'card'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _label, decoration: const InputDecoration(labelText: 'Label (e.g. Personal Visa)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _last4, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Last 4 digits', border: OutlineInputBorder())),
            const SizedBox(height: 20),
            FilledButton(onPressed: _saving ? null : _save, child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Add')),
          ]),
        ),
      );
}
