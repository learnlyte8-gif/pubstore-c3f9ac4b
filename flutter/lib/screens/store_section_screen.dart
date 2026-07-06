import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'product_detail_screen.dart';
import 'store_service_verticals.dart' as vert;

/// Mirrors `src/pages/StoreSection.tsx` — supplier section router with
/// full-parity CRUD for Products, Orders, Analytics, Promotions (coupons),
/// Reviews, Shipping (courier partnerships), Profile, Settings.
/// Service verticals + Import remain thin passthroughs for now (see plan).
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
    final meta = section.startsWith('product-edit/')
        ? ('Edit product', 'Update details, price, photos')
        : (_titles[section] ?? ('Store', ''));
    Widget body;
    switch (section) {
      case 'products': body = const _ProductsView(); break;
      case 'products/new': body = const _NewProductView(); break;
      case 'orders': body = const _OrdersView(); break;
      case 'analytics': body = const _AnalyticsView(); break;
      case 'promote': body = const _PromoteView(); break;
      case 'reviews': body = const _ReviewsView(); break;
      case 'profile': body = const _ProfileView(); break;
      case 'settings': body = const _SettingsView(); break;
      case 'shipping': body = const _ShippingView(); break;
      case 'import': body = const _ImportStubView(); break;
      default:
        if (section.startsWith('product-edit/')) {
          body = _EditProductView(productId: section.substring('product-edit/'.length));
        } else {
          body = _ServiceListingView(sectionKey: section);
        }
    }
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(meta.$1, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            if (meta.$2.isNotEmpty)
              Text(meta.$2, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
        ),
        titleSpacing: 0,
      ),
      body: body,
    );
  }
}

// ==========================================================================
// Shared helpers
// ==========================================================================

Future<Map<String, dynamic>?> _mySupplier() async {
  final uid = supabase.auth.currentUser?.id;
  if (uid == null) return null;
  final row = await supabase.from('suppliers').select('*').eq('owner_id', uid).order('created_at', ascending: false).limit(1).maybeSingle();
  return row == null ? null : Map<String, dynamic>.from(row);
}

Future<List<Map<String, dynamic>>> _categories() async {
  final rows = await supabase.from('categories').select('id,name,slug').order('sort_order', ascending: true);
  return List<Map<String, dynamic>>.from(rows);
}

Future<List<String>> _uploadProductImages(List<XFile> files, String userId) async {
  final urls = <String>[];
  for (final f in files.take(6)) {
    try {
      final ext = f.name.split('.').last.toLowerCase();
      final path = '$userId/${DateTime.now().millisecondsSinceEpoch}-${f.name}';
      final bytes = await File(f.path).readAsBytes();
      await supabase.storage.from('product-images').uploadBinary(
        path, bytes,
        fileOptions: FileOptions(upsert: false, contentType: 'image/$ext'),
      );
      urls.add(supabase.storage.from('product-images').getPublicUrl(path));
    } catch (_) {}
  }
  return urls;
}

void _toast(BuildContext ctx, String msg, {bool err = false}) {
  ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: err ? AppColors.danger : null,
  ));
}

Future<bool> _confirm(BuildContext ctx, String title, String body) async {
  final ok = await showDialog<bool>(
    context: ctx,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
      ],
    ),
  );
  return ok == true;
}

// ==========================================================================
// Products list — with bulk select, category assign, hide/show, delete
// ==========================================================================

class _ProductsView extends StatefulWidget {
  const _ProductsView();
  @override
  State<_ProductsView> createState() => _ProductsViewState();
}

class _ProductsViewState extends State<_ProductsView> {
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _cats = [];
  bool _loading = true;
  bool _selectMode = false;
  final Set<String> _selected = {};
  bool _working = false;
  Map<String, dynamic>? _supplier;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    _supplier = await _mySupplier();
    if (_supplier == null) { setState(() { _loading = false; _items = []; }); return; }
    final rows = await supabase.from('products')
        .select('id,title,price,image,moq,active,sold,rating,category_slug')
        .eq('supplier_id', _supplier!['id'])
        .order('created_at', ascending: false);
    _cats = await _categories();
    if (!mounted) return;
    setState(() { _items = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  void _toggle(String id) => setState(() => _selected.contains(id) ? _selected.remove(id) : _selected.add(id));
  void _toggleAll() => setState(() {
    if (_selected.length == _items.length) { _selected.clear(); } else { _selected..clear()..addAll(_items.map((p) => p['id'] as String)); }
  });
  void _exit() => setState(() { _selectMode = false; _selected.clear(); });

  Future<void> _bulkCategory() async {
    final slug = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(LucideIcons.tag, size: 16, color: AppColors.primary)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Assign category', style: TextStyle(fontWeight: FontWeight.w900)),
              Text('${_selected.length} product${_selected.length > 1 ? 's' : ''} selected', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            ])),
          ]),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: _cats.map((c) => OutlinedButton(
            onPressed: () => Navigator.pop(context, (c['slug'] ?? c['id']).toString()),
            child: Text(c['name'] ?? '', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          )).toList()),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: () => Navigator.pop(context), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), child: const Text('Cancel')),
        ]),
      ),
    );
    if (slug == null) return;
    setState(() => _working = true);
    try {
      await supabase.from('products').update({'category_slug': slug}).inFilter('id', _selected.toList());
      if (mounted) _toast(context, 'Updated ${_selected.length}');
      _exit();
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _working = false); }
  }

  Future<void> _bulkActive(bool active) async {
    setState(() => _working = true);
    try {
      await supabase.from('products').update({'active': active}).inFilter('id', _selected.toList());
      if (mounted) _toast(context, '${active ? 'Activated' : 'Hidden'} ${_selected.length}');
      _exit();
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _working = false); }
  }

  Future<void> _bulkDelete() async {
    if (!await _confirm(context, 'Delete ${_selected.length} products?', "This can't be undone.")) return;
    setState(() => _working = true);
    try {
      await supabase.from('products').delete().inFilter('id', _selected.toList());
      if (mounted) _toast(context, 'Deleted ${_selected.length}');
      _exit();
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _working = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    final all = _items.length > 0 && _selected.length == _items.length;
    return Stack(children: [
      RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
          children: [
            if (!_selectMode) Row(children: [
              Expanded(child: FilledButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'products/new'))).then((_) => _load()),
                icon: const Icon(LucideIcons.plus, size: 16),
                label: const Text('Add product'),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
              )),
              if (_items.isNotEmpty) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: () => setState(() => _selectMode = true),
                  icon: const Icon(LucideIcons.checkSquare, size: 16),
                  label: const Text('Select'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
                ),
              ],
            ]) else Container(
              height: 44, padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.05), border: Border.all(color: AppColors.primary.withOpacity(0.3)), borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                InkWell(onTap: _toggleAll, child: Row(children: [
                  Icon(all ? LucideIcons.checkSquare : LucideIcons.square, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(_selected.isEmpty ? 'Select all' : '${_selected.length} selected',
                      style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary)),
                ])),
                const Spacer(),
                TextButton(onPressed: _exit, child: const Text('Cancel')),
              ]),
            ),
            const SizedBox(height: 12),
            if (_items.isEmpty) const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(child: Text('No products yet — add your first product.')),
            ),
            ..._items.map((p) => _ProductRow(
              product: p,
              selected: _selected.contains(p['id']),
              selectMode: _selectMode,
              onTap: _selectMode ? () => _toggle(p['id']) : null,
              onReload: _load,
            )),
          ],
        ),
      ),
      if (_selectMode && _selected.isNotEmpty) Positioned(
        left: 12, right: 12, bottom: 12,
        child: Material(
          elevation: 12, borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: _working ? null : _bulkCategory, icon: const Icon(LucideIcons.tag, size: 14), label: const Text('Category', style: TextStyle(fontSize: 11)))),
              const SizedBox(width: 6),
              Expanded(child: OutlinedButton.icon(onPressed: _working ? null : () => _bulkActive(false), icon: const Icon(LucideIcons.eyeOff, size: 14), label: const Text('Hide', style: TextStyle(fontSize: 11)))),
              const SizedBox(width: 6),
              Expanded(child: OutlinedButton.icon(onPressed: _working ? null : () => _bulkActive(true), icon: const Icon(LucideIcons.eye, size: 14), label: const Text('Show', style: TextStyle(fontSize: 11)))),
              const SizedBox(width: 6),
              IconButton(onPressed: _working ? null : _bulkDelete, icon: const Icon(LucideIcons.trash2, color: AppColors.danger, size: 18)),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class _ProductRow extends StatelessWidget {
  final Map<String, dynamic> product;
  final bool selected;
  final bool selectMode;
  final VoidCallback? onTap;
  final VoidCallback onReload;
  const _ProductRow({required this.product, required this.selected, required this.selectMode, required this.onTap, required this.onReload});
  @override
  Widget build(BuildContext context) {
    final id = product['id'] as String;
    final img = product['image'] as String?;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 2 : 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        onTap: onTap ?? () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductDetailScreen(productId: id))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (selectMode) Padding(
            padding: const EdgeInsets.only(right: 10, top: 26),
            child: Container(
              width: 24, height: 24,
              decoration: BoxDecoration(color: selected ? AppColors.primary : Colors.transparent, border: Border.all(color: selected ? AppColors.primary : AppColors.muted), borderRadius: BorderRadius.circular(6)),
              child: selected ? const Icon(Icons.check, color: Colors.white, size: 16) : null,
            ),
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: img != null
                ? Image.network(img, width: 72, height: 72, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 72, height: 72, color: AppColors.mutedSurface))
                : Container(width: 72, height: 72, color: AppColors.mutedSurface),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(product['title'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            const SizedBox(height: 2),
            Text('\$${product['price']} · MOQ ${product['moq'] ?? 1}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(LucideIcons.shoppingBag, size: 11, color: AppColors.muted),
              const SizedBox(width: 3),
              Text('${product['sold'] ?? 0}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
              const SizedBox(width: 10),
              const Icon(LucideIcons.star, size: 11, color: AppColors.muted),
              const SizedBox(width: 3),
              Text('${(product['rating'] ?? 0).toStringAsFixed(1)}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
            ]),
            if (!selectMode) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => StoreSectionScreen(section: 'product-edit/$id'),
                )).then((_) => onReload()),
                icon: const Icon(LucideIcons.pencil, size: 12),
                label: const Text('Edit', style: TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12), minimumSize: const Size(0, 32)),
              ),
            ),
          ])),
          if (product['active'] == false) Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(6)),
            child: const Text('Hidden', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700)),
          ),
        ]),
      ),
    );
  }
}

