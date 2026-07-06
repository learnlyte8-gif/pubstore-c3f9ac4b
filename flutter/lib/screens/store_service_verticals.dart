// Mirrors the 11 service-vertical CRUD views + Import view from
// `src/pages/StoreSection.tsx`. Shared UI helpers (ServiceShell, FormSheet,
// LabeledInput, LabeledSelect, CoverPickerField) live at the top of this file
// and are consumed by every vertical below.
//
// Verticals implemented:
//   stays · vehicles · industrial · news · driver · pros · properties ·
//   logistics (courier) · finance · car-rentals · agro
//
// Import view supports both `single` and `bulk` modes with the shared markup
// controls and calls the same edge functions (`import-product`, `import-list`)
// that the web app uses.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

// ---------- Shared helpers ---------------------------------------------------

/// Async loader for the current user's supplier row (mirrors `fetchMySupplier`).
Future<Map<String, dynamic>?> _fetchMySupplier() async {
  final u = supabase.auth.currentUser;
  if (u == null) return null;
  final row = await supabase.from('suppliers').select().eq('owner_id', u.id).maybeSingle();
  return row;
}

Future<String?> _uploadCover(String folder) async {
  final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
  if (picked == null) return null;
  final u = supabase.auth.currentUser;
  if (u == null) return null;
  final bytes = await File(picked.path).readAsBytes();
  final ext = picked.path.split('.').last.toLowerCase();
  final path = '${u.id}/$folder-${DateTime.now().millisecondsSinceEpoch}.$ext';
  await supabase.storage.from('product-images').uploadBinary(
        path,
        bytes,
        fileOptions: FileOptions(upsert: true, contentType: 'image/$ext'),
      );
  return supabase.storage.from('product-images').getPublicUrl(path);
}

class ServiceShell extends StatelessWidget {
  final String title;
  final List<dynamic> items;
  final bool isLoading;
  final String emptyHint;
  final VoidCallback onAdd;
  final Widget Function(Map<String, dynamic>) renderItem;
  const ServiceShell({
    super.key,
    required this.title,
    required this.items,
    required this.isLoading,
    required this.emptyHint,
    required this.onAdd,
    required this.renderItem,
  });
  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Row(
              children: [
                Expanded(child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800))),
                FilledButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(LucideIcons.plus, size: 16),
                  label: const Text('New'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10)),
                ),
              ],
            ),
          ),
        ),
        if (isLoading)
          const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
        else if (items.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(LucideIcons.package, color: AppColors.muted, size: 40),
                  const SizedBox(height: 10),
                  const Text('Nothing here yet', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(emptyHint, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: onAdd, child: const Text('Create the first one')),
                ]),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            sliver: SliverList.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => renderItem(items[i] as Map<String, dynamic>),
            ),
          ),
      ],
    );
  }
}

/// Modal bottom sheet with a scrollable form body (mirrors web `FormSheet`).
Future<T?> showFormSheet<T>(BuildContext context, {required String title, required Widget child}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.98,
      expand: false,
      builder: (_, controller) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(children: [
          Container(
            width: 42, height: 4, margin: const EdgeInsets.only(top: 8, bottom: 4),
            decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
            child: Row(children: [
              Expanded(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
              IconButton(onPressed: () => Navigator.of(ctx).maybePop(), icon: const Icon(Icons.close)),
            ]),
          ),
          const Divider(height: 1),
          Expanded(
            child: SingleChildScrollView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: child,
            ),
          ),
        ]),
      ),
    ),
  );
}

class LabeledInput extends StatelessWidget {
  final String label;
  final String initial;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final int maxLines;
  const LabeledInput({
    super.key,
    required this.label,
    required this.initial,
    required this.onChanged,
    this.keyboardType,
    this.maxLines = 1,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        TextFormField(
          initialValue: initial,
          keyboardType: keyboardType,
          maxLines: maxLines,
          onChanged: onChanged,
          decoration: const InputDecoration(
            isDense: true,
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
          ),
        ),
      ]),
    );
  }
}

class LabeledSelect<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<T> options;
  final ValueChanged<T?> onChanged;
  final String Function(T)? labelFor;
  const LabeledSelect({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.labelFor,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        DropdownButtonFormField<T>(
          initialValue: value,
          items: options.map((o) => DropdownMenuItem(value: o, child: Text(labelFor?.call(o) ?? o.toString()))).toList(),
          onChanged: onChanged,
          decoration: const InputDecoration(
            isDense: true,
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
          ),
        ),
      ]),
    );
  }
}

class CoverPickerField extends StatefulWidget {
  final String label;
  final String? value;
  final String folder;
  final ValueChanged<String?> onChanged;
  const CoverPickerField({super.key, required this.label, required this.value, required this.folder, required this.onChanged});
  @override
  State<CoverPickerField> createState() => _CoverPickerFieldState();
}

class _CoverPickerFieldState extends State<CoverPickerField> {
  bool _busy = false;
  Future<void> _pick() async {
    setState(() => _busy = true);
    try {
      final url = await _uploadCover(widget.folder);
      if (url != null) widget.onChanged(url);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(widget.label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 0.5)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: _busy ? null : _pick,
          child: Container(
            height: 160,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: Colors.grey.shade100,
              image: (widget.value != null && widget.value!.isNotEmpty)
                  ? DecorationImage(image: NetworkImage(widget.value!), fit: BoxFit.cover)
                  : null,
              border: Border.all(color: Colors.black12),
            ),
            child: _busy
                ? const Center(child: CircularProgressIndicator())
                : (widget.value == null || widget.value!.isEmpty)
                    ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(LucideIcons.imagePlus, color: AppColors.muted),
                        SizedBox(height: 6),
                        Text('Tap to upload cover', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                      ]))
                    : Align(
                        alignment: Alignment.topRight,
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: IconButton.filled(
                            onPressed: () => widget.onChanged(null),
                            icon: const Icon(LucideIcons.x, size: 16),
                            style: IconButton.styleFrom(backgroundColor: Colors.black.withOpacity(0.5), padding: EdgeInsets.zero),
                          ),
                        ),
                      ),
          ),
        ),
      ]),
    );
  }
}

/// Row-tile used by list views inside `ServiceShell`.
Widget serviceRow({
  required String? cover,
  required String title,
  required String subtitle,
  String? trailingText,
  required VoidCallback onEdit,
  required VoidCallback onDelete,
}) {
  return Container(
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.black12)),
    padding: const EdgeInsets.all(10),
    child: Row(children: [
      Container(
        width: 64, height: 64,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          image: (cover != null && cover.isNotEmpty) ? DecorationImage(image: NetworkImage(cover), fit: BoxFit.cover) : null,
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          if (trailingText != null) Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(trailingText, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
          ),
        ]),
      ),
      Column(children: [
        IconButton(onPressed: onEdit, icon: const Icon(LucideIcons.pencil, size: 16)),
        IconButton(onPressed: onDelete, icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.redAccent)),
      ]),
    ]),
  );
}

// Fetches a list of "my <table>" rows for the current supplier or user, then
// renders a ServiceShell. Handles refresh via a StatefulWidget so the router
// can hot-swap between the 11 verticals without prop drilling.
abstract class _MyListState<W extends StatefulWidget> extends State<W> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  Future<List<Map<String, dynamic>>> loadItems();

  @override
  void initState() {
    super.initState();
    refresh();
  }

  Future<void> refresh() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await loadItems();
      if (mounted) setState(() { _items = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = '$e'; _loading = false; });
    }
  }
}

// ============================================================================
// STAYS
// ============================================================================
class StaysServiceView extends StatefulWidget { const StaysServiceView({super.key}); @override State<StaysServiceView> createState() => _StaysState(); }
class _StaysState extends _MyListState<StaysServiceView> {
  Map<String, dynamic>? _supplier;
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    _supplier ??= await _fetchMySupplier();
    if (_supplier == null) return [];
    final rows = await supabase.from('stays').select().eq('supplier_id', _supplier!['id']).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(rows);
  }
  Future<void> _remove(String id) async {
    await supabase.from('stays').delete().eq('id', id);
    refresh();
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_supplier == null) return const _CreateStoreFirst();
    return ServiceShell(
      title: '${_items.length} stays listed',
      items: _items,
      isLoading: false,
      emptyHint: 'List a B&B, hotel room, factory tour or retreat.',
      onAdd: () async {
        await showFormSheet(context, title: 'List a new stay', child: _StayForm(supplierId: _supplier!['id'], onSaved: () { Navigator.pop(context); refresh(); }));
      },
      renderItem: (s) => serviceRow(
        cover: s['cover'] as String?,
        title: '${s['title'] ?? ''}',
        subtitle: '${s['kind'] ?? ''} · ${s['city'] ?? '—'}${s['country'] != null ? ', ${s['country']}' : ''}',
        trailingText: '\$${(s['price_per_night'] ?? 0).toString()} / night',
        onEdit: () async {
          await showFormSheet(context, title: 'Edit stay', child: _StayForm(supplierId: _supplier!['id'], initial: s, onSaved: () { Navigator.pop(context); refresh(); }));
        },
        onDelete: () async {
          if (await _confirm(context, 'Delete this stay?')) _remove(s['id'] as String);
        },
      ),
    );
  }
}
class _StayForm extends StatefulWidget {
  final String supplierId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _StayForm({required this.supplierId, this.initial, required this.onSaved});
  @override State<_StayForm> createState() => _StayFormState();
}
class _StayFormState extends State<_StayForm> {
  late Map<String, dynamic> f;
  bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'kind': i?['kind'] ?? 'b&b', 'city': i?['city'] ?? '', 'country': i?['country'] ?? '',
    'cover': i?['cover'] ?? '', 'description': i?['description'] ?? '',
    'price_per_night': i?['price_per_night'] ?? 80, 'bedrooms': i?['bedrooms'] ?? 1, 'beds': i?['beds'] ?? 1,
    'baths': i?['baths'] ?? 1, 'guests': i?['guests'] ?? 2, 'superhost': i?['superhost'] ?? false,
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _toast('Title required');
    setState(() => _busy = true);
    final payload = { ...f, 'supplier_id': widget.supplierId, 'price_per_night': num.tryParse('${f['price_per_night']}') ?? 0 };
    try {
      if (widget.initial != null) { await supabase.from('stays').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('stays').insert(payload); }
      widget.onSaved();
    } catch (e) { _toast('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Kind', value: f['kind'], options: const ['b&b','hotel','apartment','factory_tour','retreat'], onChanged: (v) => setState(() => f['kind'] = v))),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Price / night (\$)', initial: '${f['price_per_night']}', keyboardType: TextInputType.number, onChanged: (v) => f['price_per_night'] = num.tryParse(v) ?? 0)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
    ]),
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'stays', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Bedrooms', initial: '${f['bedrooms']}', keyboardType: TextInputType.number, onChanged: (v) => f['bedrooms'] = int.tryParse(v) ?? 1)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Beds', initial: '${f['beds']}', keyboardType: TextInputType.number, onChanged: (v) => f['beds'] = int.tryParse(v) ?? 1)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Baths', initial: '${f['baths']}', keyboardType: TextInputType.number, onChanged: (v) => f['baths'] = int.tryParse(v) ?? 1)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Guests', initial: '${f['guests']}', keyboardType: TextInputType.number, onChanged: (v) => f['guests'] = int.tryParse(v) ?? 1)),
    ]),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 4, onChanged: (v) => f['description'] = v),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Superhost badge'), value: f['superhost'] as bool, onChanged: (v) => setState(() => f['superhost'] = v)),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : (widget.initial != null ? 'Save changes' : 'Publish stay'))),
  ]);
}

