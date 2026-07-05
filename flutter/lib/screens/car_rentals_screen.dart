import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/CarRentals.tsx` — browse fleet, view rich detail, and
/// book with a mini form that writes to `car_rental_bookings`.
class CarRentalsScreen extends StatefulWidget {
  const CarRentalsScreen({super.key});
  @override
  State<CarRentalsScreen> createState() => _CarRentalsScreenState();
}

class _CarRentalsScreenState extends State<CarRentalsScreen> {
  String _klass = '';
  late Future<List<Map<String, dynamic>>> _future;

  static const _classes = [
    ['economy', 'Economy'], ['comfort', 'Comfort'], ['suv', 'SUV'],
    ['luxury', 'Luxury'], ['4x4', '4x4'], ['van', 'Van'], ['pickup', 'Pickup'],
  ];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    dynamic q = supabase.from('car_rentals').select('*').eq('active', true)
        .order('featured', ascending: false).order('created_at', ascending: false);
    if (_klass.isNotEmpty) q = q.eq('vehicle_class', _klass);
    final rows = await q.limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _set(String k) => setState(() { _klass = k; _future = _load(); });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFEA580C), Color(0xFFF59E0B)]),
            ),
            child: Row(children: [
              IconButton(icon: const Icon(LucideIcons.arrowLeft, color: Colors.white), onPressed: () => Navigator.of(context).maybePop()),
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: Colors.white.withOpacity(.18), borderRadius: BorderRadius.circular(12)),
                child: const Icon(LucideIcons.key, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Car rentals', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                Text('Self-drive · Daily · Weekly · Cross-border', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ])),
            ]),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              scrollDirection: Axis.horizontal,
              itemCount: _classes.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return ChoiceChip(label: const Text('All'), selected: _klass.isEmpty, onSelected: (_) => _set(''));
                }
                final c = _classes[i - 1];
                final active = _klass == c[0];
                return ChoiceChip(label: Text(c[1]), selected: active, onSelected: (_) => _set(c[0]));
              },
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
                final rows = snap.data ?? const [];
                if (rows.isEmpty) return const Center(child: Text('No vehicles yet'));
                return GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                  itemCount: rows.length,
                  itemBuilder: (context, i) => _RentalCard(row: rows[i], onTap: () {
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => CarRentalDetailScreen(id: rows[i]['id'].toString()),
                    ));
                  }),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _RentalCard extends StatelessWidget {
  const _RentalCard({required this.row, required this.onTap});
  final Map<String, dynamic> row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cover = (row['cover'] ?? '').toString();
    final rate = row['price_per_day'] ?? 0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Stack(fit: StackFit.expand, children: [
              cover.isEmpty
                  ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.car, color: AppColors.muted, size: 36))
                  : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
              Positioned(top: 6, left: 6, child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.black.withOpacity(.6), borderRadius: BorderRadius.circular(4)),
                child: Text('${row['vehicle_class'] ?? ''}'.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
              )),
              if (row['verified'] == true)
                Positioned(top: 6, right: 6, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(4)),
                  child: const Text('VERIFIED', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                )),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${row['title'] ?? ''}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text('${row['year'] ?? ''} · ${row['transmission'] ?? ''} · ${row['seats'] ?? ''} seats',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Row(children: [
                Text('\$$rate', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
                const Text('/day', style: TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w700)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

/* ------------------- DETAIL ------------------- */

class CarRentalDetailScreen extends StatefulWidget {
  const CarRentalDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<CarRentalDetailScreen> createState() => _CarRentalDetailScreenState();
}

class _CarRentalDetailScreenState extends State<CarRentalDetailScreen> {
  late Future<Map<String, dynamic>?> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>?> _load() async {
    final r = await supabase.from('car_rentals').select('*').eq('id', widget.id).maybeSingle();
    return r == null ? null : Map<String, dynamic>.from(r);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 6);
          final r = snap.data;
          if (r == null) return const Center(child: Text('Vehicle not found'));
          final cover = (r['cover'] ?? '').toString();
          final gallery = (r['gallery'] as List?)?.cast<String>() ?? const [];
          return CustomScrollView(slivers: [
            SliverAppBar(
              expandedHeight: 240, pinned: true, backgroundColor: AppColors.background,
              flexibleSpace: FlexibleSpaceBar(
                background: cover.isEmpty
                    ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.car, size: 64, color: AppColors.muted))
                    : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
              ),
            ),
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (gallery.isNotEmpty)
                  SizedBox(
                    height: 72,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: gallery.length.clamp(0, 8),
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(imageUrl: gallery[i], width: 72, height: 72, fit: BoxFit.cover),
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                Text('${r['year'] ?? ''} · ${r['make'] ?? ''} ${r['model'] ?? ''}',
                    style: const TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text('${r['title'] ?? ''}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text('\$${r['price_per_day'] ?? 0}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
                  const Text('/day', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                  const SizedBox(width: 8),
                  if (r['price_per_week'] != null) Text('\$${r['price_per_week']}/wk', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
                const SizedBox(height: 16),
                GridView.count(
                  crossAxisCount: 4, mainAxisSpacing: 8, crossAxisSpacing: 8,
                  shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 1.0,
                  children: [
                    _fact(LucideIcons.cog, 'Trans', '${r['transmission'] ?? '—'}'),
                    _fact(LucideIcons.users, 'Seats', '${r['seats'] ?? '—'}'),
                    _fact(LucideIcons.fuel, 'Fuel', '${r['fuel'] ?? '—'}'),
                    _fact(LucideIcons.snowflake, 'A/C', r['ac'] == true ? 'Yes' : 'No'),
                  ],
                ),
                const SizedBox(height: 16),
                _section('Mileage policy', LucideIcons.gauge, [
                  if (r['unlimited_km'] == true) 'Unlimited km — drive freely'
                  else 'Free ${r['free_km_per_day'] ?? 0} km/day · Extra \$${r['extra_km_fee'] ?? 0}/km',
                ]),
                _section('Eligibility', LucideIcons.shieldCheck, [
                  'Min age: ${r['min_age'] ?? 21}',
                  'License held: ≥ ${r['min_license_years'] ?? 1} yr',
                  'Intl. license: ${r['international_license_ok'] == true ? "Accepted" : "Not accepted"}',
                  'Cross-border: ${r['cross_border_allowed'] == true ? "Allowed" : "No"}',
                ]),
                _section('Booking', LucideIcons.calendar, [
                  'Min rental: ${r['min_rental_days'] ?? 1} day(s)',
                  'Advance notice: ${r['advance_booking_hours'] ?? 24} hrs',
                  'Fuel: ${(r['fuel_policy'] ?? '').toString().replaceAll('_', ' ')}',
                  'Deposit: ${r['deposit'] != null ? "\$${r['deposit']}" : "None"}',
                ]),
                if (r['description'] != null && r['description'].toString().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('About', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('${r['description']}', style: const TextStyle(color: AppColors.muted)),
                ],
                const SizedBox(height: 80),
              ]),
            )),
          ]);
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppColors.foreground,
            ),
            icon: const Icon(LucideIcons.calendar),
            label: const Text('Book this car', style: TextStyle(fontWeight: FontWeight.w900)),
            onPressed: () async {
              final r = await _future;
              if (r != null && mounted) _openBookingSheet(context, r);
            },
          ),
        ),
      ),
    );
  }

  Widget _fact(IconData i, String label, String value) => Container(
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(i, size: 16, color: AppColors.muted),
      const SizedBox(height: 4),
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
      Text(label, style: const TextStyle(fontSize: 9, color: AppColors.muted)),
    ]),
  );

  Widget _section(String title, IconData icon, List<String> lines) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Icon(icon, size: 16), const SizedBox(width: 6), Text(title, style: const TextStyle(fontWeight: FontWeight.w800))]),
        const SizedBox(height: 8),
        ...lines.map((l) => Padding(padding: const EdgeInsets.only(top: 2), child: Text('• $l', style: const TextStyle(fontSize: 12, color: AppColors.muted)))),
      ]),
    ),
  );

  void _openBookingSheet(BuildContext context, Map<String, dynamic> r) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _BookingSheet(rental: r),
    );
  }
}

class _BookingSheet extends StatefulWidget {
  const _BookingSheet({required this.rental});
  final Map<String, dynamic> rental;
  @override
  State<_BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends State<_BookingSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();
  DateTime? _from;
  DateTime? _to;
  bool _saving = false;

  int get _days => (_from != null && _to != null) ? _to!.difference(_from!).inDays.clamp(1, 365) : (widget.rental['min_rental_days'] ?? 1) as int;
  double get _total => (widget.rental['price_per_day'] as num?)?.toDouble() ?? 0 * _days.toDouble();

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final r = await showDateRangePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 365)));
    if (r != null) setState(() { _from = r.start; _to = r.end; });
  }

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to book')));
      return;
    }
    if (_from == null || _to == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick your dates')));
      return;
    }
    if (_name.text.trim().isEmpty || _phone.text.trim().isEmpty || _pickup.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Fill required fields')));
      return;
    }
    setState(() => _saving = true);
    try {
      await supabase.from('car_rental_bookings').insert({
        'rental_id': widget.rental['id'],
        'renter_id': uid,
        'renter_name': _name.text.trim(),
        'renter_phone': _phone.text.trim(),
        'pickup_at': _from!.toIso8601String(),
        'return_at': _to!.toIso8601String(),
        'pickup_location': _pickup.text.trim(),
        'dropoff_location': _dropoff.text.trim().isEmpty ? _pickup.text.trim() : _dropoff.text.trim(),
        'estimated_total': (widget.rental['price_per_day'] as num).toDouble() * _days,
        'amount_due': (widget.rental['price_per_day'] as num).toDouble() * _days,
        'currency': widget.rental['currency'] ?? 'USD',
        'status': 'pending',
      });
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking request sent')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Booking failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rate = (widget.rental['price_per_day'] as num?)?.toDouble() ?? 0;
    return DraggableScrollableSheet(
      expand: false, initialChildSize: .9, maxChildSize: .95,
      builder: (_, ctrl) => ListView(controller: ctrl, padding: const EdgeInsets.all(16), children: [
        Row(children: [
          const Expanded(child: Text('Book vehicle', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900))),
          IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 8),
        _tf(_name, 'Full name *'),
        _tf(_phone, 'Phone *', keyboard: TextInputType.phone),
        _tf(_pickup, 'Pickup location *'),
        _tf(_dropoff, 'Drop-off location (optional)'),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _pickRange, icon: const Icon(LucideIcons.calendar),
          label: Text(_from == null ? 'Pick dates' : '${_from!.toString().substring(0, 10)} → ${_to!.toString().substring(0, 10)}'),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            _row('Daily rate', '\$${rate.toStringAsFixed(2)}'),
            _row('Days', '$_days'),
            const Divider(),
            _row('Estimated total', '\$${(rate * _days).toStringAsFixed(2)}', bold: true),
          ]),
        ),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.foreground),
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Submitting…' : 'Send booking request', style: const TextStyle(fontWeight: FontWeight.w900)),
        ),
      ]),
    );
  }

  Widget _tf(TextEditingController c, String hint, {TextInputType? keyboard}) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: TextField(controller: c, keyboardType: keyboard, decoration: InputDecoration(labelText: hint, border: const OutlineInputBorder())),
  );

  Widget _row(String a, String b, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(a, style: TextStyle(color: bold ? AppColors.foreground : AppColors.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.normal)),
      Text(b, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w700)),
    ]),
  );
}
