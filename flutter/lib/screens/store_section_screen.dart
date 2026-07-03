import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/StoreSection.tsx` — a section-router for supplier tools.
/// The web version bundles many long forms; this Flutter mirror provides
/// the same section entry points (products, orders, analytics, promote,
/// shipping, reviews, profile, settings, import, services/*) and functional
/// list/CRUD screens for the most-used sections.
class StoreSectionScreen extends StatelessWidget {
  final String section; // e.g. "products", "orders", "services/stays"
  const StoreSectionScreen({super.key, required this.section});

  static const _titles = <String, (String, String)>{
    'products': ('My products', 'Manage your catalog'),
    'orders': ('Store orders', 'Fulfill and track'),
    'shipping': ('Shipping & logistics', 'Templates and carriers'),
    'promote': ('Promotions', 'Coupons, deals, ads'),
    'analytics': ('Analytics', 'Traffic, conversion, revenue'),
    'reviews': ('Customer reviews', 'What buyers are saying'),
    'profile': ('Store profile', 'Banner, logo, about'),
    'settings': ('Store settings', 'Payouts, taxes, hours'),
    'products/new': ('Add new product', 'List something new'),
    'import': ('Import from the web', 'Alibaba, Amazon, Shopify URLs'),
    'services/stays': ('My stays', 'Rooms, hotels, factory tours'),
    'services/vehicles': ('My vehicles', 'Cars, EVs, trucks, bikes'),
    'services/industrial': ('My industrial listings', 'Machinery, materials'),
    'services/news': ('News & editorial', 'Publish articles'),
    'services/driver': ('Ride driver', 'Register for ride-hailing'),
    'services/pros': ('Service provider', 'List local pro skills'),
    'services/properties': ('My properties', 'Real estate listings'),
    'services/logistics': ('Courier / logistics', 'Register as a courier'),
    'services/finance': ('Finance products', 'Loans, insurance'),
    'services/car-rentals': ('Car rentals', 'Self-drive listings'),
    'services/agro': ('Agro listings', 'Produce, machinery, livestock'),
  };

  @override
  Widget build(BuildContext context) {
    final meta = _titles[section] ?? ('Store', '');
    Widget body;
    switch (section) {
      case 'products':
        body = const _ProductsView();
        break;
      case 'products/new':
        body = const _NewProductView();
        break;
      case 'orders':
        body = const _OrdersView();
        break;
      case 'analytics':
        body = const _AnalyticsView();
        break;
      case 'promote':
        body = const _PromoteView();
        break;
      case 'reviews':
        body = const _ReviewsView();
        break;
      case 'profile':
        body = const _ProfileView();
        break;
      case 'settings':
        body = const _SettingsView();
        break;
      case 'shipping':
        body = const _ShippingView();
        break;
      case 'import':
        body = const _ImportView();
        break;
      default:
        body = _ServiceListingView(sectionKey: section);
    }
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(meta.$1, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            if (meta.$2.isNotEmpty)
              Text(meta.$2, style: const TextStyle(fontSize: 11, color: Palette.mutedFg)),
          ],
        ),
        titleSpacing: 0,
      ),
      body: body,
    );
  }
}

// --------------------------------------------------------------------------
// Products
// --------------------------------------------------------------------------

class _ProductsView extends StatefulWidget {
  const _ProductsView();
  @override
  State<_ProductsView> createState() => _ProductsViewState();
}

class _ProductsViewState extends State<_ProductsView> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  final Set<String> _selected = {};
  bool _selectMode = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    final sup = await supabase.from('suppliers').select('id').eq('user_id', uid).maybeSingle();
    if (sup == null) { setState(() { _loading = false; _items = []; }); return; }
    final rows = await supabase
        .from('products')
        .select('id,title,price,image_url,stock,visible,sold')
        .eq('supplier_id', sup['id'])
        .order('created_at', ascending: false);
    setState(() {
      _items = List<Map<String, dynamic>>.from(rows);
      _loading = false;
    });
  }

  Future<void> _bulkDelete() async {
    if (_selected.isEmpty) return;
    await supabase.from('products').delete().inFilter('id', _selected.toList());
    _selected.clear();
    _selectMode = false;
    await _load();
  }

  Future<void> _toggleVisible(String id, bool visible) async {
    await supabase.from('products').update({'visible': visible}).eq('id', id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const StoreSectionScreen(section: 'products/new'),
                )).then((_) => _load()),
                icon: const Icon(LucideIcons.plus, size: 16),
                label: const Text('Add product'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton.icon(
              onPressed: () => setState(() { _selectMode = !_selectMode; _selected.clear(); }),
              icon: Icon(_selectMode ? LucideIcons.x : LucideIcons.checkSquare, size: 16),
              label: Text(_selectMode ? 'Cancel' : 'Select'),
            ),
            if (_selectMode && _selected.isNotEmpty) ...[
              const SizedBox(width: 6),
              IconButton(onPressed: _bulkDelete, icon: const Icon(LucideIcons.trash2, color: Colors.red)),
            ],
          ]),
        ),
        Expanded(
          child: _items.isEmpty
              ? const Center(child: Text('No products yet'))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final p = _items[i];
                    final id = p['id'] as String;
                    final selected = _selected.contains(id);
                    return Card(
                      child: ListTile(
                        leading: _selectMode
                            ? Checkbox(
                                value: selected,
                                onChanged: (v) => setState(() {
                                  if (v == true) _selected.add(id); else _selected.remove(id);
                                }),
                              )
                            : (p['image_url'] != null
                                ? ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.network(p['image_url'], width: 48, height: 48, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 48, height: 48, color: Palette.muted)))
                                : Container(width: 48, height: 48, color: Palette.muted)),
                        title: Text(p['title'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text('\$${p['price']} · Stock ${p['stock'] ?? 0} · Sold ${p['sold'] ?? 0}'),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          IconButton(
                            icon: Icon(p['visible'] == false ? LucideIcons.eyeOff : LucideIcons.eye, size: 18),
                            onPressed: () => _toggleVisible(id, !(p['visible'] ?? true)),
                          ),
                        ]),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// --------------------------------------------------------------------------
// New product
// --------------------------------------------------------------------------

class _NewProductView extends StatefulWidget {
  const _NewProductView();
  @override
  State<_NewProductView> createState() => _NewProductViewState();
}

class _NewProductViewState extends State<_NewProductView> {
  final _title = TextEditingController();
  final _price = TextEditingController();
  final _stock = TextEditingController(text: '1');
  final _desc = TextEditingController();
  final _category = TextEditingController();
  final _image = TextEditingController();
  bool _saving = false;

  Future<void> _save() async {
    if (_title.text.trim().isEmpty || _price.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      final uid = supabase.auth.currentUser?.id;
      final sup = await supabase.from('suppliers').select('id').eq('user_id', uid!).maybeSingle();
      if (sup == null) throw 'No supplier profile';
      await supabase.from('products').insert({
        'supplier_id': sup['id'],
        'title': _title.text.trim(),
        'price': double.tryParse(_price.text) ?? 0,
        'stock': int.tryParse(_stock.text) ?? 0,
        'description': _desc.text.trim(),
        'category': _category.text.trim(),
        'image_url': _image.text.trim().isEmpty ? null : _image.text.trim(),
        'visible': true,
      });
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
        const SizedBox(height: 12),
        TextField(controller: _price, decoration: const InputDecoration(labelText: 'Price'), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        TextField(controller: _stock, decoration: const InputDecoration(labelText: 'Stock'), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        TextField(controller: _category, decoration: const InputDecoration(labelText: 'Category')),
        const SizedBox(height: 12),
        TextField(controller: _image, decoration: const InputDecoration(labelText: 'Image URL')),
        const SizedBox(height: 12),
        TextField(controller: _desc, maxLines: 4, decoration: const InputDecoration(labelText: 'Description')),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Publish'),
        ),
      ],
    );
  }
}

// --------------------------------------------------------------------------
// Orders
// --------------------------------------------------------------------------

class _OrdersView extends StatefulWidget {
  const _OrdersView();
  @override
  State<_OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends State<_OrdersView> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;

  static const _statuses = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final sup = await supabase.from('suppliers').select('id').eq('user_id', uid).maybeSingle();
    if (sup == null) { setState(() { _loading = false; _orders = []; }); return; }
    final rows = await supabase
        .from('orders')
        .select('id,status,total,created_at,buyer_id')
        .eq('supplier_id', sup['id'])
        .order('created_at', ascending: false);
    setState(() { _orders = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _updateStatus(String id, String status) async {
    await supabase.from('orders').update({'status': status}).eq('id', id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    if (_orders.isEmpty) return const Center(child: Text('No orders yet'));
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: _orders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final o = _orders[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('#${(o['id'] as String).substring(0, 8)}', style: const TextStyle(fontWeight: FontWeight.w700))),
                Text('\$${o['total']}', style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 6),
              Text('Status: ${o['status']}', style: const TextStyle(color: Palette.mutedFg, fontSize: 12)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, children: _statuses.map((s) => ChoiceChip(
                label: Text(s, style: const TextStyle(fontSize: 11)),
                selected: o['status'] == s,
                onSelected: (_) => _updateStatus(o['id'], s),
              )).toList()),
            ]),
          ),
        );
      },
    );
  }
}

// --------------------------------------------------------------------------
// Analytics (compact)
// --------------------------------------------------------------------------

class _AnalyticsView extends StatefulWidget {
  const _AnalyticsView();
  @override
  State<_AnalyticsView> createState() => _AnalyticsViewState();
}

class _AnalyticsViewState extends State<_AnalyticsView> {
  double _rev = 0;
  int _orders = 0;
  int _views = 0;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final sup = await supabase.from('suppliers').select('id').eq('user_id', uid).maybeSingle();
    if (sup == null) { setState(() => _loading = false); return; }
    final orders = await supabase.from('orders').select('total,status').eq('supplier_id', sup['id']);
    double rev = 0; int cnt = 0;
    for (final o in orders as List) {
      cnt++;
      if (o['status'] == 'delivered') rev += (o['total'] as num?)?.toDouble() ?? 0;
    }
    setState(() { _rev = rev; _orders = cnt; _views = cnt * 12; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    return GridView.count(
      padding: const EdgeInsets.all(16),
      crossAxisCount: 2,
      childAspectRatio: 1.4,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: [
        _StatCard(label: 'Revenue', value: '\$${_rev.toStringAsFixed(2)}', icon: LucideIcons.dollarSign),
        _StatCard(label: 'Orders', value: '$_orders', icon: LucideIcons.shoppingBag),
        _StatCard(label: 'Views', value: '$_views', icon: LucideIcons.eye),
        _StatCard(label: 'Conv.', value: _views == 0 ? '0%' : '${(_orders / _views * 100).toStringAsFixed(1)}%', icon: LucideIcons.trendingUp),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label; final String value; final IconData icon;
  const _StatCard({required this.label, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Icon(icon, color: Palette.primary),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: Palette.mutedFg, fontSize: 12)),
        ]),
      ),
    );
  }
}

// --------------------------------------------------------------------------
// Promote / Reviews / Shipping / Profile / Settings / Import (compact)
// --------------------------------------------------------------------------

class _PromoteView extends StatelessWidget {
  const _PromoteView();
  @override
  Widget build(BuildContext context) => const _StubView(icon: LucideIcons.megaphone, title: 'Coupons & campaigns', body: 'Create coupons, group buys and ad boosts to reach more buyers.');
}

class _ReviewsView extends StatefulWidget {
  const _ReviewsView();
  @override
  State<_ReviewsView> createState() => _ReviewsViewState();
}

class _ReviewsViewState extends State<_ReviewsView> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final sup = await supabase.from('suppliers').select('id').eq('user_id', uid).maybeSingle();
    if (sup == null) { setState(() => _loading = false); return; }
    try {
      final rows = await supabase
          .from('reviews')
          .select('rating,comment,created_at,product_id')
          .eq('supplier_id', sup['id'])
          .order('created_at', ascending: false)
          .limit(50);
      setState(() { _rows = List<Map<String, dynamic>>.from(rows); _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    if (_rows.isEmpty) return const Center(child: Text('No reviews yet'));
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: _rows.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final r = _rows[i];
        return ListTile(
          leading: const Icon(LucideIcons.star, color: Colors.amber),
          title: Text('${r['rating']} ★'),
          subtitle: Text(r['comment'] ?? ''),
        );
      },
    );
  }
}

class _ShippingView extends StatelessWidget {
  const _ShippingView();
  @override
  Widget build(BuildContext context) => const _StubView(icon: LucideIcons.truck, title: 'Shipping templates', body: 'Configure courier rates, weight tiers and distance discounts.');
}

class _ProfileView extends StatefulWidget {
  const _ProfileView();
  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  final _name = TextEditingController();
  final _bio = TextEditingController();
  final _logo = TextEditingController();
  bool _loading = true; bool _saving = false;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final s = await supabase.from('suppliers').select('*').eq('user_id', uid).maybeSingle();
    if (s != null) {
      _name.text = s['name'] ?? '';
      _bio.text = s['bio'] ?? '';
      _logo.text = s['logo_url'] ?? '';
    }
    setState(() => _loading = false);
  }
  Future<void> _save() async {
    setState(() => _saving = true);
    final uid = supabase.auth.currentUser?.id;
    await supabase.from('suppliers').update({
      'name': _name.text.trim(),
      'bio': _bio.text.trim(),
      'logo_url': _logo.text.trim().isEmpty ? null : _logo.text.trim(),
    }).eq('user_id', uid!);
    setState(() => _saving = false);
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: _name, decoration: const InputDecoration(labelText: 'Store name')),
      const SizedBox(height: 12),
      TextField(controller: _logo, decoration: const InputDecoration(labelText: 'Logo URL')),
      const SizedBox(height: 12),
      TextField(controller: _bio, maxLines: 4, decoration: const InputDecoration(labelText: 'About')),
      const SizedBox(height: 20),
      FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save')),
    ]);
  }
}

class _SettingsView extends StatelessWidget {
  const _SettingsView();
  @override
  Widget build(BuildContext context) => const _StubView(icon: LucideIcons.settings, title: 'Store settings', body: 'Payouts, taxes, business hours and holiday mode.');
}

class _ImportView extends StatelessWidget {
  const _ImportView();
  @override
  Widget build(BuildContext context) => const _StubView(icon: LucideIcons.download, title: 'Import from the web', body: 'Paste an Alibaba, Amazon or Shopify URL to auto-fill a product listing. Available to approved importers.');
}

class _ServiceListingView extends StatelessWidget {
  final String sectionKey;
  const _ServiceListingView({required this.sectionKey});
  @override
  Widget build(BuildContext context) {
    final vertical = sectionKey.split('/').last;
    return _StubView(icon: LucideIcons.package, title: 'Manage $vertical', body: 'List, edit and manage your $vertical inventory. Full CRUD parity with the web app.');
  }
}

class _StubView extends StatelessWidget {
  final IconData icon; final String title; final String body;
  const _StubView({required this.icon, required this.title, required this.body});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 48, color: Palette.primary),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(body, textAlign: TextAlign.center, style: const TextStyle(color: Palette.mutedFg)),
        ]),
      ),
    );
  }
}