// ============================================================================
// VEHICLES
// ============================================================================
class VehiclesServiceView extends StatefulWidget { const VehiclesServiceView({super.key}); @override State<VehiclesServiceView> createState() => _VehiclesState(); }
class _VehiclesState extends _MyListState<VehiclesServiceView> {
  Map<String, dynamic>? _supplier;
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    _supplier ??= await _fetchMySupplier();
    if (_supplier == null) return [];
    final r = await supabase.from('vehicles').select().eq('supplier_id', _supplier!['id']).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_supplier == null) return const _CreateStoreFirst();
    return ServiceShell(
      title: '${_items.length} vehicles listed',
      items: _items,
      isLoading: false,
      emptyHint: 'Sell or showcase vehicles, EVs, fleet trucks, motorbikes or parts.',
      onAdd: () async => showFormSheet(context, title: 'List a vehicle', child: _VehicleForm(supplierId: _supplier!['id'], onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (v) => serviceRow(
        cover: v['cover'] as String?, title: '${v['title'] ?? ''}',
        subtitle: '${v['kind'] ?? ''} · ${v['year'] ?? ''} ${v['make'] ?? ''} ${v['model'] ?? ''}',
        trailingText: '\$${v['price'] ?? 0}',
        onEdit: () async => showFormSheet(context, title: 'Edit vehicle', child: _VehicleForm(supplierId: _supplier!['id'], initial: v, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this vehicle?')) { await supabase.from('vehicles').delete().eq('id', v['id']); refresh(); } },
      ),
    );
  }
}
class _VehicleForm extends StatefulWidget {
  final String supplierId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _VehicleForm({required this.supplierId, this.initial, required this.onSaved});
  @override State<_VehicleForm> createState() => _VehicleFormState();
}
class _VehicleFormState extends State<_VehicleForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'kind': i?['kind'] ?? 'car', 'condition': i?['condition'] ?? 'used',
    'make': i?['make'] ?? '', 'model': i?['model'] ?? '', 'year': i?['year'] ?? DateTime.now().year,
    'fuel': i?['fuel'] ?? 'petrol', 'transmission': i?['transmission'] ?? 'automatic',
    'mileage_km': i?['mileage_km'] ?? 0, 'price': i?['price'] ?? 0,
    'cover': i?['cover'] ?? '', 'city': i?['city'] ?? '', 'country': i?['country'] ?? '',
    'description': i?['description'] ?? '',
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _toast('Title required');
    setState(() => _busy = true);
    final payload = { ...f, 'supplier_id': widget.supplierId };
    try {
      if (widget.initial != null) { await supabase.from('vehicles').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('vehicles').insert(payload); }
      widget.onSaved();
    } catch (e) { _toast('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Kind', value: f['kind'], options: const ['car','ev','truck','bike','parts'], onChanged: (v) => setState(() => f['kind'] = v))),
      const SizedBox(width: 6),
      Expanded(child: LabeledSelect<String>(label: 'Condition', value: f['condition'], options: const ['new','used','certified'], onChanged: (v) => setState(() => f['condition'] = v))),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Year', initial: '${f['year']}', keyboardType: TextInputType.number, onChanged: (v) => f['year'] = int.tryParse(v) ?? 0)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Make', initial: f['make'], onChanged: (v) => f['make'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Model', initial: f['model'], onChanged: (v) => f['model'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Fuel', value: f['fuel'], options: const ['petrol','diesel','hybrid','electric','lpg'], onChanged: (v) => setState(() => f['fuel'] = v))),
      const SizedBox(width: 6),
      Expanded(child: LabeledSelect<String>(label: 'Trans.', value: f['transmission'], options: const ['automatic','manual','cvt','dct'], onChanged: (v) => setState(() => f['transmission'] = v))),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Mileage km', initial: '${f['mileage_km']}', keyboardType: TextInputType.number, onChanged: (v) => f['mileage_km'] = int.tryParse(v) ?? 0)),
    ]),
    LabeledInput(label: 'Price (\$)', initial: '${f['price']}', keyboardType: TextInputType.number, onChanged: (v) => f['price'] = num.tryParse(v) ?? 0),
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'vehicles', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    Row(children: [
      Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
    ]),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 4, onChanged: (v) => f['description'] = v),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : (widget.initial != null ? 'Save changes' : 'Publish vehicle'))),
  ]);
}

// ============================================================================
// INDUSTRIAL
// ============================================================================
class IndustrialServiceView extends StatefulWidget { const IndustrialServiceView({super.key}); @override State<IndustrialServiceView> createState() => _IndustrialState(); }
class _IndustrialState extends _MyListState<IndustrialServiceView> {
  Map<String, dynamic>? _supplier;
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    _supplier ??= await _fetchMySupplier();
    if (_supplier == null) return [];
    final r = await supabase.from('industrial_listings').select().eq('supplier_id', _supplier!['id']).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_supplier == null) return const _CreateStoreFirst();
    return ServiceShell(
      title: '${_items.length} industrial listings',
      items: _items, isLoading: false,
      emptyHint: 'Showcase machinery, raw materials, OEM capacity or industrial services.',
      onAdd: () async => showFormSheet(context, title: 'New industrial listing', child: _IndustrialForm(supplierId: _supplier!['id'], onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (it) => serviceRow(
        cover: it['cover'] as String?, title: '${it['title'] ?? ''}',
        subtitle: '${it['category'] ?? ''}${it['subcategory'] != null && it['subcategory'] != '' ? ' · ${it['subcategory']}' : ''}',
        trailingText: it['price'] != null ? '\$${it['price']}${it['unit'] != null ? ' / ${it['unit']}' : ''}' : 'Quote on request',
        onEdit: () async => showFormSheet(context, title: 'Edit listing', child: _IndustrialForm(supplierId: _supplier!['id'], initial: it, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this listing?')) { await supabase.from('industrial_listings').delete().eq('id', it['id']); refresh(); } },
      ),
    );
  }
}
class _IndustrialForm extends StatefulWidget {
  final String supplierId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _IndustrialForm({required this.supplierId, this.initial, required this.onSaved});
  @override State<_IndustrialForm> createState() => _IndustrialFormState();
}
class _IndustrialFormState extends State<_IndustrialForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'category': i?['category'] ?? 'machinery', 'subcategory': i?['subcategory'] ?? '',
    'cover': i?['cover'] ?? '', 'description': i?['description'] ?? '',
    'moq': i?['moq'] ?? 1, 'unit': i?['unit'] ?? 'piece', 'price': i?['price'] ?? 0,
    'lead_time': i?['lead_time'] ?? '', 'capacity': i?['capacity'] ?? '',
    'ship_from': i?['ship_from'] ?? '', 'country': i?['country'] ?? '',
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _t('Title required');
    setState(() => _busy = true);
    final payload = { ...f, 'supplier_id': widget.supplierId,
      'price': num.tryParse('${f['price']}'), 'moq': int.tryParse('${f['moq']}') };
    try {
      if (widget.initial != null) { await supabase.from('industrial_listings').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('industrial_listings').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Category', value: f['category'], options: const ['machinery','materials','oem','services','components'], onChanged: (v) => setState(() => f['category'] = v))),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Subcategory', initial: f['subcategory'], onChanged: (v) => f['subcategory'] = v)),
    ]),
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'industrial', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    Row(children: [
      Expanded(child: LabeledInput(label: 'MOQ', initial: '${f['moq']}', keyboardType: TextInputType.number, onChanged: (v) => f['moq'] = int.tryParse(v) ?? 1)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Unit', initial: f['unit'], onChanged: (v) => f['unit'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Price (\$)', initial: '${f['price']}', keyboardType: TextInputType.number, onChanged: (v) => f['price'] = num.tryParse(v) ?? 0)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Lead time', initial: f['lead_time'], onChanged: (v) => f['lead_time'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Capacity', initial: f['capacity'], onChanged: (v) => f['capacity'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Ship from', initial: f['ship_from'], onChanged: (v) => f['ship_from'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
    ]),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 4, onChanged: (v) => f['description'] = v),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : (widget.initial != null ? 'Save changes' : 'Publish listing'))),
  ]);
}

// ============================================================================
// NEWS (admin)
// ============================================================================
class NewsServiceView extends StatefulWidget { const NewsServiceView({super.key}); @override State<NewsServiceView> createState() => _NewsState(); }
class _NewsState extends _MyListState<NewsServiceView> {
  bool? _allowed;
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    final u = supabase.auth.currentUser;
    if (u == null) { _allowed = false; return []; }
    final role = await supabase.from('user_roles').select('role').eq('user_id', u.id).eq('role', 'admin').maybeSingle();
    _allowed = role != null || (u.email ?? '').toLowerCase() == 'kukistacks8@gmail.com';
    if (_allowed != true) return [];
    final r = await supabase.from('news_articles').select().order('published_at', ascending: false).limit(50);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_allowed != true) return const _RestrictedNotice(title: 'Editorial access required', body: 'Publishing news is reserved for the PUBSTORE editorial team.');
    return ServiceShell(
      title: '${_items.length} articles', items: _items, isLoading: false,
      emptyHint: 'Publish announcements, supplier features and market reports.',
      onAdd: () async => showFormSheet(context, title: 'Publish a news article', child: _NewsForm(onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (a) => serviceRow(
        cover: a['cover'] as String?, title: '${a['title']}',
        subtitle: '${a['category']} · ${a['published_at'] != null ? DateTime.tryParse('${a['published_at']}')?.toLocal().toString().split(' ').first ?? '' : ''}${a['featured'] == true ? ' · ★ FEATURED' : ''}',
        onEdit: () async => showFormSheet(context, title: 'Edit article', child: _NewsForm(initial: a, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this article?')) { await supabase.from('news_articles').delete().eq('id', a['id']); refresh(); } },
      ),
    );
  }
}
class _NewsForm extends StatefulWidget {
  final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _NewsForm({this.initial, required this.onSaved});
  @override State<_NewsForm> createState() => _NewsFormState();
}
class _NewsFormState extends State<_NewsForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'slug': i?['slug'] ?? '', 'dek': i?['dek'] ?? '',
    'body': i?['body'] ?? '', 'cover': i?['cover'] ?? '', 'category': i?['category'] ?? 'marketplace',
    'author': i?['author'] ?? 'PUBSTORE Editorial', 'read_minutes': i?['read_minutes'] ?? 3,
    'featured': i?['featured'] ?? false,
  }; }
  String _slugify(String s) => s.toLowerCase().trim().replaceAll(RegExp(r'[^a-z0-9\s-]'), '').replaceAll(RegExp(r'\s+'), '-');
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _t('Title required');
    setState(() => _busy = true);
    final payload = { ...f, 'slug': (f['slug'] as String).trim().isEmpty ? _slugify(f['title']) : f['slug'], 'read_minutes': int.tryParse('${f['read_minutes']}') ?? 3 };
    try {
      if (widget.initial != null) { await supabase.from('news_articles').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('news_articles').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) { f['title'] = v; if ((f['slug'] as String).isEmpty) f['slug'] = _slugify(v); }),
    LabeledInput(label: 'Slug', initial: f['slug'], onChanged: (v) => f['slug'] = v),
    LabeledInput(label: 'Dek (subtitle)', initial: f['dek'], onChanged: (v) => f['dek'] = v),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Category', value: f['category'], options: const ['marketplace','supplier','trade','industry','trends','editorial'], onChanged: (v) => setState(() => f['category'] = v))),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Author', initial: f['author'], onChanged: (v) => f['author'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Read min', initial: '${f['read_minutes']}', keyboardType: TextInputType.number, onChanged: (v) => f['read_minutes'] = int.tryParse(v) ?? 3)),
    ]),
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'news', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    LabeledInput(label: 'Body (markdown)', initial: f['body'], maxLines: 10, onChanged: (v) => f['body'] = v),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Feature on homepage'), value: f['featured'] as bool, onChanged: (v) => setState(() => f['featured'] = v)),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Publishing…' : (widget.initial != null ? 'Save changes' : 'Publish article'))),
  ]);
}