// ==========================================================================
// New / Edit product — shared form
// ==========================================================================

class _ProductForm {
  final title = TextEditingController();
  final description = TextEditingController();
  final price = TextEditingController();
  final originalPrice = TextEditingController();
  final moq = TextEditingController(text: '1');
  final unit = TextEditingController(text: 'piece');
  final leadTime = TextEditingController(text: '7-15 days');
  final shipFrom = TextEditingController();
  String categorySlug = 'electronics';
  bool freeShipping = false;
  bool active = true;
  void dispose() {
    for (final c in [title, description, price, originalPrice, moq, unit, leadTime, shipFrom]) { c.dispose(); }
  }
}

class _NewProductView extends StatefulWidget {
  const _NewProductView();
  @override
  State<_NewProductView> createState() => _NewProductViewState();
}

class _NewProductViewState extends State<_NewProductView> {
  final _f = _ProductForm();
  final List<XFile> _files = [];
  List<Map<String, dynamic>> _cats = [];
  bool _saving = false;

  @override
  void initState() { super.initState(); _categories().then((c) => setState(() => _cats = c)); }
  @override
  void dispose() { _f.dispose(); super.dispose(); }

  Future<void> _pick() async {
    try {
      final picked = await ImagePicker().pickMultiImage(imageQuality: 88);
      if (picked.isEmpty) return;
      setState(() => _files.addAll(picked.take(6 - _files.length)));
    } catch (_) {}
  }

  Future<void> _submit() async {
    if (_f.title.text.trim().isEmpty || _f.price.text.trim().isEmpty) {
      _toast(context, 'Title and price required', err: true); return;
    }
    setState(() => _saving = true);
    try {
      final uid = supabase.auth.currentUser?.id;
      if (uid == null) { Navigator.of(context).pushNamed('/auth'); return; }
      final sup = await _mySupplier();
      if (sup == null) { _toast(context, 'Create your store first', err: true); return; }
      final urls = await _uploadProductImages(_files, uid);
      final row = await supabase.from('products').insert({
        'supplier_id': sup['id'],
        'title': _f.title.text.trim(),
        'description': _f.description.text.trim().isEmpty ? null : _f.description.text.trim(),
        'image': urls.isNotEmpty ? urls.first : null,
        'gallery': urls,
        'price': double.tryParse(_f.price.text) ?? 0,
        'original_price': _f.originalPrice.text.trim().isEmpty ? null : double.tryParse(_f.originalPrice.text),
        'moq': int.tryParse(_f.moq.text) ?? 1,
        'unit': _f.unit.text.trim().isEmpty ? 'piece' : _f.unit.text.trim(),
        'lead_time': _f.leadTime.text.trim().isEmpty ? null : _f.leadTime.text.trim(),
        'ship_from': _f.shipFrom.text.trim().isEmpty ? sup['country'] : _f.shipFrom.text.trim(),
        'category_slug': _f.categorySlug,
        'free_shipping': _f.freeShipping,
        'active': true,
      }).select().single();
      if (!mounted) return;
      _toast(context, 'Product published 🎉');
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ProductDetailScreen(productId: row['id'])));
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }

  @override
  Widget build(BuildContext context) {
    return _ProductFormBody(
      form: _f,
      cats: _cats,
      files: _files,
      onPick: _pick,
      onRemove: (i) => setState(() => _files.removeAt(i)),
      onSubmit: _saving ? null : _submit,
      submitLabel: _saving ? 'Publishing…' : 'Publish product',
      existingUrls: const [],
      onRemoveExisting: null,
    );
  }
}

class _EditProductView extends StatefulWidget {
  final String productId;
  const _EditProductView({required this.productId});
  @override
  State<_EditProductView> createState() => _EditProductViewState();
}

