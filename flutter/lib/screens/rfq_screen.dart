import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/RFQ.tsx` — buyers post a Request For Quote and receive
/// supplier bids. Writes to `rfqs`.
class RfqScreen extends StatefulWidget {
  const RfqScreen({super.key});
  @override
  State<RfqScreen> createState() => _RfqScreenState();
}

class _RfqScreenState extends State<RfqScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _qty = TextEditingController(text: '1');
  final _budget = TextEditingController();
  String _category = 'General';
  bool _submitting = false;
  late Future<List<Map<String, dynamic>>> _future;

  static const _categories = ['General', 'Electronics', 'Machinery', 'Agriculture', 'Construction', 'Packaging', 'Textiles'];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return [];
    final rows = await supabase.from('rfqs').select('*').eq('buyer_id', uid).order('created_at', ascending: false).limit(50);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null || _title.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      await supabase.from('rfqs').insert({
        'buyer_id': uid,
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'category': _category,
        'quantity': int.tryParse(_qty.text) ?? 1,
        'budget': double.tryParse(_budget.text),
        'status': 'open',
      });
      _title.clear(); _description.clear(); _budget.clear();
      setState(() => _future = _load());
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('RFQ posted — suppliers will bid shortly')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Request for quote')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Post a new RFQ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: _title, decoration: const InputDecoration(labelText: 'What are you sourcing?', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            TextField(controller: _description, maxLines: 3, decoration: const InputDecoration(labelText: 'Specs, quality, timeline…', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: _qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity', border: OutlineInputBorder()))),
              const SizedBox(width: 10),
              Expanded(child: TextField(controller: _budget, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Budget (USD)', border: OutlineInputBorder()))),
            ]),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
              items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _category = v ?? 'General'),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: const Icon(LucideIcons.send, size: 16),
              label: Text(_submitting ? 'Posting…' : 'Post RFQ'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46), backgroundColor: AppColors.orange),
            ),
          ]),
        ),
        const SizedBox(height: 24),
        const Text('Your RFQs', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) return const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()));
            final rows = snap.data ?? const [];
            if (rows.isEmpty) return const Text('No RFQs yet.', style: TextStyle(color: AppColors.muted));
            return Column(children: [
              for (final r in rows)
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text('${r['title']}', style: const TextStyle(fontWeight: FontWeight.w800))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
                        child: Text('${r['status']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text('Qty: ${r['quantity']} · Budget: \$${r['budget'] ?? '—'}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ]),
                ),
            ]);
          },
        ),
      ]),
    );
  }
}