// ============================================================================
// DRIVER (single-profile form)
// ============================================================================
class DriverServiceView extends StatefulWidget { const DriverServiceView({super.key}); @override State<DriverServiceView> createState() => _DriverState(); }
class _DriverState extends State<DriverServiceView> {
  bool _loading = true; Map<String, dynamic>? _profile;
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final u = supabase.auth.currentUser;
    if (u != null) {
      _profile = await supabase.from('driver_profiles').select().eq('user_id', u.id).maybeSingle();
    }
    final p = _profile ?? {};
    f = {
      'display_name': p['display_name'] ?? '', 'phone': p['phone'] ?? '', 'whatsapp': p['whatsapp'] ?? '',
      'email': p['email'] ?? '', 'vehicle_class': p['vehicle_class'] ?? 'economy',
      'vehicle_make': p['vehicle_make'] ?? '', 'vehicle_model': p['vehicle_model'] ?? '',
      'vehicle_color': p['vehicle_color'] ?? '', 'vehicle_year': p['vehicle_year'] ?? DateTime.now().year,
      'vehicle_plate': p['vehicle_plate'] ?? '', 'vehicle_photo': p['vehicle_photo'] ?? '',
      'plate_photo': p['plate_photo'] ?? '', 'selfie_photo': p['selfie_photo'] ?? '',
      'license_photo': p['license_photo'] ?? '', 'bio': p['bio'] ?? '',
      'city': p['city'] ?? '', 'country': p['country'] ?? '', 'active': p['active'] ?? true,
    };
    setState(() => _loading = false);
  }
  Future<void> _save() async {
    final u = supabase.auth.currentUser; if (u == null) return;
    if ((f['vehicle_plate'] as String).trim().isEmpty) return _t('Number plate is required');
    if ((f['phone'] as String).trim().isEmpty) return _t('Phone is required');
    if ((f['vehicle_photo'] as String).isEmpty) return _t('Add a photo of your vehicle');
    if ((f['plate_photo'] as String).isEmpty) return _t('Add a photo of the number plate');
    setState(() => _busy = true);
    final payload = { ...f, 'user_id': u.id, 'vehicle_year': int.tryParse('${f['vehicle_year']}') };
    try {
      if (_profile != null) { await supabase.from('driver_profiles').update(payload).eq('user_id', u.id); }
      else { await supabase.from('driver_profiles').insert(payload); }
      _t('Driver profile saved');
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        LabeledInput(label: 'Display name', initial: f['display_name'], onChanged: (v) => f['display_name'] = v),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Phone *', initial: f['phone'], onChanged: (v) => f['phone'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['whatsapp'], onChanged: (v) => f['whatsapp'] = v)),
        ]),
        LabeledInput(label: 'Email', initial: f['email'], onChanged: (v) => f['email'] = v),
        LabeledSelect<String>(label: 'Vehicle class', value: f['vehicle_class'], options: const ['economy','comfort','xl','luxury'], onChanged: (v) => setState(() => f['vehicle_class'] = v)),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Make', initial: f['vehicle_make'], onChanged: (v) => f['vehicle_make'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Model', initial: f['vehicle_model'], onChanged: (v) => f['vehicle_model'] = v)),
        ]),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Color', initial: f['vehicle_color'], onChanged: (v) => f['vehicle_color'] = v)),
          const SizedBox(width: 6),
          Expanded(child: LabeledInput(label: 'Year', initial: '${f['vehicle_year']}', keyboardType: TextInputType.number, onChanged: (v) => f['vehicle_year'] = int.tryParse(v) ?? 0)),
          const SizedBox(width: 6),
          Expanded(child: LabeledInput(label: 'Plate *', initial: f['vehicle_plate'], onChanged: (v) => f['vehicle_plate'] = v.toUpperCase())),
        ]),
        CoverPickerField(label: 'Vehicle photo *', value: f['vehicle_photo'], folder: 'driver', onChanged: (v) => setState(() => f['vehicle_photo'] = v ?? '')),
        CoverPickerField(label: 'Plate photo *', value: f['plate_photo'], folder: 'driver', onChanged: (v) => setState(() => f['plate_photo'] = v ?? '')),
        CoverPickerField(label: 'Selfie photo', value: f['selfie_photo'], folder: 'driver', onChanged: (v) => setState(() => f['selfie_photo'] = v ?? '')),
        CoverPickerField(label: 'Driver license photo', value: f['license_photo'], folder: 'driver', onChanged: (v) => setState(() => f['license_photo'] = v ?? '')),
        Row(children: [
          Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
        ]),
        LabeledInput(label: 'Bio', initial: f['bio'], maxLines: 3, onChanged: (v) => f['bio'] = v),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Available for rides'), value: f['active'] as bool, onChanged: (v) => setState(() => f['active'] = v)),
        FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save profile')),
      ]),
    );
  }
}

// ============================================================================
// PROS (service_providers, keyed by user_id, list)
// ============================================================================
class ProServiceView extends StatefulWidget { const ProServiceView({super.key}); @override State<ProServiceView> createState() => _ProState(); }
class _ProState extends _MyListState<ProServiceView> {
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    final u = supabase.auth.currentUser; if (u == null) return [];
    final r = await supabase.from('service_providers').select().eq('user_id', u.id).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return const _NeedAuth();
    return ServiceShell(
      title: '${_items.length} pro profile(s)', items: _items, isLoading: false,
      emptyHint: 'List your skills (plumbing, tutoring, design…) so customers can hire you.',
      onAdd: () async => showFormSheet(context, title: 'New provider profile', child: _ProForm(userId: userId, onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (p) => serviceRow(
        cover: p['cover'] as String?, title: '${p['display_name'] ?? ''}',
        subtitle: '${p['category'] ?? ''} · ${p['city'] ?? '—'}',
        trailingText: p['hourly_rate'] != null ? '\$${p['hourly_rate']}/hr' : null,
        onEdit: () async => showFormSheet(context, title: 'Edit provider profile', child: _ProForm(userId: userId, initial: p, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this provider profile?')) { await supabase.from('service_providers').delete().eq('id', p['id']); refresh(); } },
      ),
    );
  }
}
class _ProForm extends StatefulWidget {
  final String userId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _ProForm({required this.userId, this.initial, required this.onSaved});
  @override State<_ProForm> createState() => _ProFormState();
}
class _ProFormState extends State<_ProForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'display_name': i?['display_name'] ?? '', 'category': i?['category'] ?? 'plumber',
    'bio': i?['bio'] ?? '', 'hourly_rate': i?['hourly_rate']?.toString() ?? '',
    'city': i?['city'] ?? '', 'country': i?['country'] ?? '',
    'phone': i?['phone'] ?? '', 'whatsapp': i?['whatsapp'] ?? '', 'cover': i?['cover'] ?? '',
  }; }
  Future<void> _save() async {
    if ((f['display_name'] as String).trim().isEmpty) return _t('Add your display name');
    setState(() => _busy = true);
    final payload = {
      'user_id': widget.userId,
      'display_name': (f['display_name'] as String).trim(),
      'category': f['category'], 'bio': f['bio'] == '' ? null : f['bio'],
      'hourly_rate': (f['hourly_rate'] as String).isEmpty ? null : num.tryParse(f['hourly_rate']),
      'city': f['city'] == '' ? null : f['city'], 'country': f['country'] == '' ? null : f['country'],
      'phone': f['phone'] == '' ? null : f['phone'], 'whatsapp': f['whatsapp'] == '' ? null : f['whatsapp'],
      'cover': f['cover'] == '' ? null : f['cover'],
    };
    try {
      if (widget.initial?['id'] != null) { await supabase.from('service_providers').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('service_providers').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'pros', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    LabeledInput(label: 'Display name', initial: f['display_name'], onChanged: (v) => f['display_name'] = v),
    LabeledSelect<String>(label: 'Category', value: f['category'], options: const ['plumber','electrician','mechanic','tutor','tailor','hairdresser','cleaner','painter','tiler','photographer','designer','marketing','other'], onChanged: (v) => setState(() => f['category'] = v)),
    LabeledInput(label: 'Bio', initial: f['bio'], maxLines: 3, onChanged: (v) => f['bio'] = v),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Hourly rate (\$)', initial: f['hourly_rate'], keyboardType: TextInputType.number, onChanged: (v) => f['hourly_rate'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Phone', initial: f['phone'], onChanged: (v) => f['phone'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['whatsapp'], onChanged: (v) => f['whatsapp'] = v)),
    ]),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save profile')),
  ]);
}