class _EditProductViewState extends State<_EditProductView> {
  final _f = _ProductForm();
  final List<XFile> _files = [];
  final List<String> _gallery = [];
  List<Map<String, dynamic>> _cats = [];
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _f.dispose(); super.dispose(); }

  Future<void> _load() async {
    _cats = await _categories();
    final p = await supabase.from('products').select('*').eq('id', widget.productId).maybeSingle();
    if (p != null) {
      _f.title.text = p['title'] ?? '';
      _f.description.text = p['description'] ?? '';
      _f.price.text = '${p['price'] ?? ''}';
      _f.originalPrice.text = p['original_price'] == null ? '' : '${p['original_price']}';
      _f.moq.text = '${p['moq'] ?? 1}';
      _f.unit.text = p['unit'] ?? 'piece';
      _f.leadTime.text = p['lead_time'] ?? '';
      _f.shipFrom.text = p['ship_from'] ?? '';
      _f.categorySlug = p['category_slug'] ?? 'electronics';
      _f.freeShipping = p['free_shipping'] == true;
      _f.active = p['active'] != false;
      final g = (p['gallery'] as List?)?.cast<String>() ?? const <String>[];
      _gallery.addAll(g.where((s) => s.isNotEmpty));
      if (_gallery.isEmpty && p['image'] != null) _gallery.add(p['image']);
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _pick() async {
    try {
      final picked = await ImagePicker().pickMultiImage(imageQuality: 88);
      if (picked.isEmpty) return;
      setState(() => _files.addAll(picked.take(8 - _files.length - _gallery.length)));
    } catch (_) {}
  }

  Future<void> _submit() async {
    if (_f.title.text.trim().isEmpty || _f.price.text.trim().isEmpty) {
      _toast(context, 'Title and price required', err: true); return;
    }
    setState(() => _saving = true);
    try {
      final uid = supabase.auth.currentUser!.id;
      final uploaded = await _uploadProductImages(_files, uid);
      final finalGallery = [..._gallery, ...uploaded];
      await supabase.from('products').update({
        'title': _f.title.text.trim(),
        'description': _f.description.text.trim().isEmpty ? null : _f.description.text.trim(),
        'image': finalGallery.isNotEmpty ? finalGallery.first : null,
        'gallery': finalGallery,
        'price': double.tryParse(_f.price.text) ?? 0,
        'original_price': _f.originalPrice.text.trim().isEmpty ? null : double.tryParse(_f.originalPrice.text),
        'moq': int.tryParse(_f.moq.text) ?? 1,
        'unit': _f.unit.text.trim().isEmpty ? 'piece' : _f.unit.text.trim(),
        'lead_time': _f.leadTime.text.trim().isEmpty ? null : _f.leadTime.text.trim(),
        'ship_from': _f.shipFrom.text.trim().isEmpty ? null : _f.shipFrom.text.trim(),
        'category_slug': _f.categorySlug,
        'free_shipping': _f.freeShipping,
        'active': _f.active,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', widget.productId);
      if (!mounted) return;
      _toast(context, 'Product updated');
      Navigator.of(context).pop();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }

  Future<void> _delete() async {
    if (!await _confirm(context, 'Delete product?', "This can't be undone.")) return;
    await supabase.from('products').delete().eq('id', widget.productId);
    if (mounted) { _toast(context, 'Deleted'); Navigator.of(context).pop(); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 5);
    return _ProductFormBody(
      form: _f,
      cats: _cats,
      files: _files,
      existingUrls: _gallery,
      onRemoveExisting: (i) => setState(() => _gallery.removeAt(i)),
      onPick: _pick,
      onRemove: (i) => setState(() => _files.removeAt(i)),
      onSubmit: _saving ? null : _submit,
      submitLabel: _saving ? 'Saving…' : 'Save changes',
      onDelete: _delete,
      showActive: true,
    );
  }
}

class _ProductFormBody extends StatelessWidget {
  final _ProductForm form;
  final List<Map<String, dynamic>> cats;
  final List<XFile> files;
  final List<String> existingUrls;
  final void Function(int)? onRemoveExisting;
  final VoidCallback onPick;
  final void Function(int) onRemove;
  final VoidCallback? onSubmit;
  final String submitLabel;
  final VoidCallback? onDelete;
  final bool showActive;
  const _ProductFormBody({
    required this.form, required this.cats, required this.files,
    required this.onPick, required this.onRemove, required this.onSubmit,
    required this.submitLabel,
    this.existingUrls = const [], this.onRemoveExisting, this.onDelete,
    this.showActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return StatefulBuilder(builder: (context, setLocal) => ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('PHOTOS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3, mainAxisSpacing: 8, crossAxisSpacing: 8,
          shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          children: [
            ...existingUrls.asMap().entries.map((e) => _photoTile(existing: e.value, onRemove: onRemoveExisting == null ? null : () => onRemoveExisting!(e.key))),
            ...files.asMap().entries.map((e) => _photoTile(file: e.value, ring: true, onRemove: () => onRemove(e.key))),
            if (existingUrls.length + files.length < 8) InkWell(
              onTap: onPick,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border, style: BorderStyle.solid, width: 2),
                  borderRadius: BorderRadius.circular(12),
                  color: AppColors.mutedSurface.withOpacity(0.5),
                ),
                child: const Icon(LucideIcons.plus, color: AppColors.muted),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(controller: form.title, decoration: const InputDecoration(labelText: 'Product title *')),
        const SizedBox(height: 12),
        TextField(controller: form.description, maxLines: 4, decoration: const InputDecoration(labelText: 'Description')),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: TextField(controller: form.price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price *'))),
          const SizedBox(width: 8),
          Expanded(child: TextField(controller: form.originalPrice, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Original price'))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: TextField(controller: form.moq, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'MOQ'))),
          const SizedBox(width: 8),
          Expanded(child: TextField(controller: form.unit, decoration: const InputDecoration(labelText: 'Unit'))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: TextField(controller: form.leadTime, decoration: const InputDecoration(labelText: 'Lead time'))),
          const SizedBox(width: 8),
          Expanded(child: TextField(controller: form.shipFrom, decoration: const InputDecoration(labelText: 'Ships from'))),
        ]),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: cats.any((c) => (c['slug'] ?? c['id']) == form.categorySlug) ? form.categorySlug : (cats.isNotEmpty ? (cats.first['slug'] ?? cats.first['id']).toString() : form.categorySlug),
          decoration: const InputDecoration(labelText: 'Category'),
          items: [
            for (final c in cats) DropdownMenuItem(value: (c['slug'] ?? c['id']).toString(), child: Text(c['name'] ?? '')),
          ],
          onChanged: (v) => setLocal(() => form.categorySlug = v ?? form.categorySlug),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Free shipping'),
          value: form.freeShipping,
          onChanged: (v) => setLocal(() => form.freeShipping = v),
        ),
        if (showActive) SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Listed (visible to buyers)'),
          value: form.active,
          onChanged: (v) => setLocal(() => form.active = v),
        ),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: FilledButton(
            onPressed: onSubmit,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: Text(submitLabel),
          )),
          if (onDelete != null) ...[
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: onDelete,
              style: OutlinedButton.styleFrom(minimumSize: const Size(56, 48), foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger)),
              child: const Icon(LucideIcons.trash2, size: 18),
            ),
          ],
        ]),
      ],
    ));
  }

  Widget _photoTile({String? existing, XFile? file, bool ring = false, VoidCallback? onRemove}) {
    return Stack(children: [
      Container(
        decoration: BoxDecoration(
          color: AppColors.mutedSurface,
          borderRadius: BorderRadius.circular(12),
          border: ring ? Border.all(color: AppColors.primary, width: 2) : null,
        ),
        clipBehavior: Clip.antiAlias,
        child: existing != null
            ? Image.network(existing, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())
            : Image.file(File(file!.path), fit: BoxFit.cover),
      ),
      if (onRemove != null) Positioned(
        top: 4, right: 4,
        child: InkWell(
          onTap: onRemove,
          child: Container(
            width: 22, height: 22,
            decoration: BoxDecoration(color: AppColors.foreground.withOpacity(0.7), shape: BoxShape.circle),
            child: const Icon(Icons.close, color: Colors.white, size: 14),
          ),
        ),
      ),
    ]);
  }
}

// ==========================================================================
// Orders — full status flow with notification insert
// ==========================================================================

