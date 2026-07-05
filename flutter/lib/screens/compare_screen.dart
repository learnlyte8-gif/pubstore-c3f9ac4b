import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'messages_screen.dart';
import 'supplier_screen.dart';

/// Mirrors `src/pages/Compare.tsx` — side-by-side comparison of up to 3
/// suppliers with a picker bottom-sheet to add more.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _SupplierRow {
  _SupplierRow(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String;
  String get name => (raw['name'] ?? '') as String;
  String? get logo => raw['logo'] as String?;
  String get country => (raw['country'] ?? '') as String;
  String? get about => raw['about'] as String?;
  bool get verified => (raw['verified'] ?? false) as bool;
  bool get gold => (raw['gold'] ?? false) as bool;
  bool get tradeAssurance => (raw['trade_assurance'] ?? false) as bool;
  double get rating => ((raw['rating'] ?? 0) as num).toDouble();
  int get responseRate => ((raw['response_rate'] ?? 0) as num).toInt();
  String get responseTime => (raw['response_time'] ?? '') as String;
  int get onTime => ((raw['on_time_delivery'] ?? 0) as num).toInt();
  int get years => ((raw['years_active'] ?? 0) as num).toInt();
}

const _kMax = 3;

class _CompareScreenState extends State<CompareScreen> {
  List<_SupplierRow> _all = const [];
  final List<String> _selected = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await supabase
          .from('suppliers')
          .select(
              'id,name,logo,country,about,verified,gold,trade_assurance,rating,response_rate,response_time,on_time_delivery,years_active')
          .limit(100);
      final list = (rows as List)
          .map((r) => _SupplierRow(Map<String, dynamic>.from(r as Map)))
          .toList();
      if (!mounted) return;
      setState(() {
        _all = list;
        if (_selected.isEmpty && list.length >= 2) {
          _selected.addAll([list[0].id, list[1].id]);
        }
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<_SupplierRow> get _picked =>
      _selected.map((id) => _all.firstWhere((s) => s.id == id, orElse: () => _SupplierRow(const {'id': '_'}))).where((s) => s.raw.containsKey('name')).toList();

  Future<void> _openPicker() async {
    final available = _all.where((s) => !_selected.contains(s.id)).toList();
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _PickerSheet(available: available),
    );
    if (picked != null && mounted) {
      setState(() {
        if (_selected.length < _kMax) _selected.add(picked);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final picked = _picked;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Compare suppliers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            Text('${picked.length}/$_kMax selected', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
        ),
      ),
      body: _loading
          ? Skeletons.list(count: 6)
          : picked.length < 2
              ? _EmptyState(onAdd: _openPicker)
              : ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _headerRow(picked),
                    const SizedBox(height: 16),
                    _metricRow('Rating', LucideIcons.star, picked,
                        (s) => '${s.rating.toStringAsFixed(1)} ★',
                        best: picked.map((s) => s.rating).reduce((a, b) => a > b ? a : b),
                        value: (s) => s.rating),
                    _metricRow('Response', LucideIcons.clock, picked,
                        (s) => '${s.responseRate}% · ${s.responseTime}',
                        best: picked.map((s) => s.responseRate.toDouble()).reduce((a, b) => a > b ? a : b),
                        value: (s) => s.responseRate.toDouble()),
                    _metricRow('On-time', LucideIcons.truck, picked,
                        (s) => '${s.onTime}%',
                        best: picked.map((s) => s.onTime.toDouble()).reduce((a, b) => a > b ? a : b),
                        value: (s) => s.onTime.toDouble()),
                    _metricRow('Years', LucideIcons.calendar, picked,
                        (s) => '${s.years}y',
                        best: picked.map((s) => s.years.toDouble()).reduce((a, b) => a > b ? a : b),
                        value: (s) => s.years.toDouble()),
                    _boolRow('Trade Assured', LucideIcons.shieldCheck, picked, (s) => s.tradeAssurance),
                    _boolRow('Gold member', LucideIcons.award, picked, (s) => s.gold),
                    _boolRow('Verified', LucideIcons.shieldCheck, picked, (s) => s.verified),
                    const SizedBox(height: 18),
                    const Padding(padding: EdgeInsets.only(left: 4, bottom: 6),
                        child: Text('About', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800))),
                    Row(
                      children: picked
                          .map((s) => Expanded(
                                child: Container(
                                  margin: const EdgeInsets.symmetric(horizontal: 4),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                      color: AppColors.card,
                                      border: Border.all(color: AppColors.border),
                                      borderRadius: BorderRadius.circular(16)),
                                  child: Text(s.about ?? '', style: const TextStyle(fontSize: 11, color: AppColors.muted), maxLines: 6, overflow: TextOverflow.ellipsis),
                                ),
                              ))
                          .toList(),
                    ),
                    const SizedBox(height: 18),
                    const Padding(padding: EdgeInsets.only(left: 4, bottom: 6),
                        child: Text('Take action', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800))),
                    Row(
                      children: picked.map((s) => Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: FilledButton.icon(
                            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MessagesScreen())),
                            icon: const Icon(LucideIcons.messageCircle, size: 14),
                            label: const Text('Chat', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                          ),
                        ),
                      )).toList(),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
      floatingActionButton: picked.length >= 2 && _selected.length < _kMax
          ? FloatingActionButton.small(
              onPressed: _openPicker,
              child: const Icon(LucideIcons.plus),
            )
          : null,
    );
  }

  Widget _headerRow(List<_SupplierRow> picked) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: picked
            .map((s) => Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Stack(clipBehavior: Clip.none, children: [
                      InkWell(
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SupplierScreen(supplierId: s.id))),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
                          child: Column(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: SizedBox(width: 48, height: 48, child: (s.logo == null || s.logo!.isEmpty)
                                  ? const ColoredBox(color: AppColors.mutedSurface)
                                  : CachedNetworkImage(imageUrl: s.logo!, fit: BoxFit.cover)),
                            ),
                            const SizedBox(height: 6),
                            Text(s.name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                            Text(s.country, style: const TextStyle(fontSize: 9, color: AppColors.muted)),
                          ]),
                        ),
                      ),
                      Positioned(
                        top: -6, right: -6,
                        child: InkWell(
                          onTap: () => setState(() => _selected.remove(s.id)),
                          child: Container(width: 22, height: 22,
                            decoration: BoxDecoration(color: AppColors.foreground, shape: BoxShape.circle),
                            child: const Icon(LucideIcons.x, size: 12, color: Colors.white),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ))
            .toList(),
      );

  Widget _metricRow(String label, IconData icon, List<_SupplierRow> picked, String Function(_SupplierRow) fmt,
      {required double best, required double Function(_SupplierRow) value}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        SizedBox(
          width: 78,
          child: Row(children: [Icon(icon, size: 12, color: AppColors.muted), const SizedBox(width: 4),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.muted))]),
        ),
        ...picked.map((s) => Expanded(child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
            child: Center(child: Text(fmt(s),
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800,
                    color: value(s) == best && best > 0 ? AppColors.success : null))),
          ),
        ))),
      ]),
    );
  }

  Widget _boolRow(String label, IconData icon, List<_SupplierRow> picked, bool Function(_SupplierRow) value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        SizedBox(
          width: 78,
          child: Row(children: [Icon(icon, size: 12, color: AppColors.muted), const SizedBox(width: 4),
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.muted))]),
        ),
        ...picked.map((s) => Expanded(child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
            child: Icon(value(s) ? LucideIcons.check : LucideIcons.minus,
                size: 16, color: value(s) ? AppColors.success : AppColors.muted),
          ),
        ))),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Add at least 2 suppliers to compare.', style: TextStyle(color: AppColors.muted)),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: onAdd, icon: const Icon(LucideIcons.plus, size: 16), label: const Text('Add supplier')),
        ]),
      );
}