// ============================================================================
// PROPERTIES
// ============================================================================
class PropertyServiceView extends StatefulWidget { const PropertyServiceView({super.key}); @override State<PropertyServiceView> createState() => _PropertyState(); }
class _PropertyState extends _MyListState<PropertyServiceView> {
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    final u = supabase.auth.currentUser; if (u == null) return [];
    final r = await supabase.from('properties').select().eq('owner_user_id', u.id).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final userId = supabase.auth.currentUser?.id; if (userId == null) return const _NeedAuth();
    return ServiceShell(
      title: '${_items.length} properties listed', items: _items, isLoading: false,
      emptyHint: 'List apartments, houses, rooms, land or commercial spaces.',
      onAdd: () async => showFormSheet(context, title: 'New property', child: _PropertyForm(userId: userId, onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (p) => serviceRow(
        cover: p['cover'] as String?, title: '${p['title'] ?? ''}',
        subtitle: '${p['listing_type'] ?? ''} · ${p['property_kind'] ?? ''} · ${p['city'] ?? '—'}',
        trailingText: '\$${p['price'] ?? 0}${p['listing_type'] == 'rent' ? '/${p['price_period']}' : ''}',
        onEdit: () async => showFormSheet(context, title: 'Edit property', child: _PropertyForm(userId: userId, initial: p, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this property?')) { await supabase.from('properties').delete().eq('id', p['id']); refresh(); } },
      ),
    );
  }
}
class _PropertyForm extends StatefulWidget {
  final String userId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _PropertyForm({required this.userId, this.initial, required this.onSaved});
  @override State<_PropertyForm> createState() => _PropertyFormState();
}
class _PropertyFormState extends State<_PropertyForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'listing_type': i?['listing_type'] ?? 'rent',
    'property_kind': i?['property_kind'] ?? 'apartment',
    'bedrooms': i?['bedrooms']?.toString() ?? '', 'baths': i?['baths']?.toString() ?? '',
    'area_sqm': i?['area_sqm']?.toString() ?? '',
    'price': i?['price']?.toString() ?? '', 'price_period': i?['price_period'] ?? 'month',
    'city': i?['city'] ?? '', 'country': i?['country'] ?? '', 'address': i?['address'] ?? '',
    'description': i?['description'] ?? '', 'cover': i?['cover'] ?? '',
    'contact_phone': i?['contact_phone'] ?? '', 'contact_whatsapp': i?['contact_whatsapp'] ?? '',
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty || (f['price'] as String).isEmpty) return _t('Title and price required');
    setState(() => _busy = true);
    final payload = {
      'owner_user_id': widget.userId,
      'title': (f['title'] as String).trim(),
      'listing_type': f['listing_type'], 'property_kind': f['property_kind'],
      'bedrooms': int.tryParse('${f['bedrooms']}'), 'baths': int.tryParse('${f['baths']}'),
      'area_sqm': num.tryParse('${f['area_sqm']}'),
      'price': num.tryParse('${f['price']}') ?? 0, 'price_period': f['price_period'],
      'city': f['city'] == '' ? null : f['city'], 'country': f['country'] == '' ? null : f['country'],
      'address': f['address'] == '' ? null : f['address'],
      'description': f['description'] == '' ? null : f['description'],
      'cover': f['cover'] == '' ? null : f['cover'],
      'contact_phone': f['contact_phone'] == '' ? null : f['contact_phone'],
      'contact_whatsapp': f['contact_whatsapp'] == '' ? null : f['contact_whatsapp'],
    };
    try {
      if (widget.initial?['id'] != null) { await supabase.from('properties').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('properties').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'properties', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Listing', value: f['listing_type'], options: const ['rent','sale','shared'], onChanged: (v) => setState(() => f['listing_type'] = v))),
      const SizedBox(width: 8),
      Expanded(child: LabeledSelect<String>(label: 'Type', value: f['property_kind'], options: const ['apartment','house','room','land','commercial'], onChanged: (v) => setState(() => f['property_kind'] = v))),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Beds', initial: f['bedrooms'], keyboardType: TextInputType.number, onChanged: (v) => f['bedrooms'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Baths', initial: f['baths'], keyboardType: TextInputType.number, onChanged: (v) => f['baths'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'm²', initial: f['area_sqm'], keyboardType: TextInputType.number, onChanged: (v) => f['area_sqm'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Price (\$)', initial: f['price'], keyboardType: TextInputType.number, onChanged: (v) => f['price'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledSelect<String>(label: 'Period', value: f['price_period'], options: const ['month','year','total'], onChanged: (v) => setState(() => f['price_period'] = v))),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
    ]),
    LabeledInput(label: 'Address', initial: f['address'], onChanged: (v) => f['address'] = v),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 3, onChanged: (v) => f['description'] = v),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Phone', initial: f['contact_phone'], onChanged: (v) => f['contact_phone'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['contact_whatsapp'], onChanged: (v) => f['contact_whatsapp'] = v)),
    ]),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save property')),
  ]);
}

