import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/RFQ.tsx` — buyers post RFQs, suppliers browse public
/// RFQs and place counter-offer bids into `rfq_bids`.
class RfqScreen extends StatefulWidget {
  const RfqScreen({super.key});
  @override
  State<RfqScreen> createState() => _RfqScreenState();
}

class _RfqScreenState extends State<RfqScreen> with SingleTickerProviderStateMixin {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _qty = TextEditingController(text: '1');
  final _budget = TextEditingController();
  String _category = 'General';
  bool _submitting = false;
  late TabController _tabs;
  late Future<List<Map<String, dynamic>>> _mine;
  late Future<List<Map<String, dynamic>>> _browse;

  static const _categories = ['General', 'Electronics', 'Machinery', 'Agriculture', 'Construction', 'Packaging', 'Textiles'];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _mine = _loadMine();
    _browse = _loadBrowse();
  }

  Future<List<Map<String, dynamic>>> _loadMine() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return [];
    final rows = await supabase.from('rfqs').select('*').eq('buyer_id', uid).order('created_at', ascending: false).limit(50);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> _loadBrowse() async {
    final rows = await supabase.from('rfqs')
      .select('*, buyer:buyer_id(display_name, avatar_url)')
      .eq('status', 'open')
      .order('created_at', ascending: false)
      .limit(80);
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
      setState(() {
        _mine = _loadMine();
        _browse = _loadBrowse();
        _tabs.animateTo(1);
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('RFQ posted — suppliers will bid shortly')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _openRfq(Map<String, dynamic> r, {bool asSupplier = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _RfqDetailSheet(rfq: r, asSupplier: asSupplier),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Request for quote'),
        bottom: TabBar(controller: _tabs, tabs: const [
          Tab(text: 'Post'),
          Tab(text: 'My RFQs'),
          Tab(text: 'Browse'),
        ]),
      ),
      body: TabBarView(controller: _tabs, children: [
        _buildPost(),
        _buildMine(),
        _buildBrowse(),
      ]),
    );
  }

  Widget _buildPost() => ListView(padding: const EdgeInsets.all(16), children: [
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
  ]);

  Widget _buildMine() => FutureBuilder<List<Map<String, dynamic>>>(
    future: _mine,
    builder: (context, snap) {
      if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 3);
      final rows = snap.data ?? const [];
      if (rows.isEmpty) return const Center(child: Text('No RFQs yet.', style: TextStyle(color: AppColors.muted)));
      return RefreshIndicator(
        onRefresh: () async { setState(() => _mine = _loadMine()); await _mine; },
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => _rfqCard(rows[i], onTap: () => _openRfq(rows[i])),
        ),
      );
    },
  );

  Widget _buildBrowse() => FutureBuilder<List<Map<String, dynamic>>>(
    future: _browse,
    builder: (context, snap) {
      if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
      final rows = snap.data ?? const [];
      if (rows.isEmpty) return const Center(child: Text('No open RFQs right now.', style: TextStyle(color: AppColors.muted)));
      return RefreshIndicator(
        onRefresh: () async { setState(() => _browse = _loadBrowse()); await _browse; },
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => _rfqCard(rows[i], showBuyer: true, onTap: () => _openRfq(rows[i], asSupplier: true)),
        ),
      );
    },
  );

  Widget _rfqCard(Map<String, dynamic> r, {bool showBuyer = false, VoidCallback? onTap}) {
    final buyer = (r['buyer'] ?? {}) as Map;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
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
          if (showBuyer && buyer['display_name'] != null) ...[
            const SizedBox(height: 4),
            Text('by ${buyer['display_name']}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
          const SizedBox(height: 6),
          Text('Qty: ${r['quantity'] ?? '—'} · Budget: \$${r['budget'] ?? '—'} · ${r['category'] ?? ''}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          if ((r['description'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${r['description']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
          ],
        ]),
      ),
    );
  }
}

class _RfqDetailSheet extends StatefulWidget {
  const _RfqDetailSheet({required this.rfq, required this.asSupplier});
  final Map<String, dynamic> rfq;
  final bool asSupplier;
  @override
  State<_RfqDetailSheet> createState() => _RfqDetailSheetState();
}

class _RfqDetailSheetState extends State<_RfqDetailSheet> {
  final _price = TextEditingController();
  final _leadTime = TextEditingController();
  final _message = TextEditingController();
  bool _submitting = false;
  List<Map<String, dynamic>> _bids = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBids();
  }

  Future<void> _loadBids() async {
    try {
      final rows = await supabase.from('rfq_bids')
          .select('*, supplier:supplier_id(display_name, avatar_url)')
          .eq('rfq_id', widget.rfq['id'])
          .order('created_at', ascending: false);
      if (!mounted) return;
      setState(() { _bids = (rows as List).cast<Map<String, dynamic>>(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitBid() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final price = double.tryParse(_price.text.trim());
    if (price == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid price')));
      return;
    }
    setState(() => _submitting = true);
    try {
      await supabase.from('rfq_bids').insert({
        'rfq_id': widget.rfq['id'],
        'supplier_id': uid,
        'unit_price': price,
        'lead_time_days': int.tryParse(_leadTime.text.trim()),
        'message': _message.text.trim(),
        'status': 'submitted',
      });
      if (!mounted) return;
      _price.clear(); _leadTime.clear(); _message.clear();
      await _loadBids();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Counter-offer sent')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _acceptBid(Map<String, dynamic> b) async {
    try {
      await supabase.from('rfq_bids').update({'status': 'accepted'}).eq('id', b['id']);
      await supabase.from('rfqs').update({'status': 'awarded'}).eq('id', widget.rfq['id']);
      await _loadBids();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bid accepted')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.rfq;
    return DraggableScrollableSheet(
      expand: false, initialChildSize: 0.9, maxChildSize: 0.95,
      builder: (_, ctrl) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: ListView(controller: ctrl, padding: const EdgeInsets.all(16), children: [
          Text(r['title']?.toString() ?? '—', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text('Qty ${r['quantity']} · Budget \$${r['budget'] ?? '—'} · ${r['category'] ?? ''}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          if ((r['description'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(r['description'].toString()),
          ],
          const SizedBox(height: 18),
          if (widget.asSupplier) ...[
            const Text('Send counter-offer', style: TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            TextField(controller: _price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Your unit price', prefixText: '\$ ', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: _leadTime, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Lead time (days)', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            TextField(controller: _message, maxLines: 3, decoration: const InputDecoration(labelText: 'Message / terms', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _submitting ? null : _submitBid,
              icon: const Icon(LucideIcons.send, size: 16),
              label: Text(_submitting ? 'Sending…' : 'Send counter-offer'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
            ),
            const SizedBox(height: 18),
          ],
          const Text('Bids', style: TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          if (_loading)
            Skeletons.list(count: 2)
          else if (_bids.isEmpty)
            const Text('No bids yet.', style: TextStyle(color: AppColors.muted))
          else
            for (final b in _bids)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(((b['supplier'] ?? {}) as Map)['display_name']?.toString() ?? 'Supplier',
                        style: const TextStyle(fontWeight: FontWeight.w800))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
                      child: Text('${b['status']}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
                    ),
                  ]),
                  const SizedBox(height: 4),
                  Text('\$${b['unit_price']} / unit · ${b['lead_time_days'] ?? '—'}d lead',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  if ((b['message'] ?? '').toString().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text('${b['message']}', style: const TextStyle(fontSize: 12)),
                  ],
                  if (!widget.asSupplier && b['status'] == 'submitted') ...[
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton(
                        onPressed: () => _acceptBid(b),
                        child: const Text('Accept'),
                      ),
                    ),
                  ],
                ]),
              ),
        ]),
      ),
    );
  }
}
