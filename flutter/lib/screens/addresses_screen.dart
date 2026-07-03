import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Addresses.tsx` — list, add, edit and delete shipping
/// addresses stored in the `addresses` table.
class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});
  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
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
        .from('addresses')
        .select('*')
        .eq('user_id', uid)
        .order('is_default', ascending: false)
        .order('created_at', ascending: false);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _delete(String id) async {
    await supabase.from('addresses').delete().eq('id', id);
    _refresh();
  }

  Future<void> _makeDefault(String id) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('addresses').update({'is_default': false}).eq('user_id', uid);
    await supabase.from('addresses').update({'is_default': true}).eq('id', id);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Addresses'),
        actions: [
          IconButton(
            onPressed: () async {
              final saved = await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => const _AddressForm()),
              );
              if (saved == true) _refresh();
            },
            icon: const Icon(LucideIcons.plus),
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return Skeletons.list(count: 4);
          }
          final rows = snap.data ?? const [];
          if (rows.isEmpty) {
            return const _EmptyState();
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final a = rows[i];
              final isDefault = a['is_default'] == true;
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: isDefault ? AppColors.primary : AppColors.border),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text('${a['recipient_name'] ?? ''}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    const Spacer(),
                    if (isDefault)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(.12),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: const Text('Default', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w800)),
                      ),
                  ]),
                  const SizedBox(height: 4),
                  Text('${a['line1'] ?? ''}${(a['line2'] ?? '').toString().isEmpty ? '' : ', ${a['line2']}'}'),
                  Text('${a['city'] ?? ''}, ${a['region'] ?? ''} ${a['postal_code'] ?? ''}'),
                  Text('${a['country'] ?? ''}'),
                  if ((a['phone'] ?? '').toString().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text('📞 ${a['phone']}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                    ),
                  const SizedBox(height: 10),
                  Row(children: [
                    if (!isDefault)
                      TextButton.icon(
                        onPressed: () => _makeDefault(a['id'].toString()),
                        icon: const Icon(LucideIcons.check, size: 14),
                        label: const Text('Set default'),
                      ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () async {
                        final saved = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(builder: (_) => _AddressForm(existing: a)),
                        );
                        if (saved == true) _refresh();
                      },
                      icon: const Icon(LucideIcons.pencil, size: 14),
                      label: const Text('Edit'),
                    ),
                    TextButton.icon(
                      onPressed: () => _delete(a['id'].toString()),
                      icon: const Icon(LucideIcons.trash2, size: 14, color: AppColors.destructive),
                      label: const Text('Delete', style: TextStyle(color: AppColors.destructive)),
                    ),
                  ]),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: const [
            Icon(LucideIcons.mapPin, size: 44, color: AppColors.muted),
            SizedBox(height: 10),
            Text('No addresses yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            SizedBox(height: 6),
            Text('Add one so checkout can go faster.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
          ]),
        ),
      );
}

class _AddressForm extends StatefulWidget {
  const _AddressForm({this.existing});
  final Map<String, dynamic>? existing;
  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  final _form = GlobalKey<FormState>();
  late final _c = <String, TextEditingController>{
    for (final k in [
      'recipient_name',
      'line1',
      'line2',
      'city',
      'region',
      'postal_code',
      'country',
      'phone',
    ])
      k: TextEditingController(text: widget.existing?[k]?.toString() ?? ''),
  };
  bool _default = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _default = widget.existing?['is_default'] == true;
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _saving = true);
    final payload = <String, dynamic>{
      for (final e in _c.entries) e.key: e.value.text.trim(),
      'is_default': _default,
      'user_id': uid,
    };
    try {
      if (_default) {
        await supabase.from('addresses').update({'is_default': false}).eq('user_id', uid);
      }
      if (widget.existing != null) {
        await supabase.from('addresses').update(payload).eq('id', widget.existing!['id']);
      } else {
        await supabase.from('addresses').insert(payload);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String key, String label, {bool required = true, TextInputType? kt}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          controller: _c[key],
          keyboardType: kt,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
          validator: (v) => required && (v == null || v.trim().isEmpty) ? 'Required' : null,
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Add address' : 'Edit address')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          _field('recipient_name', 'Recipient name'),
          _field('line1', 'Street address'),
          _field('line2', 'Apartment / suite', required: false),
          Row(children: [
            Expanded(child: _field('city', 'City')),
            const SizedBox(width: 12),
            Expanded(child: _field('region', 'State / region')),
          ]),
          Row(children: [
            Expanded(child: _field('postal_code', 'Postal code', required: false)),
            const SizedBox(width: 12),
            Expanded(child: _field('country', 'Country')),
          ]),
          _field('phone', 'Phone', required: false, kt: TextInputType.phone),
          SwitchListTile(
            value: _default,
            onChanged: (v) => setState(() => _default = v),
            title: const Text('Make this my default address'),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save address'),
          ),
        ]),
      ),
    );
  }
}