const _kStatuses = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];
Color _statusColor(String s) => switch (s) {
  'placed' => Colors.amber,
  'processing' => Colors.blue,
  'shipped' => Colors.deepPurple,
  'delivered' => Colors.green,
  'cancelled' => AppColors.danger,
  _ => AppColors.muted,
};

class _OrdersView extends StatefulWidget {
  const _OrdersView();
  @override
  State<_OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends State<_OrdersView> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final sup = await _mySupplier();
    if (sup == null) { setState(() { _loading = false; _orders = []; }); return; }
    final rows = await supabase.from('orders')
        .select('*, order_items(*)')
        .eq('supplier_id', sup['id'])
        .order('created_at', ascending: false);
    if (mounted) setState(() { _orders = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _updateStatus(Map<String, dynamic> o, String status) async {
    try {
      await supabase.from('orders').update({'status': status, 'updated_at': DateTime.now().toIso8601String()}).eq('id', o['id']);
      await supabase.from('notifications').insert({
        'user_id': o['buyer_id'],
        'title': 'Order update',
        'body': 'Your order is now $status',
        'type': 'order',
        'link': '/orders',
      });
      if (mounted) _toast(context, 'Order marked $status');
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    if (_orders.isEmpty) return const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No orders yet.')));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final o = _orders[i];
          final idx = _kStatuses.indexOf(o['status'] ?? '');
          final next = idx >= 0 && idx < 3 ? _kStatuses[idx + 1] : null;
          final items = (o['order_items'] as List?) ?? const [];
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${o['ref_code'] ?? o['id'].toString().substring(0, 8)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12), overflow: TextOverflow.ellipsis)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: _statusColor(o['status']).withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
                  child: Text('${o['status']}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: _statusColor(o['status']))),
                ),
              ]),
              const SizedBox(height: 6),
              Text('${items.length} items · \$${(o['total'] as num?)?.toStringAsFixed(2) ?? '0.00'}', style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(DateFormat('MMM d, y · h:mm a').format(DateTime.parse(o['created_at'])), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              if ((o['ship_to'] ?? '').toString().isNotEmpty) Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Ship to: ${o['ship_to']}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              ),
              const SizedBox(height: 10),
              Row(children: [
                if (next != null) Expanded(child: FilledButton(
                  onPressed: () => _updateStatus(o, next),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                  child: Text('Mark $next'),
                )),
                if (o['status'] != 'cancelled' && o['status'] != 'delivered') ...[
                  if (next != null) const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _updateStatus(o, 'cancelled'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36)),
                    child: const Text('Cancel'),
                  ),
                ],
              ]),
            ]),
          );
        },
      ),
    );
  }
}

// ==========================================================================
// Analytics — 8 cards
// ==========================================================================

class _AnalyticsView extends StatefulWidget {
  const _AnalyticsView();
  @override
  State<_AnalyticsView> createState() => _AnalyticsViewState();
}

class _AnalyticsViewState extends State<_AnalyticsView> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final sup = await _mySupplier();
    if (sup == null) { setState(() => _loading = false); return; }
    final orders = await supabase.from('orders').select('total,status,created_at').eq('supplier_id', sup['id']);
    final products = await supabase.from('products').select('id,sold').eq('supplier_id', sup['id']);
    final followers = await supabase.from('followers').select('id').eq('supplier_id', sup['id']);
    final ordersList = List<Map<String, dynamic>>.from(orders);
    final productsList = List<Map<String, dynamic>>.from(products);
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    double revenue = 0; double last7 = 0; int completed = 0; int cancelled = 0;
    for (final o in ordersList) {
      final t = (o['total'] as num?)?.toDouble() ?? 0;
      revenue += t;
      if (DateTime.parse(o['created_at']).isAfter(cutoff)) last7 += t;
      if (o['status'] == 'delivered') completed++;
      if (o['status'] == 'cancelled') cancelled++;
    }
    final totalSold = productsList.fold<int>(0, (s, p) => s + ((p['sold'] as num?)?.toInt() ?? 0));
    if (!mounted) return;
    setState(() {
      _data = {
        'revenue': revenue, 'last7': last7, 'orderCount': ordersList.length,
        'completed': completed, 'cancelled': cancelled, 'totalSold': totalSold,
        'productCount': productsList.length, 'followers': (followers as List).length,
      };
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    if (_data == null) return const Center(child: Text('Create a store first.'));
    final d = _data!;
    final cards = [
      ('Total revenue', '\$${(d['revenue'] as double).toStringAsFixed(2)}', LucideIcons.dollarSign),
      ('Last 7 days', '\$${(d['last7'] as double).toStringAsFixed(2)}', LucideIcons.trendingUp),
      ('Orders', '${d['orderCount']}', LucideIcons.shoppingBag),
      ('Delivered', '${d['completed']}', LucideIcons.package),
      ('Cancelled', '${d['cancelled']}', LucideIcons.x),
      ('Units sold', '${d['totalSold']}', LucideIcons.trendingUp),
      ('Products', '${d['productCount']}', LucideIcons.package),
      ('Followers', '${d['followers']}', LucideIcons.eye),
    ];
    return GridView.count(
      padding: const EdgeInsets.all(12),
      crossAxisCount: 2, childAspectRatio: 1.5,
      crossAxisSpacing: 10, mainAxisSpacing: 10,
      children: cards.map((c) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 30, height: 30, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(c.$3, color: AppColors.primary, size: 15)),
            const SizedBox(width: 8),
            Expanded(child: Text(c.$1.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted))),
          ]),
          const Spacer(),
          Text(c.$2, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      )).toList(),
    );
  }
}

// ==========================================================================
// Promote — coupon CRUD
// ==========================================================================

class _PromoteView extends StatefulWidget {
  const _PromoteView();
  @override
  State<_PromoteView> createState() => _PromoteViewState();
}

class _PromoteViewState extends State<_PromoteView> {
  List<Map<String, dynamic>> _coupons = [];
  bool _loading = true;
  Map<String, dynamic>? _supplier;
  bool _showForm = false;

