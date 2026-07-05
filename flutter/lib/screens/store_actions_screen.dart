import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/StoreActions.tsx` — Actions Inbox: browse buyer
/// requests grouped by service vertical (stays, car-rentals, vehicles,
/// properties, finance, industrial, agro, pros). Each vertical shows the
/// most relevant pending requests / bookings for the current supplier.
class StoreActionsScreen extends StatefulWidget {
  const StoreActionsScreen({super.key, this.initialSection = 'stays', this.focusId});
  final String initialSection;
  final String? focusId;

  @override
  State<StoreActionsScreen> createState() => _StoreActionsScreenState();
}

class _Section {
  const _Section(this.id, this.label, this.icon);
  final String id;
  final String label;
  final IconData icon;
}

const _sections = <_Section>[
  _Section('stays', 'Stays', LucideIcons.bedDouble),
  _Section('car-rentals', 'Car rentals', LucideIcons.car),
  _Section('vehicles', 'Vehicles', LucideIcons.car),
  _Section('properties', 'Real estate', LucideIcons.home),
  _Section('finance', 'Finance', LucideIcons.banknote),
  _Section('industrial', 'Industrial', LucideIcons.factory),
  _Section('agro', 'Agro', LucideIcons.sprout),
  _Section('pros', 'Local services', LucideIcons.wrench),
];

class _StoreActionsScreenState extends State<StoreActionsScreen> {
  late String _section = widget.initialSection;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Actions inbox', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            Text('All buyer requests across your services',
                style: TextStyle(fontSize: 11, color: AppColors.muted)),
          ],
        ),
      ),
      body: Column(children: [
        SizedBox(
          height: 46,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            scrollDirection: Axis.horizontal,
            itemCount: _sections.length,
            itemBuilder: (_, i) {
              final s = _sections[i];
              final active = s.id == _section;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: ChoiceChip(
                  avatar: Icon(s.icon, size: 14, color: active ? Colors.white : null),
                  label: Text(s.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  selected: active,
                  selectedColor: AppColors.foreground,
                  labelStyle: TextStyle(color: active ? Colors.white : null),
                  onSelected: (_) => setState(() => _section = s.id),
                ),
              );
            },
          ),
        ),
        const Divider(height: 1),
        Expanded(child: _SectionInbox(section: _section, focusId: widget.focusId)),
      ]),
    );
  }
}

/// Fetches request rows for a given supplier + vertical.
class _SectionInbox extends StatefulWidget {
  const _SectionInbox({required this.section, this.focusId});
  final String section;
  final String? focusId;
  @override
  State<_SectionInbox> createState() => _SectionInboxState();
}

class _Cfg {
  const _Cfg({required this.table, required this.title, required this.amount, this.timeField = 'created_at'});
  final String table;
  final String title;
  final String amount;
  final String timeField;
}

const _cfgs = <String, _Cfg>{
  'stays': _Cfg(table: 'stay_bookings', title: 'stays(title)', amount: 'total'),
  'car-rentals': _Cfg(table: 'car_rental_bookings', title: 'car_rentals(title)', amount: 'estimated_total'),
  'vehicles': _Cfg(table: 'vehicle_inquiries', title: 'vehicles(title)', amount: 'amount_due'),
  'properties': _Cfg(table: 'property_inquiries', title: 'properties(title)', amount: 'amount_due'),
  'finance': _Cfg(table: 'finance_applications', title: 'finance_products(title)', amount: 'amount_due'),
  'industrial': _Cfg(table: 'product_inquiries', title: 'products(title)', amount: 'quantity'),
  'agro': _Cfg(table: 'product_inquiries', title: 'products(title)', amount: 'quantity'),
  'pros': _Cfg(table: 'service_bids', title: 'service_requests(title)', amount: 'price'),
};

class _SectionInboxState extends State<_SectionInbox> {
  Future<List<Map<String, dynamic>>>? _future;
  String? _lastSection;

  Future<List<Map<String, dynamic>>> _load() async {
    final cfg = _cfgs[widget.section];
    if (cfg == null) return const [];
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return const [];
    try {
      final rows = await supabase
          .from(cfg.table)
          .select('id, status, ${cfg.amount}, ${cfg.timeField}, ${cfg.title}')
          .order(cfg.timeField, ascending: false)
          .limit(50);
      return (rows as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    } catch (_) {
      return const [];
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_lastSection != widget.section) {
      _lastSection = widget.section;
      _future = _load();
    }
    final cfg = _cfgs[widget.section];
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return Skeletons.list(count: 6);
        }
        final rows = snap.data ?? const [];
        if (rows.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: const [
                Icon(LucideIcons.inbox, size: 44, color: AppColors.muted),
                SizedBox(height: 10),
                Text('No requests yet in this section', style: TextStyle(fontWeight: FontWeight.w800)),
                SizedBox(height: 4),
                Text('New buyer requests will appear here.', style: TextStyle(color: AppColors.muted, fontSize: 12)),
              ]),
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: rows.length,
          itemBuilder: (_, i) {
            final r = rows[i];
            final rel = r[cfg!.title.split('(').first];
            final title = rel is Map ? (rel['title'] ?? 'Request') : 'Request';
            final amt = r[cfg.amount];
            final status = (r['status'] ?? 'pending') as String;
            final focused = r['id'] == widget.focusId;
            return Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: focused ? AppColors.primary : AppColors.border, width: focused ? 2 : 1),
              ),
              child: ListTile(
                title: Text('$title', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('Amount: $amt · Status: $status', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                trailing: _statusChip(status),
              ),
            );
          },
        );
      },
    );
  }

  Widget _statusChip(String status) {
    Color bg = AppColors.mutedSurface;
    Color fg = AppColors.muted;
    if (status == 'accepted' || status == 'approved' || status == 'confirmed') {
      bg = AppColors.success.withOpacity(0.15); fg = AppColors.success;
    } else if (status == 'pending') {
      bg = AppColors.warning.withOpacity(0.15); fg = AppColors.warning;
    } else if (status == 'rejected' || status == 'cancelled') {
      bg = AppColors.danger.withOpacity(0.15); fg = AppColors.danger;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: fg)),
    );
  }
}
