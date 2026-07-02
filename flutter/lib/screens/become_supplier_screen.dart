import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/BecomeSupplier.tsx` — seller onboarding form. Creates
/// a row in `suppliers`.
class BecomeSupplierScreen extends StatefulWidget {
  const BecomeSupplierScreen({super.key});
  @override
  State<BecomeSupplierScreen> createState() => _BecomeSupplierScreenState();
}

class _BecomeSupplierScreenState extends State<BecomeSupplierScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _tagline = TextEditingController();
  final _about = TextEditingController();
  final _country = TextEditingController(text: 'Zimbabwe');
  final _category = TextEditingController();
  bool _submitting = false;

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _submitting = true);
    try {
      await supabase.from('suppliers').upsert({
        'user_id': uid,
        'name': _name.text.trim(),
        'tagline': _tagline.text.trim(),
        'about': _about.text.trim(),
        'country': _country.text.trim(),
        'primary_category': _category.text.trim(),
        'active': true,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Welcome aboard! Your store is live.')));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sell on PUBSTORE')),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('Open your storefront', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text('Reach millions of buyers across Southern Africa.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 24),
          _field(_name, 'Business name'),
          _field(_tagline, 'One-line tagline', required: false),
          _field(_about, 'About your business', maxLines: 4, required: false),
          _field(_category, 'Primary category (e.g. Electronics)'),
          _field(_country, 'Country'),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: const Icon(LucideIcons.store),
            label: Text(_submitting ? 'Creating…' : 'Create my store'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: AppColors.orange),
          ),
          const SizedBox(height: 20),
          const Text('By creating a store you agree to PUBSTORE’s seller terms. Payouts are processed weekly to your linked wallet.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 11)),
        ]),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, {bool required = true, int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          controller: c,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
          validator: (v) => required && (v == null || v.trim().isEmpty) ? 'Required' : null,
        ),
      );
}