  final _code = TextEditingController();
  final _value = TextEditingController();
  final _minSubtotal = TextEditingController(text: '0');
  final _maxUses = TextEditingController();
  DateTime? _expiresAt;
  String _type = 'percent';
  bool _saving = false;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _code.dispose(); _value.dispose(); _minSubtotal.dispose(); _maxUses.dispose(); super.dispose(); }

  Future<void> _load() async {
    _supplier = await _mySupplier();
    if (_supplier == null) { setState(() => _loading = false); return; }
    final rows = await supabase.from('coupons').select('*').eq('supplier_id', _supplier!['id']).order('created_at', ascending: false);
    if (mounted) setState(() { _coupons = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _create() async {
    if (_supplier == null) return;
    final code = _code.text.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9_-]{3,30}$').hasMatch(code)) { _toast(context, 'Code must be 3-30 chars (A-Z, 0-9, _, -)', err: true); return; }
    final value = double.tryParse(_value.text);
    if (value == null || value <= 0) { _toast(context, 'Enter a valid discount value', err: true); return; }
    if (_type == 'percent' && value > 100) { _toast(context, 'Percent must be ≤100', err: true); return; }
    setState(() => _saving = true);
    try {
      await supabase.from('coupons').insert({
        'supplier_id': _supplier!['id'],
        'code': code,
        'discount_type': _type,
        'discount_value': value,
        'min_subtotal': double.tryParse(_minSubtotal.text) ?? 0,
        'max_uses': _maxUses.text.trim().isEmpty ? null : int.tryParse(_maxUses.text),
        'expires_at': _expiresAt?.toIso8601String(),
        'active': true,
      });
      if (mounted) _toast(context, 'Coupon $code created');
      _code.clear(); _value.clear(); _minSubtotal.text = '0'; _maxUses.clear(); _expiresAt = null; _type = 'percent';
      setState(() => _showForm = false);
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }

  Future<void> _toggle(Map<String, dynamic> c) async {
    try {
      await supabase.from('coupons').update({'active': !(c['active'] ?? true)}).eq('id', c['id']);
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    if (!await _confirm(context, 'Delete coupon ${c['code']}?', 'This cannot be undone.')) return;
    try {
      await supabase.from('coupons').delete().eq('id', c['id']);
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        FilledButton.icon(
          onPressed: () => setState(() => _showForm = !_showForm),
          icon: Icon(_showForm ? LucideIcons.x : LucideIcons.plus, size: 16),
          label: Text(_showForm ? 'Cancel' : 'New coupon'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
        ),
        if (_showForm) Container(
          margin: const EdgeInsets.only(top: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
          child: Column(children: [
            TextField(
              controller: _code,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9_-]')), LengthLimitingTextInputFormatter(30)],
              decoration: const InputDecoration(labelText: 'Code (e.g. WELCOME10)'),
              style: const TextStyle(letterSpacing: 1.5, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: DropdownButtonFormField<String>(
                value: _type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: 'percent', child: Text('Percent off')),
                  DropdownMenuItem(value: 'fixed', child: Text('Fixed amount')),
                ],
                onChanged: (v) => setState(() => _type = v ?? 'percent'),
              )),
              const SizedBox(width: 8),
              Expanded(child: TextField(
                controller: _value,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: _type == 'percent' ? '% off' : '\$ off'),
              )),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: _minSubtotal, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Min subtotal (\$)'))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: _maxUses, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max uses (opt.)'))),
            ]),
            const SizedBox(height: 10),
            InkWell(
              onTap: () async {
                final d = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: DateTime.now().add(const Duration(days: 30)));
                if (d != null) setState(() => _expiresAt = d);
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Expires', suffixIcon: Icon(LucideIcons.calendar, size: 16)),
                child: Text(_expiresAt == null ? 'Never' : DateFormat.yMMMd().format(_expiresAt!)),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _saving ? null : _create,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
              child: Text(_saving ? 'Creating…' : 'Create coupon'),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        if (_coupons.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No coupons yet — create your first.')))
        else ..._coupons.map((c) {
          final expired = c['expires_at'] != null && DateTime.parse(c['expires_at']).isBefore(DateTime.now());
          final maxUses = c['max_uses'];
          final exhausted = maxUses != null && (c['uses_count'] ?? 0) >= maxUses;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 38, height: 38, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(LucideIcons.dollarSign, color: AppColors.primary, size: 18)),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c['code']}', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                  const SizedBox(height: 2),
                  Text(
                    '${c['discount_type'] == 'percent' ? '${c['discount_value']}% off' : '\$${c['discount_value']} off'}'
                    '${(c['min_subtotal'] as num?) != null && (c['min_subtotal'] as num) > 0 ? ' · min \$${c['min_subtotal']}' : ''}',
                    style: const TextStyle(fontSize: 11, color: AppColors.muted),
                  ),
                  Text(
                    'Used ${c['uses_count'] ?? 0}${maxUses != null ? '/$maxUses' : ''}'
                    '${c['expires_at'] != null ? ' · expires ${DateFormat.yMd().format(DateTime.parse(c['expires_at']))}' : ''}',
                    style: const TextStyle(fontSize: 10, color: AppColors.muted),
                  ),
                  if (expired || exhausted || c['active'] == false) Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(expired ? 'Expired' : exhausted ? 'Exhausted' : 'Inactive',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.danger)),
                  ),
                ])),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => _toggle(c), child: Text(c['active'] == true ? 'Pause' : 'Activate'))),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => _delete(c),
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger)),
                  child: const Icon(LucideIcons.x, size: 16),
                ),
              ]),
            ]),
          );
        }),
      ],
    );
  }
}

// ==========================================================================
// Reviews
// ==========================================================================

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
    final sup = await _mySupplier();
    if (sup == null) { setState(() => _loading = false); return; }
    final prods = await supabase.from('products').select('id,title,image').eq('supplier_id', sup['id']);
    final list = List<Map<String, dynamic>>.from(prods);
    final ids = list.map((p) => p['id'].toString()).toList();
    if (ids.isEmpty) { setState(() { _rows = []; _loading = false; }); return; }
    final rs = await supabase.from('reviews').select('*').inFilter('product_id', ids).order('created_at', ascending: false).limit(100);
    final map = { for (final p in list) p['id']: p };
    if (!mounted) return;
    setState(() {
      _rows = List<Map<String, dynamic>>.from(rs).map((r) => {...r, 'product': map[r['product_id']]}).toList();
      _loading = false;
    });
  }
  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 4);
    if (_rows.isEmpty) return const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No reviews yet.')));
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: _rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final r = _rows[i]; final p = r['product'] as Map<String, dynamic>?;
        final rating = (r['rating'] as num?)?.toInt() ?? 0;
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (p != null && p['image'] != null) ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(p['image'], width: 36, height: 36, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 36, height: 36, color: AppColors.mutedSurface)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p?['title'] ?? '', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                Row(children: List.generate(5, (idx) => Icon(LucideIcons.star, size: 12, color: idx < rating ? Colors.amber : AppColors.muted))),
              ])),
              Text(DateFormat.yMd().format(DateTime.parse(r['created_at'])), style: const TextStyle(fontSize: 10, color: AppColors.muted)),
            ]),
            if ((r['text'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(r['text'])),
          ]),
        );
      },
    );
  }
}

// ==========================================================================
// Shipping — courier partnerships list, discovery, invite, set default
// ==========================================================================

class _ShippingView extends StatefulWidget {
  const _ShippingView();
  @override
  State<_ShippingView> createState() => _ShippingViewState();
}

class _ShippingViewState extends State<_ShippingView> {
  Map<String, dynamic>? _supplier;
  Map<String, dynamic>? _myCourier;
  List<Map<String, dynamic>> _partnerships = [];
  List<Map<String, dynamic>> _discover = [];
  bool _loading = true;
  final _search = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _search.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    _supplier = await _mySupplier();
    final uid = supabase.auth.currentUser?.id;
    if (uid == null || _supplier == null) { setState(() => _loading = false); return; }

    _myCourier = await supabase.from('courier_profiles').select('*').eq('user_id', uid).maybeSingle().then((v) => v == null ? null : Map<String, dynamic>.from(v));

    final parts = await supabase.from('supplier_courier_partnerships').select('*').eq('supplier_id', _supplier!['id']).order('is_default', ascending: false).order('created_at', ascending: false);
    final rows = List<Map<String, dynamic>>.from(parts);
    final courierIds = rows.map((r) => r['courier_user_id']).whereType<String>().toList();
    Map<String, Map<String, dynamic>> profileMap = {};
    if (courierIds.isNotEmpty) {
      final profiles = await supabase.from('courier_profiles').select('*').inFilter('user_id', courierIds);
      for (final p in profiles) { profileMap[p['user_id']] = Map<String, dynamic>.from(p); }
    }
    _partnerships = rows.map((r) => {...r, 'courier': profileMap[r['courier_user_id']]}).toList();