// ============================================================================
// COURIER (single-profile form — rate tiers rendered as JSON textareas for
// mobile brevity; matches web schema so quoted rates remain compatible.)
// ============================================================================
class CourierServiceView extends StatefulWidget { const CourierServiceView({super.key}); @override State<CourierServiceView> createState() => _CourierState(); }
class _CourierState extends State<CourierServiceView> {
  bool _loading = true; Map<String, dynamic>? _profile;
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    final u = supabase.auth.currentUser;
    if (u != null) {
      _profile = await supabase.from('courier_profiles').select().eq('user_id', u.id).maybeSingle();
    }
    final p = _profile ?? {};
    f = {
      'display_name': p['display_name'] ?? '', 'company_name': p['company_name'] ?? '',
      'phone': p['phone'] ?? '', 'whatsapp': p['whatsapp'] ?? '', 'email': p['email'] ?? '',
      'vehicle_type': p['vehicle_type'] ?? 'bike', 'vehicle_make': p['vehicle_make'] ?? '',
      'vehicle_model': p['vehicle_model'] ?? '', 'vehicle_plate': p['vehicle_plate'] ?? '',
      'max_weight_kg': p['max_weight_kg']?.toString() ?? '', 'max_volume_m3': p['max_volume_m3']?.toString() ?? '',
      'service_areas': (p['service_areas'] as List?)?.join(', ') ?? '',
      'city': p['city'] ?? '', 'country': p['country'] ?? '',
      'currency': p['currency'] ?? 'USD',
      'base_fee': p['base_fee']?.toString() ?? '', 'per_km_fee': p['per_km_fee']?.toString() ?? '',
      'min_fee': p['min_fee']?.toString() ?? '', 'free_delivery_above': p['free_delivery_above']?.toString() ?? '',
      'weight_tiers_json': jsonEncode(p['weight_tiers'] ?? []),
      'distance_discounts_json': jsonEncode(p['distance_discounts'] ?? []),
      'rate_notes': p['rate_notes'] ?? '',
      'vehicle_photo': p['vehicle_photo'] ?? '', 'plate_photo': p['plate_photo'] ?? '',
      'selfie_photo': p['selfie_photo'] ?? '', 'license_photo': p['license_photo'] ?? '',
      'insurance_photo': p['insurance_photo'] ?? '', 'bio': p['bio'] ?? '',
      'offers_supplier_partnerships': p['offers_supplier_partnerships'] ?? true,
      'active': p['active'] ?? true,
    };
    setState(() => _loading = false);
  }
  Future<void> _save() async {
    final u = supabase.auth.currentUser; if (u == null) return;
    if ((f['phone'] as String).trim().isEmpty) return _t('Phone is required');
    if ((f['vehicle_photo'] as String).isEmpty) return _t('Add a photo of your vehicle');
    List weightTiers = []; List distanceDiscounts = [];
    try { weightTiers = jsonDecode(f['weight_tiers_json']); } catch (_) { return _t('Weight tiers must be valid JSON'); }
    try { distanceDiscounts = jsonDecode(f['distance_discounts_json']); } catch (_) { return _t('Distance discounts must be valid JSON'); }
    setState(() => _busy = true);
    final payload = {
      'user_id': u.id,
      'display_name': _n(f['display_name']), 'company_name': _n(f['company_name']),
      'phone': f['phone'], 'whatsapp': _n(f['whatsapp']), 'email': _n(f['email']),
      'vehicle_type': f['vehicle_type'], 'vehicle_make': _n(f['vehicle_make']),
      'vehicle_model': _n(f['vehicle_model']), 'vehicle_plate': _n(f['vehicle_plate']),
      'max_weight_kg': num.tryParse('${f['max_weight_kg']}'),
      'max_volume_m3': num.tryParse('${f['max_volume_m3']}'),
      'service_areas': (f['service_areas'] as String).split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      'city': _n(f['city']), 'country': _n(f['country']), 'currency': f['currency'],
      'base_fee': num.tryParse('${f['base_fee']}'), 'per_km_fee': num.tryParse('${f['per_km_fee']}'),
      'min_fee': num.tryParse('${f['min_fee']}'), 'free_delivery_above': num.tryParse('${f['free_delivery_above']}'),
      'weight_tiers': weightTiers, 'distance_discounts': distanceDiscounts,
      'rate_notes': _n(f['rate_notes']),
      'vehicle_photo': _n(f['vehicle_photo']), 'plate_photo': _n(f['plate_photo']),
      'selfie_photo': _n(f['selfie_photo']), 'license_photo': _n(f['license_photo']),
      'insurance_photo': _n(f['insurance_photo']), 'bio': _n(f['bio']),
      'offers_supplier_partnerships': f['offers_supplier_partnerships'], 'active': f['active'],
    };
    try {
      if (_profile != null) { await supabase.from('courier_profiles').update(payload).eq('user_id', u.id); }
      else { await supabase.from('courier_profiles').insert(payload); }
      _t('Courier profile saved');
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  dynamic _n(dynamic v) => (v == null || v == '') ? null : v;
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _Section('Contact'),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Display name', initial: f['display_name'], onChanged: (v) => f['display_name'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Company', initial: f['company_name'], onChanged: (v) => f['company_name'] = v)),
        ]),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Phone *', initial: f['phone'], onChanged: (v) => f['phone'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['whatsapp'], onChanged: (v) => f['whatsapp'] = v)),
        ]),
        LabeledInput(label: 'Email', initial: f['email'], onChanged: (v) => f['email'] = v),
        Row(children: [
          Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
        ]),
        LabeledInput(label: 'Service areas (comma-separated)', initial: f['service_areas'], onChanged: (v) => f['service_areas'] = v),
        _Section('Vehicle & capacity'),
        LabeledSelect<String>(label: 'Vehicle type', value: f['vehicle_type'], options: const ['bike','car','van','truck','refrigerated_truck'], onChanged: (v) => setState(() => f['vehicle_type'] = v)),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Make', initial: f['vehicle_make'], onChanged: (v) => f['vehicle_make'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Model', initial: f['vehicle_model'], onChanged: (v) => f['vehicle_model'] = v)),
        ]),
        LabeledInput(label: 'Number plate', initial: f['vehicle_plate'], onChanged: (v) => f['vehicle_plate'] = v.toUpperCase()),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Max weight (kg)', initial: f['max_weight_kg'], keyboardType: TextInputType.number, onChanged: (v) => f['max_weight_kg'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Max volume (m³)', initial: f['max_volume_m3'], keyboardType: TextInputType.number, onChanged: (v) => f['max_volume_m3'] = v)),
        ]),
        _Section('Pricing'),
        Row(children: [
          Expanded(child: LabeledSelect<String>(label: 'Currency', value: f['currency'], options: const ['USD','ZWL','ZAR','EUR','GBP','BWP','ZMW'], onChanged: (v) => setState(() => f['currency'] = v))),
          const SizedBox(width: 6),
          Expanded(child: LabeledInput(label: 'Base', initial: f['base_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['base_fee'] = v)),
          const SizedBox(width: 6),
          Expanded(child: LabeledInput(label: 'Per km', initial: f['per_km_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['per_km_fee'] = v)),
        ]),
        Row(children: [
          Expanded(child: LabeledInput(label: 'Minimum fee', initial: f['min_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['min_fee'] = v)),
          const SizedBox(width: 8),
          Expanded(child: LabeledInput(label: 'Free over (subtotal)', initial: f['free_delivery_above'], keyboardType: TextInputType.number, onChanged: (v) => f['free_delivery_above'] = v)),
        ]),
        LabeledInput(label: 'Weight tiers JSON', initial: f['weight_tiers_json'], maxLines: 4, onChanged: (v) => f['weight_tiers_json'] = v),
        LabeledInput(label: 'Distance discounts JSON', initial: f['distance_discounts_json'], maxLines: 3, onChanged: (v) => f['distance_discounts_json'] = v),
        LabeledInput(label: 'Rate notes', initial: f['rate_notes'], maxLines: 3, onChanged: (v) => f['rate_notes'] = v),
        _Section('Documents'),
        CoverPickerField(label: 'Vehicle photo *', value: f['vehicle_photo'], folder: 'courier', onChanged: (v) => setState(() => f['vehicle_photo'] = v ?? '')),
        CoverPickerField(label: 'Plate photo', value: f['plate_photo'], folder: 'courier', onChanged: (v) => setState(() => f['plate_photo'] = v ?? '')),
        CoverPickerField(label: 'Selfie', value: f['selfie_photo'], folder: 'courier', onChanged: (v) => setState(() => f['selfie_photo'] = v ?? '')),
        CoverPickerField(label: 'License', value: f['license_photo'], folder: 'courier', onChanged: (v) => setState(() => f['license_photo'] = v ?? '')),
        CoverPickerField(label: 'Insurance', value: f['insurance_photo'], folder: 'courier', onChanged: (v) => setState(() => f['insurance_photo'] = v ?? '')),
        LabeledInput(label: 'Bio', initial: f['bio'], maxLines: 3, onChanged: (v) => f['bio'] = v),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Open to supplier partnerships'), value: f['offers_supplier_partnerships'] as bool, onChanged: (v) => setState(() => f['offers_supplier_partnerships'] = v)),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Available for jobs'), value: f['active'] as bool, onChanged: (v) => setState(() => f['active'] = v)),
        FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save courier profile')),
      ]),
    );
  }
}

// ============================================================================
// FINANCE
// ============================================================================
class FinanceServiceView extends StatefulWidget { const FinanceServiceView({super.key}); @override State<FinanceServiceView> createState() => _FinanceState(); }
class _FinanceState extends _MyListState<FinanceServiceView> {
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    final u = supabase.auth.currentUser; if (u == null) return [];
    final r = await supabase.from('finance_products').select().eq('owner_user_id', u.id).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final uid = supabase.auth.currentUser?.id; if (uid == null) return const _NeedAuth();
    return ServiceShell(
      title: '${_items.length} products listed', items: _items, isLoading: false,
      emptyHint: 'List loans, vehicle financing, working capital or insurance products.',
      onAdd: () async => showFormSheet(context, title: 'New finance product', child: _FinanceForm(userId: uid, onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (p) => serviceRow(
        cover: p['cover'] as String?, title: '${p['title'] ?? ''}',
        subtitle: '${(p['kind'] ?? '').toString().replaceAll('_',' ')} · ${p['provider_name'] ?? '—'}',
        trailingText: p['interest_rate'] != null ? '${p['interest_rate']}% APR' : null,
        onEdit: () async => showFormSheet(context, title: 'Edit finance product', child: _FinanceForm(userId: uid, initial: p, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this product?')) { await supabase.from('finance_products').delete().eq('id', p['id']); refresh(); } },
      ),
    );
  }
}
class _FinanceForm extends StatefulWidget {
  final String userId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _FinanceForm({required this.userId, this.initial, required this.onSaved});
  @override State<_FinanceForm> createState() => _FinanceFormState();
}
class _FinanceFormState extends State<_FinanceForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'kind': i?['kind'] ?? 'loan',
    'provider_name': i?['provider_name'] ?? '', 'description': i?['description'] ?? '',
    'min_amount': i?['min_amount']?.toString() ?? '', 'max_amount': i?['max_amount']?.toString() ?? '',
    'interest_rate': i?['interest_rate']?.toString() ?? '', 'term_months': i?['term_months']?.toString() ?? '',
    'cover': i?['cover'] ?? '',
    'contact_phone': i?['contact_phone'] ?? '', 'contact_whatsapp': i?['contact_whatsapp'] ?? '',
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _t('Title required');
    setState(() => _busy = true);
    final payload = {
      'owner_user_id': widget.userId, 'title': (f['title'] as String).trim(),
      'kind': f['kind'], 'provider_name': _n(f['provider_name']), 'description': _n(f['description']),
      'min_amount': num.tryParse('${f['min_amount']}'), 'max_amount': num.tryParse('${f['max_amount']}'),
      'interest_rate': num.tryParse('${f['interest_rate']}'), 'term_months': int.tryParse('${f['term_months']}'),
      'cover': _n(f['cover']), 'contact_phone': _n(f['contact_phone']), 'contact_whatsapp': _n(f['contact_whatsapp']),
    };
    try {
      if (widget.initial?['id'] != null) { await supabase.from('finance_products').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('finance_products').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  dynamic _n(dynamic v) => (v == null || v == '') ? null : v;
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    CoverPickerField(label: 'Cover image', value: f['cover'], folder: 'finance', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
    LabeledSelect<String>(label: 'Kind', value: f['kind'], options: const ['loan','vehicle_financing','working_capital','insurance'], onChanged: (v) => setState(() => f['kind'] = v), labelFor: (k) => k.replaceAll('_',' ')),
    LabeledInput(label: 'Provider name', initial: f['provider_name'], onChanged: (v) => f['provider_name'] = v),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 3, onChanged: (v) => f['description'] = v),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Min amount (\$)', initial: f['min_amount'], keyboardType: TextInputType.number, onChanged: (v) => f['min_amount'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Max amount (\$)', initial: f['max_amount'], keyboardType: TextInputType.number, onChanged: (v) => f['max_amount'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'APR (%)', initial: f['interest_rate'], keyboardType: TextInputType.number, onChanged: (v) => f['interest_rate'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Term (months)', initial: f['term_months'], keyboardType: TextInputType.number, onChanged: (v) => f['term_months'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Phone', initial: f['contact_phone'], onChanged: (v) => f['contact_phone'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['contact_whatsapp'], onChanged: (v) => f['contact_whatsapp'] = v)),
    ]),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save product')),
  ]);
}

// ============================================================================
// CAR RENTALS
// ============================================================================
class CarRentalServiceView extends StatefulWidget { const CarRentalServiceView({super.key}); @override State<CarRentalServiceView> createState() => _CarRentalState(); }
class _CarRentalState extends _MyListState<CarRentalServiceView> {
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    final u = supabase.auth.currentUser; if (u == null) return [];
    final r = await supabase.from('car_rentals').select().eq('owner_user_id', u.id).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final uid = supabase.auth.currentUser?.id; if (uid == null) return const _NeedAuth();
    return ServiceShell(
      title: '${_items.length} rentals listed', items: _items, isLoading: false,
      emptyHint: 'List a self-drive rental — price per day, free mileage, rules, penalties.',
      onAdd: () async => showFormSheet(context, title: 'List a car for rent', child: _CarRentalForm(userId: uid, onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (p) => serviceRow(
        cover: p['cover'] as String?, title: '${p['title'] ?? ''}',
        subtitle: '${p['vehicle_class'] ?? ''} · ${p['transmission'] ?? ''} · ${p['seats'] ?? ''} seats',
        trailingText: '\$${p['price_per_day']}/day · ${p['unlimited_km'] == true ? 'Unlimited km' : '${p['free_km_per_day']}km/day'}',
        onEdit: () async => showFormSheet(context, title: 'Edit car rental', child: _CarRentalForm(userId: uid, initial: p, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this rental?')) { await supabase.from('car_rentals').delete().eq('id', p['id']); refresh(); } },
      ),
    );
  }
}
class _CarRentalForm extends StatefulWidget {
  final String userId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _CarRentalForm({required this.userId, this.initial, required this.onSaved});
  @override State<_CarRentalForm> createState() => _CarRentalFormState();
}
class _CarRentalFormState extends State<_CarRentalForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'make': i?['make'] ?? '', 'model': i?['model'] ?? '',
    'year': i?['year']?.toString() ?? '', 'vehicle_class': i?['vehicle_class'] ?? 'economy',
    'transmission': i?['transmission'] ?? 'automatic', 'fuel': i?['fuel'] ?? 'petrol',
    'seats': i?['seats'] ?? 5, 'cover': i?['cover'] ?? '', 'description': i?['description'] ?? '',
    'price_per_day': i?['price_per_day']?.toString() ?? '',
    'price_per_week': i?['price_per_week']?.toString() ?? '',
    'price_per_month': i?['price_per_month']?.toString() ?? '',
    'weekend_surcharge_pct': i?['weekend_surcharge_pct']?.toString() ?? '',
    'deposit': i?['deposit'] ?? 0,
    'free_km_per_day': i?['free_km_per_day'] ?? 200, 'unlimited_km': i?['unlimited_km'] ?? false,
    'extra_km_fee': i?['extra_km_fee']?.toString() ?? '',
    'min_age': i?['min_age'] ?? 21, 'max_age': i?['max_age']?.toString() ?? '',
    'min_license_years': i?['min_license_years'] ?? 1,
    'young_driver_age_threshold': i?['young_driver_age_threshold'] ?? 25,
    'young_driver_fee': i?['young_driver_fee']?.toString() ?? '',
    'international_license_ok': i?['international_license_ok'] ?? true,
    'cross_border_allowed': i?['cross_border_allowed'] ?? false,
    'cross_border_fee': i?['cross_border_fee']?.toString() ?? '',
    'cross_border_countries': (i?['cross_border_countries'] as List?)?.join(', ') ?? '',
    'required_documents': (i?['required_documents'] as List?)?.join(', ') ?? 'national_id, drivers_license',
    'min_rental_days': i?['min_rental_days'] ?? 1,
    'max_rental_days': i?['max_rental_days']?.toString() ?? '',
    'advance_booking_hours': i?['advance_booking_hours'] ?? 4,
    'pickup_locations': (i?['pickup_locations'] as List?)?.join(', ') ?? '',
    'delivery_available': i?['delivery_available'] ?? false,
    'delivery_fee': i?['delivery_fee']?.toString() ?? '',
    'fuel_policy': i?['fuel_policy'] ?? 'full_to_full',
    'smoking_allowed': i?['smoking_allowed'] ?? false,
    'pets_allowed': i?['pets_allowed'] ?? false,
    'late_return_fee_per_hour': i?['late_return_fee_per_hour']?.toString() ?? '',
    'cleaning_fee': i?['cleaning_fee']?.toString() ?? '',
    'smoking_penalty': i?['smoking_penalty']?.toString() ?? '',
    'pet_penalty': i?['pet_penalty']?.toString() ?? '',
    'damage_excess': i?['damage_excess']?.toString() ?? '',
    'cancellation_policy': i?['cancellation_policy'] ?? 'flexible',
    'cancellation_fee': i?['cancellation_fee']?.toString() ?? '',
    'custom_rules': (i?['custom_rules'] as List?)?.join('\n') ?? '',
    'custom_penalties_json': jsonEncode(i?['custom_penalties'] ?? []),
    'insurance_included': i?['insurance_included'] ?? true,
    'insurance_provider': i?['insurance_provider'] ?? '',
    'features': (i?['features'] as List?)?.join(', ') ?? '',
    'city': i?['city'] ?? '', 'country': i?['country'] ?? '',
    'contact_phone': i?['contact_phone'] ?? '', 'contact_whatsapp': i?['contact_whatsapp'] ?? '',
  }; }
  List<String> _split(String s) => s.split(RegExp(r'[,\n]')).map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _t('Title required');
    if ((f['price_per_day'] as String).isEmpty) return _t('Price per day required');
    List customPenalties = [];
    try { customPenalties = jsonDecode(f['custom_penalties_json']); } catch (_) { return _t('Custom penalties must be valid JSON'); }
    setState(() => _busy = true);
    final payload = {
      'owner_user_id': widget.userId, 'title': (f['title'] as String).trim(),
      'make': _n(f['make']), 'model': _n(f['model']), 'year': int.tryParse('${f['year']}'),
      'vehicle_class': f['vehicle_class'], 'transmission': f['transmission'], 'fuel': f['fuel'],
      'seats': int.tryParse('${f['seats']}') ?? 5, 'cover': _n(f['cover']), 'description': _n(f['description']),
      'price_per_day': num.tryParse('${f['price_per_day']}') ?? 0,
      'price_per_week': num.tryParse('${f['price_per_week']}'),
      'price_per_month': num.tryParse('${f['price_per_month']}'),
      'weekend_surcharge_pct': num.tryParse('${f['weekend_surcharge_pct']}'),
      'deposit': num.tryParse('${f['deposit']}') ?? 0,
      'free_km_per_day': int.tryParse('${f['free_km_per_day']}') ?? 0,
      'unlimited_km': f['unlimited_km'],
      'extra_km_fee': num.tryParse('${f['extra_km_fee']}'),
      'min_age': int.tryParse('${f['min_age']}') ?? 21,
      'max_age': int.tryParse('${f['max_age']}'),
      'min_license_years': int.tryParse('${f['min_license_years']}') ?? 1,
      'young_driver_age_threshold': int.tryParse('${f['young_driver_age_threshold']}'),
      'young_driver_fee': num.tryParse('${f['young_driver_fee']}'),
      'international_license_ok': f['international_license_ok'],
      'cross_border_allowed': f['cross_border_allowed'],
      'cross_border_fee': num.tryParse('${f['cross_border_fee']}'),
      'cross_border_countries': _split(f['cross_border_countries']),
      'required_documents': _split(f['required_documents']),
      'min_rental_days': int.tryParse('${f['min_rental_days']}') ?? 1,
      'max_rental_days': int.tryParse('${f['max_rental_days']}'),
      'advance_booking_hours': int.tryParse('${f['advance_booking_hours']}') ?? 0,
      'pickup_locations': _split(f['pickup_locations']),
      'delivery_available': f['delivery_available'],
      'delivery_fee': num.tryParse('${f['delivery_fee']}'),
      'fuel_policy': f['fuel_policy'],
      'smoking_allowed': f['smoking_allowed'], 'pets_allowed': f['pets_allowed'],
      'late_return_fee_per_hour': num.tryParse('${f['late_return_fee_per_hour']}'),
      'cleaning_fee': num.tryParse('${f['cleaning_fee']}'),
      'smoking_penalty': num.tryParse('${f['smoking_penalty']}'),
      'pet_penalty': num.tryParse('${f['pet_penalty']}'),
      'damage_excess': num.tryParse('${f['damage_excess']}'),
      'cancellation_policy': f['cancellation_policy'],
      'cancellation_fee': num.tryParse('${f['cancellation_fee']}'),
      'custom_rules': _split(f['custom_rules']),
      'custom_penalties': customPenalties,
      'insurance_included': f['insurance_included'],
      'insurance_provider': _n(f['insurance_provider']),
      'features': _split(f['features']),
      'city': _n(f['city']), 'country': _n(f['country']),
      'contact_phone': _n(f['contact_phone']), 'contact_whatsapp': _n(f['contact_whatsapp']),
    };
    try {
      if (widget.initial?['id'] != null) { await supabase.from('car_rentals').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('car_rentals').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  dynamic _n(dynamic v) => (v == null || v == '') ? null : v;
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'car-rentals', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
    _Section('Vehicle'),
    LabeledInput(label: 'Listing title', initial: f['title'], onChanged: (v) => f['title'] = v),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Make', initial: f['make'], onChanged: (v) => f['make'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Model', initial: f['model'], onChanged: (v) => f['model'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Year', initial: f['year'], keyboardType: TextInputType.number, onChanged: (v) => f['year'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Seats', initial: '${f['seats']}', keyboardType: TextInputType.number, onChanged: (v) => f['seats'] = int.tryParse(v) ?? 5)),
      const SizedBox(width: 6),
      Expanded(child: LabeledSelect<String>(label: 'Class', value: f['vehicle_class'], options: const ['economy','compact','midsize','suv','luxury','van','pickup','sports'], onChanged: (v) => setState(() => f['vehicle_class'] = v))),
    ]),
    Row(children: [
      Expanded(child: LabeledSelect<String>(label: 'Trans.', value: f['transmission'], options: const ['automatic','manual','cvt','dct'], onChanged: (v) => setState(() => f['transmission'] = v))),
      const SizedBox(width: 8),
      Expanded(child: LabeledSelect<String>(label: 'Fuel', value: f['fuel'], options: const ['petrol','diesel','hybrid','electric','lpg'], onChanged: (v) => setState(() => f['fuel'] = v))),
    ]),
    LabeledInput(label: 'Description', initial: f['description'], maxLines: 3, onChanged: (v) => f['description'] = v),
    _Section('Pricing'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Per day (\$) *', initial: f['price_per_day'], keyboardType: TextInputType.number, onChanged: (v) => f['price_per_day'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Per week', initial: f['price_per_week'], keyboardType: TextInputType.number, onChanged: (v) => f['price_per_week'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Per month', initial: f['price_per_month'], keyboardType: TextInputType.number, onChanged: (v) => f['price_per_month'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Weekend surcharge %', initial: f['weekend_surcharge_pct'], keyboardType: TextInputType.number, onChanged: (v) => f['weekend_surcharge_pct'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Deposit (\$)', initial: '${f['deposit']}', keyboardType: TextInputType.number, onChanged: (v) => f['deposit'] = num.tryParse(v) ?? 0)),
    ]),
    _Section('Mileage'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Free km / day', initial: '${f['free_km_per_day']}', keyboardType: TextInputType.number, onChanged: (v) => f['free_km_per_day'] = int.tryParse(v) ?? 0)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Extra km fee', initial: f['extra_km_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['extra_km_fee'] = v)),
    ]),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Unlimited km'), value: f['unlimited_km'] as bool, onChanged: (v) => setState(() => f['unlimited_km'] = v)),
    _Section('Eligibility'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Min age', initial: '${f['min_age']}', keyboardType: TextInputType.number, onChanged: (v) => f['min_age'] = int.tryParse(v) ?? 21)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Max age', initial: f['max_age'], keyboardType: TextInputType.number, onChanged: (v) => f['max_age'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Min license yrs', initial: '${f['min_license_years']}', keyboardType: TextInputType.number, onChanged: (v) => f['min_license_years'] = int.tryParse(v) ?? 1)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Young driver age', initial: '${f['young_driver_age_threshold']}', keyboardType: TextInputType.number, onChanged: (v) => f['young_driver_age_threshold'] = int.tryParse(v) ?? 25)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Young driver fee', initial: f['young_driver_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['young_driver_fee'] = v)),
    ]),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('International license OK'), value: f['international_license_ok'] as bool, onChanged: (v) => setState(() => f['international_license_ok'] = v)),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Cross-border allowed'), value: f['cross_border_allowed'] as bool, onChanged: (v) => setState(() => f['cross_border_allowed'] = v)),
    LabeledInput(label: 'Cross-border fee', initial: f['cross_border_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['cross_border_fee'] = v),
    LabeledInput(label: 'Cross-border countries (comma)', initial: f['cross_border_countries'], onChanged: (v) => f['cross_border_countries'] = v),
    LabeledInput(label: 'Required documents (comma)', initial: f['required_documents'], onChanged: (v) => f['required_documents'] = v),
    _Section('Booking'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Min rental days', initial: '${f['min_rental_days']}', keyboardType: TextInputType.number, onChanged: (v) => f['min_rental_days'] = int.tryParse(v) ?? 1)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Max rental days', initial: f['max_rental_days'], keyboardType: TextInputType.number, onChanged: (v) => f['max_rental_days'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Advance hrs', initial: '${f['advance_booking_hours']}', keyboardType: TextInputType.number, onChanged: (v) => f['advance_booking_hours'] = int.tryParse(v) ?? 4)),
    ]),
    LabeledInput(label: 'Pickup locations (comma)', initial: f['pickup_locations'], onChanged: (v) => f['pickup_locations'] = v),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Delivery available'), value: f['delivery_available'] as bool, onChanged: (v) => setState(() => f['delivery_available'] = v)),
    LabeledInput(label: 'Delivery fee', initial: f['delivery_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['delivery_fee'] = v),
    LabeledSelect<String>(label: 'Fuel policy', value: f['fuel_policy'], options: const ['full_to_full','same_to_same','prepaid'], onChanged: (v) => setState(() => f['fuel_policy'] = v)),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Smoking allowed'), value: f['smoking_allowed'] as bool, onChanged: (v) => setState(() => f['smoking_allowed'] = v)),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Pets allowed'), value: f['pets_allowed'] as bool, onChanged: (v) => setState(() => f['pets_allowed'] = v)),
    _Section('Penalties'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Late return / hr', initial: f['late_return_fee_per_hour'], keyboardType: TextInputType.number, onChanged: (v) => f['late_return_fee_per_hour'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Cleaning fee', initial: f['cleaning_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['cleaning_fee'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Smoking penalty', initial: f['smoking_penalty'], keyboardType: TextInputType.number, onChanged: (v) => f['smoking_penalty'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Pet penalty', initial: f['pet_penalty'], keyboardType: TextInputType.number, onChanged: (v) => f['pet_penalty'] = v)),
      const SizedBox(width: 6),
      Expanded(child: LabeledInput(label: 'Damage excess', initial: f['damage_excess'], keyboardType: TextInputType.number, onChanged: (v) => f['damage_excess'] = v)),
    ]),
    LabeledSelect<String>(label: 'Cancellation policy', value: f['cancellation_policy'], options: const ['flexible','moderate','strict'], onChanged: (v) => setState(() => f['cancellation_policy'] = v)),
    LabeledInput(label: 'Cancellation fee', initial: f['cancellation_fee'], keyboardType: TextInputType.number, onChanged: (v) => f['cancellation_fee'] = v),
    LabeledInput(label: 'Custom rules (one per line)', initial: f['custom_rules'], maxLines: 4, onChanged: (v) => f['custom_rules'] = v),
    LabeledInput(label: 'Custom penalties JSON', initial: f['custom_penalties_json'], maxLines: 3, onChanged: (v) => f['custom_penalties_json'] = v),
    _Section('Insurance & features'),
    SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Insurance included'), value: f['insurance_included'] as bool, onChanged: (v) => setState(() => f['insurance_included'] = v)),
    LabeledInput(label: 'Insurance provider', initial: f['insurance_provider'], onChanged: (v) => f['insurance_provider'] = v),
    LabeledInput(label: 'Features (comma)', initial: f['features'], onChanged: (v) => f['features'] = v),
    _Section('Location & contact'),
    Row(children: [
      Expanded(child: LabeledInput(label: 'City', initial: f['city'], onChanged: (v) => f['city'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
    ]),
    Row(children: [
      Expanded(child: LabeledInput(label: 'Phone', initial: f['contact_phone'], onChanged: (v) => f['contact_phone'] = v)),
      const SizedBox(width: 8),
      Expanded(child: LabeledInput(label: 'WhatsApp', initial: f['contact_whatsapp'], onChanged: (v) => f['contact_whatsapp'] = v)),
    ]),
    FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Save listing')),
  ]);
}

// ============================================================================
// AGRO
// ============================================================================
class AgroServiceView extends StatefulWidget { const AgroServiceView({super.key}); @override State<AgroServiceView> createState() => _AgroState(); }
class _AgroState extends _MyListState<AgroServiceView> {
  Map<String, dynamic>? _supplier;
  @override Future<List<Map<String, dynamic>>> loadItems() async {
    _supplier ??= await _fetchMySupplier();
    if (_supplier == null) return [];
    final r = await supabase.from('agro_listings').select().eq('supplier_id', _supplier!['id']).order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(r);
  }
  @override Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_supplier == null) return const _CreateStoreFirst();
    return ServiceShell(
      title: '${_items.length} agro listings', items: _items, isLoading: false,
      emptyHint: 'List produce, machinery, inputs, livestock or co-investment projects.',
      onAdd: () async => showFormSheet(context, title: 'New agro listing', child: _AgroForm(supplierId: _supplier!['id'], onSaved: () { Navigator.pop(context); refresh(); })),
      renderItem: (it) => serviceRow(
        cover: it['cover'] as String?, title: '${it['title'] ?? ''}',
        subtitle: '${it['kind'] ?? ''}${it['subcategory'] != null && it['subcategory'] != '' ? ' · ${it['subcategory']}' : ''}${it['organic'] == true ? ' · organic' : ''}',
        trailingText: it['kind'] == 'project'
            ? 'Goal \$${it['funding_goal'] ?? 0}'
            : (it['price'] != null ? '\$${it['price']}${it['unit'] != null ? ' / ${it['unit']}' : ''}' : 'Quote'),
        onEdit: () async => showFormSheet(context, title: 'Edit agro listing', child: _AgroForm(supplierId: _supplier!['id'], initial: it, onSaved: () { Navigator.pop(context); refresh(); })),
        onDelete: () async { if (await _confirm(context, 'Delete this listing?')) { await supabase.from('agro_listings').delete().eq('id', it['id']); refresh(); } },
      ),
    );
  }
}
class _AgroForm extends StatefulWidget {
  final String supplierId; final Map<String, dynamic>? initial; final VoidCallback onSaved;
  const _AgroForm({required this.supplierId, this.initial, required this.onSaved});
  @override State<_AgroForm> createState() => _AgroFormState();
}
class _AgroFormState extends State<_AgroForm> {
  late Map<String, dynamic> f; bool _busy = false;
  @override void initState() { super.initState(); final i = widget.initial; f = {
    'title': i?['title'] ?? '', 'kind': i?['kind'] ?? 'produce', 'subcategory': i?['subcategory'] ?? '',
    'cover': i?['cover'] ?? '', 'description': i?['description'] ?? '',
    'moq': i?['moq'] ?? 1, 'unit': i?['unit'] ?? 'kg', 'price': i?['price'] ?? 0,
    'harvest_season': i?['harvest_season'] ?? '', 'lead_time': i?['lead_time'] ?? '',
    'capacity': i?['capacity'] ?? '', 'ship_from': i?['ship_from'] ?? '',
    'country': i?['country'] ?? '', 'region': i?['region'] ?? '',
    'organic': i?['organic'] ?? false, 'certifications': (i?['certifications'] as List?)?.join(', ') ?? '',
    'funding_goal': i?['funding_goal'] ?? 0, 'funding_raised': i?['funding_raised'] ?? 0,
    'project_status': i?['project_status'] ?? 'open',
  }; }
  Future<void> _save() async {
    if ((f['title'] as String).trim().isEmpty) return _t('Title required');
    setState(() => _busy = true);
    final isProject = f['kind'] == 'project';
    final payload = {
      'supplier_id': widget.supplierId, 'title': f['title'], 'kind': f['kind'],
      'subcategory': _n(f['subcategory']), 'cover': _n(f['cover']),
      'description': _n(f['description']),
      'moq': int.tryParse('${f['moq']}'), 'unit': _n(f['unit']),
      'price': isProject ? null : (num.tryParse('${f['price']}')),
      'harvest_season': _n(f['harvest_season']), 'lead_time': _n(f['lead_time']),
      'capacity': _n(f['capacity']), 'ship_from': _n(f['ship_from']),
      'country': _n(f['country']), 'region': _n(f['region']),
      'organic': f['organic'] == true,
      'certifications': (f['certifications'] as String).split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      'funding_goal': isProject ? num.tryParse('${f['funding_goal']}') : null,
      'funding_raised': isProject ? (num.tryParse('${f['funding_raised']}') ?? 0) : 0,
      'project_status': isProject ? (f['project_status']) : null,
    };
    try {
      if (widget.initial != null) { await supabase.from('agro_listings').update(payload).eq('id', widget.initial!['id']); }
      else { await supabase.from('agro_listings').insert(payload); }
      widget.onSaved();
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _busy = false); }
  }
  dynamic _n(dynamic v) => (v == null || v == '') ? null : v;
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) {
    final isProject = f['kind'] == 'project';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LabeledInput(label: 'Title', initial: f['title'], onChanged: (v) => f['title'] = v),
      Row(children: [
        Expanded(child: LabeledSelect<String>(label: 'Kind', value: f['kind'], options: const ['produce','equipment','inputs','livestock','services','project'], onChanged: (v) => setState(() => f['kind'] = v))),
        const SizedBox(width: 8),
        Expanded(child: LabeledInput(label: 'Subcategory', initial: f['subcategory'], onChanged: (v) => f['subcategory'] = v)),
      ]),
      CoverPickerField(label: 'Cover photo', value: f['cover'], folder: 'agro', onChanged: (v) => setState(() => f['cover'] = v ?? '')),
      if (!isProject) Row(children: [
        Expanded(child: LabeledInput(label: 'MOQ', initial: '${f['moq']}', keyboardType: TextInputType.number, onChanged: (v) => f['moq'] = int.tryParse(v) ?? 1)),
        const SizedBox(width: 6),
        Expanded(child: LabeledInput(label: 'Unit', initial: f['unit'], onChanged: (v) => f['unit'] = v)),
        const SizedBox(width: 6),
        Expanded(child: LabeledInput(label: 'Price (\$)', initial: '${f['price']}', keyboardType: TextInputType.number, onChanged: (v) => f['price'] = num.tryParse(v) ?? 0)),
      ]),
      if (isProject) Row(children: [
        Expanded(child: LabeledInput(label: 'Funding goal (\$)', initial: '${f['funding_goal']}', keyboardType: TextInputType.number, onChanged: (v) => f['funding_goal'] = num.tryParse(v) ?? 0)),
        const SizedBox(width: 6),
        Expanded(child: LabeledInput(label: 'Raised (\$)', initial: '${f['funding_raised']}', keyboardType: TextInputType.number, onChanged: (v) => f['funding_raised'] = num.tryParse(v) ?? 0)),
        const SizedBox(width: 6),
        Expanded(child: LabeledSelect<String>(label: 'Status', value: f['project_status'], options: const ['open','funded','in_progress','closed'], onChanged: (v) => setState(() => f['project_status'] = v))),
      ]),
      Row(children: [
        Expanded(child: LabeledInput(label: 'Harvest season', initial: f['harvest_season'], onChanged: (v) => f['harvest_season'] = v)),
        const SizedBox(width: 8),
        Expanded(child: LabeledInput(label: 'Lead time', initial: f['lead_time'], onChanged: (v) => f['lead_time'] = v)),
      ]),
      Row(children: [
        Expanded(child: LabeledInput(label: 'Capacity', initial: f['capacity'], onChanged: (v) => f['capacity'] = v)),
        const SizedBox(width: 8),
        Expanded(child: LabeledInput(label: 'Ship from', initial: f['ship_from'], onChanged: (v) => f['ship_from'] = v)),
      ]),
      Row(children: [
        Expanded(child: LabeledInput(label: 'Country', initial: f['country'], onChanged: (v) => f['country'] = v)),
        const SizedBox(width: 8),
        Expanded(child: LabeledInput(label: 'Region', initial: f['region'], onChanged: (v) => f['region'] = v)),
      ]),
      LabeledInput(label: 'Certifications (comma)', initial: f['certifications'], onChanged: (v) => f['certifications'] = v),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Organic'), value: f['organic'] as bool, onChanged: (v) => setState(() => f['organic'] = v)),
      LabeledInput(label: 'Description', initial: f['description'], maxLines: 4, onChanged: (v) => f['description'] = v),
      FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Saving…' : 'Publish listing')),
    ]);
  }
}

