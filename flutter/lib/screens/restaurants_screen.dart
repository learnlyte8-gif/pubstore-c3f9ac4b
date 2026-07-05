import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/Restaurants.tsx` — list, detail (menu), and order flow.
class RestaurantsScreen extends StatefulWidget {
  const RestaurantsScreen({super.key});
  @override
  State<RestaurantsScreen> createState() => _RestaurantsScreenState();
}

class _RestaurantsScreenState extends State<RestaurantsScreen> {
  String _cuisine = '';
  late Future<List<Map<String, dynamic>>> _future;

  static const _cuisines = ['Local', 'Fast Food', 'Pizza', 'Chinese', 'Indian', 'Italian', 'Coffee', 'Bakery', 'Healthy'];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    dynamic q = supabase.from('restaurants').select('*').eq('active', true).order('rating', ascending: false);
    if (_cuisine.isNotEmpty) q = q.eq('cuisine', _cuisine);
    final rows = await q.limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _setCuisine(String c) => setState(() { _cuisine = c; _future = _load(); });

  String _priceLevel(int n) => '\$' * n.clamp(1, 4);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFE11D48), Color(0xFFEA580C)]),
            ),
            child: Row(children: [
              IconButton(icon: const Icon(LucideIcons.arrowLeft, color: Colors.white), onPressed: () => Navigator.of(context).maybePop()),
              const Icon(LucideIcons.utensils, color: Colors.white),
              const SizedBox(width: 10),
              const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Restaurants', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                Text('Order food, reserve a table', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ])),
            ]),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              scrollDirection: Axis.horizontal,
              itemCount: _cuisines.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                if (i == 0) return ChoiceChip(label: const Text('All'), selected: _cuisine.isEmpty, onSelected: (_) => _setCuisine(''));
                final c = _cuisines[i - 1];
                return ChoiceChip(label: Text(c), selected: _cuisine == c, onSelected: (_) => _setCuisine(c));
              },
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
                final rows = snap.data ?? const [];
                if (rows.isEmpty) return const Center(child: Text('No restaurants yet'));
                return ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    final r = rows[i];
                    return _RestaurantCard(r: r, priceLevel: _priceLevel, onTap: () {
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => RestaurantDetailScreen(id: r['id'].toString()),
                      ));
                    });
                  },
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  const _RestaurantCard({required this.r, required this.priceLevel, required this.onTap});
  final Map<String, dynamic> r;
  final String Function(int) priceLevel;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final cover = (r['cover'] ?? '').toString();
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(fit: StackFit.expand, children: [
              cover.isEmpty
                  ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.utensils, color: AppColors.muted, size: 36))
                  : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
              if (r['delivery_enabled'] == true)
                Positioned(top: 8, left: 8, child: _tag(LucideIcons.truck, 'Delivery')),
              if (r['reservation_enabled'] == true)
                Positioned(top: 8, right: 8, child: _tag(LucideIcons.calendar, 'Tables')),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${r['name'] ?? 'Restaurant'}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
                const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
                const SizedBox(width: 2),
                Text('${(r['rating'] ?? 4.5).toString()}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 4),
              Text('${r['cuisine'] ?? 'Restaurant'} · ${priceLevel((r['price_level'] ?? 1) as int)}${r['city'] != null ? " · ${r['city']}" : ""}',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              const SizedBox(height: 6),
              Row(children: [
                _pill(LucideIcons.clock, '${r['prep_time_minutes'] ?? 25} min'),
                const SizedBox(width: 8),
                if (r['delivery_enabled'] == true) _pill(LucideIcons.bike, '\$${(r['delivery_fee'] ?? 0).toString()} delivery'),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _tag(IconData i, String t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
    decoration: BoxDecoration(color: Colors.white.withOpacity(.95), borderRadius: BorderRadius.circular(999)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(i, size: 10), const SizedBox(width: 3),
      Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
    ]),
  );

  Widget _pill(IconData icon, String text) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12, color: AppColors.muted),
      const SizedBox(width: 4),
      Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
    ]),
  );
}

/* ---------------- DETAIL ---------------- */

class RestaurantDetailScreen extends StatefulWidget {
  const RestaurantDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  Map<String, dynamic>? _r;
  List<Map<String, dynamic>> _menu = const [];
  final Map<String, int> _cart = {}; // item_id -> qty
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await supabase.from('restaurants').select('*').eq('id', widget.id).maybeSingle();
    final menu = await supabase.from('menu_items').select('*').eq('restaurant_id', widget.id).eq('available', true).order('sort_order');
    if (!mounted) return;
    setState(() {
      _r = r == null ? null : Map<String, dynamic>.from(r);
      _menu = (menu as List).cast<Map<String, dynamic>>();
      _loading = false;
    });
  }

  double get _subtotal {
    double s = 0;
    for (final it in _menu) {
      final q = _cart[it['id'].toString()] ?? 0;
      s += q * ((it['price'] as num?)?.toDouble() ?? 0);
    }
    return s;
  }

  int get _itemCount => _cart.values.fold(0, (a, b) => a + b);

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(backgroundColor: AppColors.background, body: Skeletons.screen(SkeletonPreset.detail));
    final r = _r;
    if (r == null) return const Scaffold(body: Center(child: Text('Not found')));
    final cover = (r['cover'] ?? '').toString();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 220, pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text('${r['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900)),
            background: cover.isEmpty
                ? Container(color: AppColors.mutedSurface)
                : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
          ),
        ),
        SliverToBoxAdapter(child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
              Text(' ${r['rating'] ?? 4.5} · ${r['review_count'] ?? 0} reviews', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const Spacer(),
              if (r['phone'] != null) Icon(LucideIcons.phone, size: 14, color: AppColors.muted),
              if (r['phone'] != null) const SizedBox(width: 4),
              if (r['phone'] != null) Text('${r['phone']}', style: const TextStyle(fontSize: 12)),
            ]),
            const SizedBox(height: 4),
            Text('${r['cuisine'] ?? 'Restaurant'} · ${r['city'] ?? ''}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            if (r['description'] != null && r['description'].toString().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('${r['description']}', style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 16),
            const Text('Menu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ]),
        )),
        if (_menu.isEmpty)
          const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No menu items yet')))
        else
          SliverList.separated(
            itemCount: _menu.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) => _MenuItemTile(
              item: _menu[i],
              qty: _cart[_menu[i]['id'].toString()] ?? 0,
              onAdd: () => setState(() { final k = _menu[i]['id'].toString(); _cart[k] = (_cart[k] ?? 0) + 1; }),
              onRemove: () => setState(() {
                final k = _menu[i]['id'].toString();
                final q = (_cart[k] ?? 0) - 1;
                if (q <= 0) _cart.remove(k); else _cart[k] = q;
              }),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ]),
      bottomNavigationBar: _itemCount == 0 ? null : SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: AppColors.foreground),
            onPressed: () => _openCheckout(r),
            child: Text('Checkout ($_itemCount) · \$${_subtotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
        ),
      ),
    );
  }

  void _openCheckout(Map<String, dynamic> r) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _CheckoutSheet(
        restaurant: r,
        items: _menu.where((m) => _cart.containsKey(m['id'].toString())).map((m) => {
          'id': m['id'], 'name': m['name'], 'price': m['price'], 'qty': _cart[m['id'].toString()]!,
        }).toList(),
        subtotal: _subtotal,
        onDone: () { setState(() => _cart.clear()); },
      ),
    );
  }
}

class _MenuItemTile extends StatelessWidget {
  const _MenuItemTile({required this.item, required this.qty, required this.onAdd, required this.onRemove});
  final Map<String, dynamic> item;
  final int qty;
  final VoidCallback onAdd, onRemove;

  @override
  Widget build(BuildContext context) {
    final img = (item['image'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${item['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          if (item['description'] != null) ...[
            const SizedBox(height: 2),
            Text('${item['description']}', style: const TextStyle(fontSize: 12, color: AppColors.muted), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 6),
          Text('\$${(item['price'] as num?)?.toStringAsFixed(2) ?? '0.00'}', style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.priceRed)),
        ])),
        const SizedBox(width: 12),
        Column(children: [
          SizedBox(
            width: 84, height: 84,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: img.isEmpty
                  ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.utensils, color: AppColors.muted))
                  : CachedNetworkImage(imageUrl: img, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 6),
          if (qty == 0)
            OutlinedButton(onPressed: onAdd, child: const Text('Add'))
          else
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(icon: const Icon(LucideIcons.minus, size: 16), onPressed: onRemove, padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28)),
              SizedBox(width: 20, child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w900))),
              IconButton(icon: const Icon(LucideIcons.plus, size: 16), onPressed: onAdd, padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28)),
            ]),
        ]),
      ]),
    );
  }
}

class _CheckoutSheet extends StatefulWidget {
  const _CheckoutSheet({required this.restaurant, required this.items, required this.subtotal, required this.onDone});
  final Map<String, dynamic> restaurant;
  final List<Map<String, dynamic>> items;
  final double subtotal;
  final VoidCallback onDone;
  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();
  bool _saving = false;

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to order')));
      return;
    }
    if (_address.text.trim().isEmpty || _phone.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Address and phone required')));
      return;
    }
    setState(() => _saving = true);
    try {
      final deliveryFee = (widget.restaurant['delivery_fee'] as num?)?.toDouble() ?? 0;
      await supabase.from('food_orders').insert({
        'buyer_id': uid,
        'restaurant_id': widget.restaurant['id'],
        'items': widget.items,
        'subtotal': widget.subtotal,
        'delivery_fee': deliveryFee,
        'total': widget.subtotal + deliveryFee,
        'currency': 'USD',
        'status': 'pending',
        'delivery_address': _address.text.trim(),
        'contact_phone': _phone.text.trim(),
        'notes': _notes.text.trim(),
      });
      if (!mounted) return;
      widget.onDone();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order placed!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final deliveryFee = (widget.restaurant['delivery_fee'] as num?)?.toDouble() ?? 0;
    return DraggableScrollableSheet(
      expand: false, initialChildSize: .9, maxChildSize: .95,
      builder: (_, ctrl) => ListView(controller: ctrl, padding: const EdgeInsets.all(16), children: [
        Row(children: [
          const Expanded(child: Text('Checkout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900))),
          IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 8),
        ...widget.items.map((it) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Text('${it['qty']}× ', style: const TextStyle(fontWeight: FontWeight.w800)),
            Expanded(child: Text('${it['name']}')),
            Text('\$${((it['price'] as num).toDouble() * (it['qty'] as int)).toStringAsFixed(2)}'),
          ]),
        )),
        const Divider(),
        _row('Subtotal', '\$${widget.subtotal.toStringAsFixed(2)}'),
        _row('Delivery fee', '\$${deliveryFee.toStringAsFixed(2)}'),
        _row('Total', '\$${(widget.subtotal + deliveryFee).toStringAsFixed(2)}', bold: true),
        const SizedBox(height: 12),
        TextField(controller: _address, decoration: const InputDecoration(labelText: 'Delivery address *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Contact phone *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder())),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.foreground),
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Placing…' : 'Place order', style: const TextStyle(fontWeight: FontWeight.w900)),
        ),
      ]),
    );
  }

  Widget _row(String a, String b, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(a, style: TextStyle(color: bold ? AppColors.foreground : AppColors.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.normal)),
      Text(b, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w700)),
    ]),
  );
}