    var q = supabase.from('courier_profiles').select('*').eq('active', true).eq('offers_supplier_partnerships', true);
    if (_search.text.trim().isNotEmpty) {
      final s = _search.text.trim();
      q = q.or('company_name.ilike.%$s%,display_name.ilike.%$s%,city.ilike.%$s%');
    }
    final disc = await q.order('rating', ascending: false).limit(20);
    final taken = _partnerships.map((p) => p['courier_user_id']).toSet();
    _discover = List<Map<String, dynamic>>.from(disc).where((c) => !taken.contains(c['user_id']) && c['user_id'] != uid).toList();

    if (mounted) setState(() => _loading = false);
  }

  Future<void> _invite(String courierUserId) async {
    if (_supplier == null) return;
    try {
      await supabase.from('supplier_courier_partnerships').insert({
        'supplier_id': _supplier!['id'],
        'courier_user_id': courierUserId,
        'initiated_by': 'supplier',
        'message': "We'd like to partner with you for our deliveries.",
      });
      if (mounted) _toast(context, 'Partnership request sent');
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  Future<void> _setDefault(String id) async {
    if (_supplier == null) return;
    try {
      await supabase.from('supplier_courier_partnerships').update({'is_default': false}).eq('supplier_id', _supplier!['id']).eq('is_default', true);
      await supabase.from('supplier_courier_partnerships').update({'is_default': true}).eq('id', id);
      if (mounted) _toast(context, 'Default shipping updated');
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  Future<void> _respond(String id, String status) async {
    try {
      await supabase.from('supplier_courier_partnerships').update({'status': status}).eq('id', id);
      if (mounted) _toast(context, status == 'active' ? 'Partnership accepted' : 'Declined');
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  Future<void> _remove(String id) async {
    if (!await _confirm(context, 'Remove partnership?', 'The courier will no longer be available for your buyers.')) return;
    try {
      await supabase.from('supplier_courier_partnerships').delete().eq('id', id);
      await _load();
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  String _summarize(Map<String, dynamic> c) {
    final parts = <String>[];
    if (c['base_fee'] != null) parts.add('\$${(c['base_fee'] as num).toStringAsFixed(2)} base');
    if (c['per_km_fee'] != null) parts.add('\$${(c['per_km_fee'] as num).toStringAsFixed(2)}/km');
    if (c['free_delivery_above'] != null) parts.add('free over \$${c['free_delivery_above']}');
    return parts.isEmpty ? 'Custom quote' : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 5);
    if (_supplier == null) return const Center(child: Text('Create your store first.'));
    final hasDefault = _partnerships.any((p) => p['is_default'] == true && p['status'] == 'active');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(12), children: [
        // Self-delivery banner
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.primary.withOpacity(0.1), AppColors.primary.withOpacity(0.02)]),
            border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16),
          ),
          child: Row(children: [
            Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                child: const Icon(LucideIcons.truck, color: Colors.white, size: 20)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Text('Self-delivery', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                if (_myCourier != null && !hasDefault) Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                    child: const Text('DEFAULT', style: TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
              ]),
              Text(
                _myCourier != null
                    ? 'You also provide logistics — buyers see you as the default delivery option.'
                    : "Also offer courier services? Register and we'll set you as default.",
                style: const TextStyle(fontSize: 11, color: AppColors.muted),
              ),
              if (_myCourier != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(_summarize(_myCourier!), style: const TextStyle(fontSize: 10, color: AppColors.muted))),
            ])),
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'services/logistics'))).then((_) => _load()),
              child: Text(_myCourier != null ? 'Edit' : 'Set up'),
            ),
          ]),
        ),
        const SizedBox(height: 20),

        // My partnerships
        Row(children: [
          const Expanded(child: Text('MY COURIER PARTNERSHIPS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted))),
          Text('${_partnerships.length} total', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
        const SizedBox(height: 8),
        if (_partnerships.isEmpty) Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(border: Border.all(color: AppColors.border, style: BorderStyle.solid), borderRadius: BorderRadius.circular(16)),
          child: const Column(children: [
            Icon(LucideIcons.handshake, color: AppColors.muted),
            SizedBox(height: 6),
            Text('No partnerships yet', style: TextStyle(fontWeight: FontWeight.w800)),
            SizedBox(height: 4),
            Text('Invite a courier below — buyers will see the active options at checkout.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ) else ..._partnerships.map((p) {
          final c = p['courier'] as Map<String, dynamic>?;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
                    clipBehavior: Clip.antiAlias,
                    child: c?['vehicle_photo'] != null ? Image.network(c!['vehicle_photo'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()) : null),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(c?['company_name'] ?? c?['display_name'] ?? 'Courier', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13), overflow: TextOverflow.ellipsis)),
                    if (p['is_default'] == true) Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                        child: const Text('DEFAULT', style: TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ]),
                  Text(
                    '${(c?['vehicle_type'] ?? '—').toString().replaceAll('_', ' ')}'
                    '${c?['max_weight_kg'] != null ? ' · up to ${c!['max_weight_kg']}kg' : ''}'
                    '${c?['city'] != null ? ' · ${c!['city']}' : ''}',
                    style: const TextStyle(fontSize: 11, color: AppColors.muted),
                  ),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: (p['status'] == 'active' ? Colors.green : p['status'] == 'declined' ? AppColors.danger : Colors.amber).withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
                      child: Text('${p['status']}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900,
                          color: p['status'] == 'active' ? Colors.green : p['status'] == 'declined' ? AppColors.danger : Colors.amber)),
                    ),
                  ]),
                ])),
              ]),
              if (c != null) Padding(padding: const EdgeInsets.only(top: 6, left: 54), child: Text(_summarize(c), style: const TextStyle(fontSize: 10, color: AppColors.muted))),
              const SizedBox(height: 8),
              Row(children: [
                if (p['status'] == 'pending' && p['initiated_by'] == 'courier') ...[
                  Expanded(child: FilledButton(onPressed: () => _respond(p['id'], 'active'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(34)), child: const Text('Accept'))),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(onPressed: () => _respond(p['id'], 'declined'), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(34)), child: const Text('Decline'))),
                ] else ...[
                  if (p['status'] == 'active' && p['is_default'] != true) Expanded(child: OutlinedButton(onPressed: () => _setDefault(p['id']), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(34)), child: const Text('Set default'))),
                  if (p['status'] == 'active' && p['is_default'] != true) const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _remove(p['id']),
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger), minimumSize: const Size.fromHeight(34)),
                    child: const Icon(LucideIcons.trash2, size: 14),
                  ),
                ],
              ]),
            ]),
          );
        }),

        const SizedBox(height: 20),
        // Discover
        const Text('DISCOVER COURIERS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
        const SizedBox(height: 8),
        TextField(
          controller: _search,
          decoration: const InputDecoration(prefixIcon: Icon(LucideIcons.search, size: 16), hintText: 'Search couriers'),
          onSubmitted: (_) => _load(),
        ),
        const SizedBox(height: 8),
        if (_discover.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('No couriers available.', style: TextStyle(color: AppColors.muted))))
        else ..._discover.map((c) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
                clipBehavior: Clip.antiAlias,
                child: c['vehicle_photo'] != null ? Image.network(c['vehicle_photo'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()) : const Icon(LucideIcons.truck, size: 18, color: AppColors.muted)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c['company_name'] ?? c['display_name'] ?? 'Courier', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
              Text('${c['city'] ?? ''} · ★ ${(c['rating'] ?? 0).toStringAsFixed(1)}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              Text(_summarize(c), style: const TextStyle(fontSize: 10, color: AppColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
            ])),
            FilledButton(onPressed: () => _invite(c['user_id']), child: const Text('Invite')),
          ]),
        )),
      ]),
    );
  }
}