// ============================================================================
// IMPORT (single URL + bulk with markup) — mirrors ImportView + SingleImport
// + BulkImport in the web app.
// ============================================================================
class ImportServiceView extends StatefulWidget {
  const ImportServiceView({super.key});
  @override State<ImportServiceView> createState() => _ImportState();
}
class _ImportState extends State<ImportServiceView> {
  String _mode = 'single'; // single | bulk
  String _markupMode = 'percent'; // percent | flat | none
  String _markupValue = '30';
  @override Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Mode toggle
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(24)),
          child: Row(children: [
            for (final m in ['single','bulk'])
              Expanded(child: GestureDetector(
                onTap: () => setState(() => _mode = m),
                child: Container(
                  height: 34,
                  decoration: BoxDecoration(
                    color: _mode == m ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: _mode == m ? [const BoxShadow(color: Colors.black12, blurRadius: 4)] : null,
                  ),
                  child: Center(child: Text(m == 'single' ? 'Single URL' : 'Bulk import',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _mode == m ? Colors.black : Colors.grey.shade600))),
                ),
              )),
          ]),
        ),
        const SizedBox(height: 12),
        // Markup card
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Icon(LucideIcons.percent, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              const Text('Auto markup', style: TextStyle(fontWeight: FontWeight.w800)),
              const Spacer(),
              const Text('applied to every price', style: TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(flex: 2, child: DropdownButtonFormField<String>(
                initialValue: _markupMode,
                items: const [
                  DropdownMenuItem(value: 'percent', child: Text('+ %')),
                  DropdownMenuItem(value: 'flat', child: Text('+ flat')),
                  DropdownMenuItem(value: 'none', child: Text('No markup')),
                ],
                onChanged: (v) => setState(() => _markupMode = v ?? 'percent'),
                decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10), border: OutlineInputBorder()),
              )),
              const SizedBox(width: 8),
              Expanded(flex: 3, child: TextFormField(
                initialValue: _markupValue,
                enabled: _markupMode != 'none',
                keyboardType: TextInputType.number,
                onChanged: (v) => _markupValue = v,
                decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10), border: OutlineInputBorder()),
              )),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        _mode == 'single'
            ? _SingleImportPanel(markupMode: _markupMode, markupValue: num.tryParse(_markupValue) ?? 0)
            : _BulkImportPanel(markupMode: _markupMode, markupValue: num.tryParse(_markupValue) ?? 0),
      ]),
    );
  }
}