class _PickerSheet extends StatefulWidget {
  const _PickerSheet({required this.available});
  final List<_SupplierRow> available;
  @override
  State<_PickerSheet> createState() => _PickerSheetState();
}

class _PickerSheetState extends State<_PickerSheet> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final list = widget.available.where((s) {
      if (_q.isEmpty) return true;
      final q = _q.toLowerCase();
      return s.name.toLowerCase().contains(q) || s.country.toLowerCase().contains(q);
    }).toList();
    return FractionallySizedBox(
      heightFactor: 0.8,
      child: Column(children: [
        Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(2))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            autofocus: true,
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(
              prefixIcon: Icon(LucideIcons.search, size: 16),
              hintText: 'Search suppliers...',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: list.isEmpty
              ? const Center(child: Text('No suppliers found.', style: TextStyle(color: AppColors.muted, fontSize: 12)))
              : ListView.builder(
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final s = list[i];
                    return ListTile(
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(width: 40, height: 40, child: (s.logo == null || s.logo!.isEmpty)
                            ? const ColoredBox(color: AppColors.mutedSurface)
                            : CachedNetworkImage(imageUrl: s.logo!, fit: BoxFit.cover)),
                      ),
                      title: Text(s.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      subtitle: Text('${s.country} · ${s.rating.toStringAsFixed(1)}★ · ${s.years}y',
                          style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                      trailing: const Icon(LucideIcons.plus, size: 16, color: AppColors.primary),
                      onTap: () => Navigator.of(context).pop(s.id),
                    );
                  },
                ),
        ),
      ]),
    );
  }
}