// ==========================================================================
// Profile — banner/logo upload, business details, verticals, manual pay, location
// ==========================================================================

const _verticalsForSupplier = [
  ('shop', 'Marketplace', LucideIcons.shoppingBag),
  ('restaurants', 'Food & dining', LucideIcons.utensilsCrossed),
  ('agro', 'Agro', LucideIcons.sprout),
  ('stays', 'Stays', LucideIcons.bedDouble),
  ('vehicles', 'Vehicles', LucideIcons.car),
  ('car_rentals', 'Car rentals', LucideIcons.car),
  ('properties', 'Real estate', LucideIcons.home),
  ('services', 'Local services', LucideIcons.wrench),
  ('industrial', 'Industrial', LucideIcons.factory),
  ('finance', 'Finance', LucideIcons.banknote),
  ('rides', 'Rides', LucideIcons.navigation),
  ('jobs', 'Jobs', LucideIcons.briefcase),
];

class _ProfileView extends StatefulWidget {
  const _ProfileView();
  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  Map<String, dynamic>? _supplier;
  List<Map<String, dynamic>> _cats = [];
  bool _loading = true; bool _saving = false;
  String? _uploading;

  final _name = TextEditingController();
  final _country = TextEditingController();
  final _about = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _website = TextEditingController();
  final _address = TextEditingController();
  final _payNumber = TextEditingController();
  final _payName = TextEditingController();
  final _payInstructions = TextEditingController();

  String _logo = '';
  String _banner = '';
  double? _lat, _lng;
  String _businessType = '';
  String _tradeType = 'both';
  final Set<String> _categoriesSel = {};
  final Set<String> _verticalsSel = {};
  bool _payEnabled = false;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() {
    for (final c in [_name, _country, _about, _phone, _email, _website, _address, _payNumber, _payName, _payInstructions]) c.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    _cats = await _categories();
    _supplier = await _mySupplier();
    if (_supplier == null) { setState(() => _loading = false); return; }
    final s = _supplier!;
    _name.text = s['name'] ?? '';
    _country.text = s['country'] ?? '';
    _about.text = s['about'] ?? '';
    _phone.text = s['phone'] ?? '';
    _email.text = s['email'] ?? '';
    _website.text = s['website'] ?? '';
    _address.text = s['location_address'] ?? '';
    _logo = s['logo'] ?? '';
    _banner = s['banner'] ?? '';
    _lat = (s['latitude'] as num?)?.toDouble();
    _lng = (s['longitude'] as num?)?.toDouble();
    _businessType = s['business_type'] ?? '';
    _tradeType = s['trade_type'] ?? 'both';
    _categoriesSel.addAll(((s['categories'] as List?) ?? []).cast<String>());
    _verticalsSel.addAll(((s['verticals'] as List?) ?? []).cast<String>());
    _payEnabled = s['manual_payment_enabled'] == true;
    _payNumber.text = s['manual_payment_number'] ?? '';
    _payName.text = s['manual_payment_name'] ?? '';
    _payInstructions.text = s['manual_payment_instructions'] ?? '';
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _uploadImage(String kind) async {
    final picker = ImagePicker();
    final f = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
    if (f == null || _supplier == null) return;
    setState(() => _uploading = kind);
    try {
      final uid = supabase.auth.currentUser!.id;
      final ext = f.name.split('.').last.toLowerCase();
      final path = '$uid/store/$kind-${DateTime.now().millisecondsSinceEpoch}.$ext';
      final bytes = await File(f.path).readAsBytes();
      await supabase.storage.from('product-images').uploadBinary(path, bytes, fileOptions: FileOptions(upsert: true, contentType: 'image/$ext'));
      final url = supabase.storage.from('product-images').getPublicUrl(path);
      await supabase.from('suppliers').update(kind == 'logo' ? {'logo': url} : {'banner': url}).eq('id', _supplier!['id']);
      if (mounted) setState(() { if (kind == 'logo') _logo = url; else _banner = url; });
      if (mounted) _toast(context, '${kind == 'logo' ? 'Logo' : 'Banner'} updated');
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _uploading = null); }
  }