num _applyMarkup(num price, String mode, num value) {
  if (mode == 'percent') return price * (1 + value / 100);
  if (mode == 'flat') return price + value;
  return price;
}

class _SingleImportPanel extends StatefulWidget {
  final String markupMode; final num markupValue;
  const _SingleImportPanel({required this.markupMode, required this.markupValue});
  @override State<_SingleImportPanel> createState() => _SingleImportPanelState();
}
class _SingleImportPanelState extends State<_SingleImportPanel> {
  final TextEditingController _url = TextEditingController();
  bool _loading = false; bool _saving = false;
  Map<String, dynamic>? _preview;
  Future<void> _fetch() async {
    if (_url.text.trim().isEmpty) return _t('Paste a product URL');
    setState(() { _loading = true; _preview = null; });
    try {
      final res = await supabase.functions.invoke('import-product', body: {'url': _url.text.trim()});
      final data = res.data as Map<String, dynamic>?;
      final p = (data?['product'] as Map<String, dynamic>?);
      if (p == null) throw 'Nothing returned';
      p['original_price'] = p['price'];
      if (p['price'] is num) p['price'] = _applyMarkup(p['price'] as num, widget.markupMode, widget.markupValue);
      setState(() => _preview = p);
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _loading = false); }
  }
  Future<void> _save() async {
    final p = _preview; if (p == null) return;
    if ('${p['title'] ?? ''}'.trim().isEmpty) return _t('Title required');
    if (p['price'] == null) return _t('Price required');
    setState(() => _saving = true);
    try {
      final u = supabase.auth.currentUser; if (u == null) return _t('Sign in first');
      final supplier = await _fetchMySupplier();
      if (supplier == null) return _t('Create your store first');
      await supabase.from('products').insert({
        'supplier_id': supplier['id'],
        'title': '${p['title']}'.trim(),
        'description': p['description'],
        'image': (p['images'] as List?)?.isNotEmpty == true ? (p['images'] as List).first : null,
        'gallery': p['images'] ?? [],
        'price': num.tryParse('${p['price']}') ?? 0,
        'original_price': p['original_price'],
        'moq': p['moq'] ?? 1,
        'unit': p['unit'] ?? 'piece',
        'category_slug': p['category_slug'],
        'ship_from': supplier['country'],
        'active': true,
      });
      _t('Product imported 🎉');
      setState(() { _preview = null; _url.clear(); });
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _saving = false); }
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(LucideIcons.sparkles, size: 16, color: AppColors.primary), SizedBox(width: 6),
            Text('Paste a product link', style: TextStyle(fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(
              controller: _url,
              decoration: const InputDecoration(hintText: 'https://www.alibaba.com/product-detail/…', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12), border: OutlineInputBorder()),
              onSubmitted: (_) => _fetch(),
            )),
            const SizedBox(width: 8),
            FilledButton.icon(onPressed: _loading ? null : _fetch, icon: _loading ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.download, size: 16), label: const Text('Fetch')),
          ]),
        ]),
      ),
      if (_preview != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if ((_preview!['images'] as List?)?.isNotEmpty == true)
              SizedBox(height: 90, child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: ((_preview!['images'] as List).length).clamp(0, 6),
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) => ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network('${(_preview!['images'] as List)[i]}', width: 90, height: 90, fit: BoxFit.cover)),
              )),
            const SizedBox(height: 10),
            LabeledInput(label: 'Title', initial: '${_preview!['title'] ?? ''}', onChanged: (v) => _preview!['title'] = v),
            Row(children: [
              Expanded(child: LabeledInput(label: 'Price', initial: '${_preview!['price'] ?? ''}', keyboardType: TextInputType.number, onChanged: (v) => _preview!['price'] = num.tryParse(v))),
              const SizedBox(width: 8),
              Expanded(child: LabeledInput(label: 'Original', initial: '${_preview!['original_price'] ?? ''}', keyboardType: TextInputType.number, onChanged: (v) => _preview!['original_price'] = num.tryParse(v))),
            ]),
            Row(children: [
              Expanded(child: LabeledInput(label: 'MOQ', initial: '${_preview!['moq'] ?? 1}', keyboardType: TextInputType.number, onChanged: (v) => _preview!['moq'] = int.tryParse(v) ?? 1)),
              const SizedBox(width: 8),
              Expanded(child: LabeledInput(label: 'Unit', initial: '${_preview!['unit'] ?? 'piece'}', onChanged: (v) => _preview!['unit'] = v)),
            ]),
            LabeledInput(label: 'Category slug', initial: '${_preview!['category_slug'] ?? ''}', onChanged: (v) => _preview!['category_slug'] = v.isEmpty ? null : v),
            LabeledInput(label: 'Description', initial: '${_preview!['description'] ?? ''}', maxLines: 5, onChanged: (v) => _preview!['description'] = v),
            Text('Source: ${_preview!['source'] ?? ''}  ·  ${_preview!['source_url'] ?? ''}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
            const SizedBox(height: 8),
            FilledButton.icon(onPressed: _saving ? null : _save, icon: const Icon(LucideIcons.plus, size: 16), label: Text(_saving ? 'Importing…' : 'Import to my store')),
          ]),
        ),
      ],
    ]);
  }
}