  Future<void> _pinCurrent() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) await Geolocator.requestPermission();
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() { _lat = pos.latitude; _lng = pos.longitude; });
      if (_supplier != null) {
        await supabase.from('suppliers').update({
          'latitude': pos.latitude, 'longitude': pos.longitude, 'location_address': _address.text.trim(),
        }).eq('id', _supplier!['id']);
        if (mounted) _toast(context, 'Location pinned');
      }
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
  }

  Future<void> _save() async {
    if (_supplier == null) return;
    setState(() => _saving = true);
    try {
      await supabase.from('suppliers').update({
        'name': _name.text.trim(),
        'country': _country.text.trim(),
        'about': _about.text.trim(),
        'business_type': _businessType.isEmpty ? null : _businessType,
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
        'website': _website.text.trim().isEmpty ? null : _website.text.trim(),
        'trade_type': _tradeType,
        'categories': _categoriesSel.toList(),
        'verticals': _verticalsSel.toList(),
        'location_address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'manual_payment_enabled': _payEnabled,
        'manual_payment_number': _payNumber.text.trim().isEmpty ? null : _payNumber.text.trim(),
        'manual_payment_name': _payName.text.trim().isEmpty ? null : _payName.text.trim(),
        'manual_payment_instructions': _payInstructions.text.trim().isEmpty ? null : _payInstructions.text.trim(),
      }).eq('id', _supplier!['id']);
      if (mounted) _toast(context, 'Saved');
    } catch (e) { if (mounted) _toast(context, '$e', err: true); }
    finally { if (mounted) setState(() => _saving = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Skeletons.list(count: 6);
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('BANNER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      InkWell(
        onTap: () => _uploadImage('banner'),
        child: AspectRatio(
          aspectRatio: 3, child: Container(
            decoration: BoxDecoration(
              color: AppColors.mutedSurface,
              border: Border.all(color: AppColors.border, style: BorderStyle.solid, width: 2),
              borderRadius: BorderRadius.circular(16),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(fit: StackFit.expand, children: [
              if (_banner.isNotEmpty) Image.network(_banner, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())
              else const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(LucideIcons.image, color: AppColors.muted), SizedBox(height: 4), Text('Tap to upload banner', style: TextStyle(fontSize: 11, color: AppColors.muted))])),
              if (_uploading == 'banner') Container(color: Colors.black38, child: const Center(child: CircularProgressIndicator(color: Colors.white))),
            ]),
          ),
        ),
      ),
      const SizedBox(height: 16),
      const Text('LOGO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      Row(children: [
        InkWell(
          onTap: () => _uploadImage('logo'),
          child: Container(
            width: 80, height: 80,
            decoration: BoxDecoration(color: AppColors.mutedSurface, border: Border.all(color: AppColors.border, style: BorderStyle.solid, width: 2), borderRadius: BorderRadius.circular(16)),
            clipBehavior: Clip.antiAlias,
            child: Stack(fit: StackFit.expand, children: [
              if (_logo.isNotEmpty) Image.network(_logo, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(LucideIcons.image, color: AppColors.muted))
              else const Icon(LucideIcons.image, color: AppColors.muted),
              if (_uploading == 'logo') Container(color: Colors.black38, child: const Center(child: CircularProgressIndicator(color: Colors.white))),
            ]),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Store logo', style: TextStyle(fontWeight: FontWeight.w800)),
          const Text('Square image, at least 200×200px', style: TextStyle(fontSize: 11, color: AppColors.muted)),
          TextButton(onPressed: () => _uploadImage('logo'), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero), child: Text(_logo.isEmpty ? 'Upload' : 'Replace')),
        ])),
      ]),

      const SizedBox(height: 16),
      TextField(controller: _name, decoration: const InputDecoration(labelText: 'Store name')),
      const SizedBox(height: 12),
      TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country')),
      const SizedBox(height: 12),
      TextField(controller: _about, maxLines: 4, decoration: const InputDecoration(labelText: 'About your store')),

      const SizedBox(height: 20),
      const Text('STORE LOCATION', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      TextField(controller: _address, decoration: const InputDecoration(labelText: 'Address (optional)')),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: OutlinedButton.icon(onPressed: _pinCurrent, icon: const Icon(LucideIcons.mapPin, size: 14), label: const Text('Use current location'), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(40)))),
        const SizedBox(width: 8),
        Text(_lat == null ? 'No pin' : '${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]),

      const SizedBox(height: 20),
      const Text('BUSINESS DETAILS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      Wrap(spacing: 6, runSpacing: 6, children: ['individual', 'company', 'factory', 'distributor'].map((t) {
        final active = _businessType == t;
        return GestureDetector(
          onTap: () => setState(() => _businessType = t),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: active ? AppColors.primary : AppColors.card, border: Border.all(color: active ? AppColors.primary : AppColors.border), borderRadius: BorderRadius.circular(999)),
            child: Text(t, style: TextStyle(color: active ? Colors.white : AppColors.foreground, fontSize: 11, fontWeight: FontWeight.w900)),
          ),
        );
      }).toList()),
      const SizedBox(height: 10),
      TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone')),
      const SizedBox(height: 10),
      TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Business email')),
      const SizedBox(height: 10),
      TextField(controller: _website, decoration: const InputDecoration(labelText: 'Website (optional)')),

      const SizedBox(height: 20),
      Row(children: [
        const Expanded(child: Text('MANUAL ECOCASH PAYMENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted))),
        Switch(value: _payEnabled, onChanged: (v) => setState(() => _payEnabled = v)),
      ]),
      const Text('Let buyers pay you directly via EcoCash and submit the transaction reference for you to confirm.',
          style: TextStyle(fontSize: 11, color: AppColors.muted)),
      const SizedBox(height: 8),
      TextField(controller: _payNumber, enabled: _payEnabled, decoration: const InputDecoration(labelText: 'EcoCash number')),
      const SizedBox(height: 10),
      TextField(controller: _payName, enabled: _payEnabled, decoration: const InputDecoration(labelText: 'Recipient name')),
      const SizedBox(height: 10),
      TextField(controller: _payInstructions, enabled: _payEnabled, maxLines: 3, decoration: const InputDecoration(labelText: 'Instructions for buyers (optional)')),

      const SizedBox(height: 20),
      const Text('TRADE TYPE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      Wrap(spacing: 6, children: [
        for (final t in ['retail', 'wholesale', 'both']) GestureDetector(
          onTap: () => setState(() => _tradeType = t),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: _tradeType == t ? AppColors.primary : AppColors.card, border: Border.all(color: _tradeType == t ? AppColors.primary : AppColors.border), borderRadius: BorderRadius.circular(999)),
            child: Text(t == 'both' ? 'Retail & Wholesale' : t, style: TextStyle(color: _tradeType == t ? Colors.white : AppColors.foreground, fontSize: 11, fontWeight: FontWeight.w900)),
          ),
        ),
      ]),

      const SizedBox(height: 20),
      Text('WHAT DO YOU SELL? (${_categoriesSel.length} selected)', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const SizedBox(height: 6),
      Wrap(spacing: 6, runSpacing: 6, children: _cats.map((c) {
        final slug = (c['slug'] ?? c['id']).toString();
        final active = _categoriesSel.contains(slug);
        return GestureDetector(
          onTap: () => setState(() => active ? _categoriesSel.remove(slug) : _categoriesSel.add(slug)),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: active ? AppColors.primary : AppColors.card, border: Border.all(color: active ? AppColors.primary : AppColors.border), borderRadius: BorderRadius.circular(999)),
            child: Text(c['name'] ?? '', style: TextStyle(color: active ? Colors.white : AppColors.foreground, fontSize: 11, fontWeight: FontWeight.w900)),
          ),
        );
      }).toList()),

      const SizedBox(height: 20),
      Text('WHAT DO YOU PROVIDE? (${_verticalsSel.length} selected)', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1, color: AppColors.muted)),
      const Text('Pick the services your store offers — only those will appear in MyStore.',
          style: TextStyle(fontSize: 11, color: AppColors.muted)),
      const SizedBox(height: 6),
      GridView.count(
        crossAxisCount: 2, mainAxisSpacing: 6, crossAxisSpacing: 6, shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(), childAspectRatio: 4.5,
        children: _verticalsForSupplier.map((v) {
          final active = _verticalsSel.contains(v.$1);
          return GestureDetector(
            onTap: () => setState(() => active ? _verticalsSel.remove(v.$1) : _verticalsSel.add(v.$1)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: active ? AppColors.primary : AppColors.card, border: Border.all(color: active ? AppColors.primary : AppColors.border), borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                Icon(v.$3, size: 14, color: active ? Colors.white : AppColors.foreground),
                const SizedBox(width: 6),
                Expanded(child: Text(v.$2, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: active ? Colors.white : AppColors.foreground), overflow: TextOverflow.ellipsis)),
              ]),
            ),
          );
        }).toList(),
      ),

      const SizedBox(height: 24),
      FilledButton(
        onPressed: _saving ? null : _save,
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        child: Text(_saving ? 'Saving…' : 'Save changes'),
      ),
    ]);
  }
}

// ==========================================================================
// Settings — placeholders like web
// ==========================================================================

class _SettingsView extends StatelessWidget {
  const _SettingsView();
  @override
  Widget build(BuildContext context) {
    final items = [
      (LucideIcons.dollarSign, 'Payouts', 'Coming in Phase 2'),
      (LucideIcons.package, 'Tax & invoicing', 'Coming in Phase 2'),
      (LucideIcons.settings, 'Store hours', 'Coming in Phase 2'),
    ];
    return ListView(padding: const EdgeInsets.all(12), children: items.map((s) => Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(s.$1, color: AppColors.primary, size: 18)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.$2, style: const TextStyle(fontWeight: FontWeight.w900)),
          Text(s.$3, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ])),
      ]),
    )).toList());
  }
}

// ==========================================================================
// Import (stub) + Service verticals (stub) — expanded in follow-up turns.
// ==========================================================================

class _ImportStubView extends StatelessWidget {
  const _ImportStubView();
  @override
  Widget build(BuildContext context) => const _StubView(
    icon: LucideIcons.download,
    title: 'Import from the web',
    body: 'Single URL and bulk import from Alibaba, Amazon and Shopify — with per-item markup — will be enabled here in the next parity pass.',
  );
}

class _ServiceListingView extends StatelessWidget {
  final String sectionKey;
  const _ServiceListingView({required this.sectionKey});
  @override
  Widget build(BuildContext context) {
    final vertical = sectionKey.split('/').last;
    return _StubView(
      icon: LucideIcons.package,
      title: 'Manage $vertical',
      body: 'Full CRUD with form dialog for $vertical listings will be enabled in the next parity pass.',
    );
  }
}

class _StubView extends StatelessWidget {
  final IconData icon; final String title; final String body;
  const _StubView({required this.icon, required this.title, required this.body});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 48, color: AppColors.primary),
        const SizedBox(height: 12),
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(body, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
      ]),
    ),
  );
}