class _BulkImportPanel extends StatefulWidget {
  final String markupMode; final num markupValue;
  const _BulkImportPanel({required this.markupMode, required this.markupValue});
  @override State<_BulkImportPanel> createState() => _BulkImportPanelState();
}
class _BulkImportPanelState extends State<_BulkImportPanel> {
  final TextEditingController _url = TextEditingController();
  bool _loading = false; bool _running = false;
  List<Map<String, dynamic>> _items = [];
  int _done = 0;
  Future<void> _list() async {
    if (_url.text.trim().isEmpty) return _t('Paste a collection / seller URL');
    setState(() { _loading = true; _items = []; _done = 0; });
    try {
      final res = await supabase.functions.invoke('import-list', body: {'url': _url.text.trim(), 'limit': 40});
      final raw = (res.data as Map<String, dynamic>?)?['items'] as List? ?? [];
      _items = List<Map<String, dynamic>>.from(raw.map((r) => {...r as Map, 'status': 'pending'}));
      if (_items.isEmpty) _t('No products found on that page');
      setState(() {});
    } catch (e) { _t('$e'); } finally { if (mounted) setState(() => _loading = false); }
  }
  Future<void> _importAll() async {
    final supplier = await _fetchMySupplier();
    if (supplier == null) return _t('Create your store first');
    setState(() { _running = true; _done = 0; });
    for (var i = 0; i < _items.length; i++) {
      final it = _items[i];
      if (it['status'] == 'skipped' || it['status'] == 'done') continue;
      try {
        final res = await supabase.functions.invoke('import-product', body: {'url': it['url']});
        final p = (res.data as Map<String, dynamic>?)?['product'] as Map<String, dynamic>?;
        if (p == null) throw 'No product returned';
        final priced = p['price'] is num ? _applyMarkup(p['price'] as num, widget.markupMode, widget.markupValue) : p['price'];
        await supabase.from('products').insert({
          'supplier_id': supplier['id'],
          'title': '${p['title'] ?? it['title']}',
          'description': p['description'],
          'image': (p['images'] as List?)?.isNotEmpty == true ? (p['images'] as List).first : it['image'],
          'gallery': p['images'] ?? [],
          'price': num.tryParse('${priced ?? 0}') ?? 0,
          'original_price': p['price'],
          'moq': p['moq'] ?? 1,
          'unit': p['unit'] ?? 'piece',
          'category_slug': p['category_slug'],
          'ship_from': supplier['country'],
          'active': true,
        });
        _items[i]['status'] = 'done';
      } catch (e) {
        _items[i]['status'] = 'error';
        _items[i]['error'] = '$e';
      }
      if (mounted) setState(() => _done++);
    }
    if (mounted) setState(() => _running = false);
    _t('Import finished');
  }
  void _toggleSkip(int idx) {
    setState(() { _items[idx]['status'] = _items[idx]['status'] == 'skipped' ? 'pending' : 'skipped'; });
  }
  void _t(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  @override Widget build(BuildContext c) {
    final pending = _items.where((i) => i['status'] == 'pending').length;
    final done = _items.where((i) => i['status'] == 'done').length;
    final errors = _items.where((i) => i['status'] == 'error').length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(LucideIcons.download, size: 16, color: AppColors.primary), SizedBox(width: 6),
            Text('Paste a collection or seller page', style: TextStyle(fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(
              controller: _url,
              decoration: const InputDecoration(hintText: 'https://yourstore.com/collections/all', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12), border: OutlineInputBorder()),
              enabled: !_running,
              onSubmitted: (_) => _list(),
            )),
            const SizedBox(width: 8),
            FilledButton.icon(onPressed: (_loading || _running) ? null : _list, icon: _loading ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.download, size: 16), label: const Text('List')),
          ]),
        ]),
      ),
      if (_items.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(
                _running ? 'Importing $_done/${_items.length}…' :
                (done > 0 ? 'Done · $done imported${errors > 0 ? ', $errors errored' : ''}' : '$pending selected of ${_items.length}'),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
              )),
              FilledButton.icon(
                onPressed: (_running || pending == 0) ? null : _importAll,
                icon: _running ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(LucideIcons.plus, size: 14),
                label: Text(_running ? 'Running' : 'Import $pending'),
              ),
            ]),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: _items.isEmpty ? 0 : _done / _items.length, minHeight: 4),
          ]),
        ),
        const SizedBox(height: 8),
        ...List.generate(_items.length, (idx) {
          final it = _items[idx];
          final skipped = it['status'] == 'skipped';
          return Opacity(
            opacity: skipped ? 0.5 : 1,
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(border: Border.all(color: Colors.black12), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: Colors.grey.shade100,
                    image: it['image'] != null ? DecorationImage(image: NetworkImage('${it['image']}'), fit: BoxFit.cover) : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${it['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  Text('${it['price'] ?? ''} · ${it['status']}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                  if (it['error'] != null) Text('${it['error']}', style: const TextStyle(fontSize: 10, color: Colors.red)),
                ])),
                IconButton(
                  onPressed: _running ? null : () => _toggleSkip(idx),
                  icon: Icon(skipped ? LucideIcons.square : LucideIcons.checkSquare, size: 18),
                ),
              ]),
            ),
          );
        }),
      ],
    ]);
  }
}

// ---------- Shared small widgets --------------------------------------------

class _Section extends StatelessWidget {
  final String label; const _Section(this.label);
  @override Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 6),
    child: Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 0.6)),
  );
}

class _CreateStoreFirst extends StatelessWidget {
  const _CreateStoreFirst();
  @override Widget build(BuildContext c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(LucideIcons.store, size: 40, color: AppColors.muted),
        const SizedBox(height: 10),
        const Text('Create your store first', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Open a supplier profile from the store tab to list here.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 12)),
      ]),
    ),
  );
}

class _NeedAuth extends StatelessWidget {
  const _NeedAuth();
  @override Widget build(BuildContext c) => const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Sign in to manage these listings.')));
}

class _RestrictedNotice extends StatelessWidget {
  final String title; final String body;
  const _RestrictedNotice({required this.title, required this.body});
  @override Widget build(BuildContext c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(LucideIcons.lock, size: 40, color: AppColors.muted),
        const SizedBox(height: 10),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800), textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(body, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
      ]),
    ),
  );
}

Future<bool> _confirm(BuildContext context, String question) async {
  final r = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
    content: Text(question),
    actions: [
      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
      FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
    ],
  ));
  return r == true;
}
