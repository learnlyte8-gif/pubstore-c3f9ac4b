import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Stays.tsx` `StayDetail` view + `StayBookingDialog`.
class StayDetailScreen extends StatefulWidget {
  const StayDetailScreen({super.key, required this.stay});
  final Stay stay;

  @override
  State<StayDetailScreen> createState() => _StayDetailScreenState();
}

class _StayDetailScreenState extends State<StayDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final s = widget.stay;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(children: [
        CustomScrollView(slivers: [
          SliverAppBar(
            expandedHeight: 288,
            pinned: true,
            backgroundColor: AppColors.background,
            foregroundColor: AppColors.foreground,
            actions: [
              if (s.superhost)
                Padding(
                  padding: const EdgeInsets.only(right: 8, top: 12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFBBF24),
                        borderRadius: BorderRadius.circular(999)),
                    child: const Text('SUPERHOST',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2)),
                  ),
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: s.cover != null
                  ? Image.network(s.cover!, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          Container(color: AppColors.mutedSurface))
                  : Container(color: AppColors.mutedSurface),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 140),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                Text(s.kind.toUpperCase(),
                    style: const TextStyle(
                        fontSize: 10,
                        letterSpacing: 1.4,
                        fontWeight: FontWeight.w900,
                        color: AppColors.muted)),
                const SizedBox(height: 4),
                Text(s.title,
                    style: const TextStyle(
                        fontFamily: 'serif', fontSize: 28, height: 1.15)),
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(LucideIcons.star,
                      size: 14, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 4),
                  Text(
                      '${s.rating.toStringAsFixed(2)} · ${s.reviewCount} reviews',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.muted)),
                  const SizedBox(width: 12),
                  const Icon(LucideIcons.mapPin,
                      size: 14, color: AppColors.muted),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                        [s.city, s.country].whereType<String>().join(', '),
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.muted)),
                  ),
                ]),
                const SizedBox(height: 20),
                Row(children: [
                  _spec(LucideIcons.users, s.guests, 'Guests'),
                  const SizedBox(width: 8),
                  _spec(LucideIcons.bedDouble, s.bedrooms, 'Bedrooms'),
                  const SizedBox(width: 8),
                  _spec(LucideIcons.bedDouble, s.beds, 'Beds'),
                  const SizedBox(width: 8),
                  _spec(LucideIcons.bath, s.baths, 'Baths'),
                ]),
                if (s.description != null && s.description!.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(s.description!,
                      style: const TextStyle(
                          fontFamily: 'serif', fontSize: 14, height: 1.55)),
                ],
                if (s.amenities.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const Text('AMENITIES',
                      style: TextStyle(
                          fontSize: 11,
                          letterSpacing: 1.4,
                          fontWeight: FontWeight.w900,
                          color: AppColors.muted)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final a in s.amenities)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                              color: AppColors.mutedSurface,
                              borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(LucideIcons.wifi,
                                size: 12, color: AppColors.muted),
                            const SizedBox(width: 5),
                            Text(a,
                                style: const TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w700)),
                          ]),
                        ),
                    ],
                  ),
                ],
                if (s.gallery.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                    childAspectRatio: 4 / 3,
                    children: [
                      for (final g in s.gallery.take(4))
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(g,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  Container(color: AppColors.mutedSurface)),
                        ),
                    ],
                  ),
                ],
              ]),
            ),
          ),
        ]),
        // Sticky Reserve bar
        Positioned(
          left: 12,
          right: 12,
          bottom: 24,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(20),
            color: AppColors.card,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('FROM',
                          style: TextStyle(
                              fontSize: 9,
                              letterSpacing: 1.4,
                              fontWeight: FontWeight.w900,
                              color: AppColors.muted)),
                      RichText(
                        text: TextSpan(children: [
                          TextSpan(
                              text: '\$${s.pricePerNight.round()}',
                              style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.foreground)),
                          const TextSpan(
                              text: ' / night',
                              style: TextStyle(
                                  fontSize: 10, color: AppColors.muted)),
                        ]),
                      ),
                    ]),
                const Spacer(),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.foreground,
                    foregroundColor: AppColors.background,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                  ),
                  onPressed: () => _openBookingSheet(s),
                  child: const Text('Reserve',
                      style: TextStyle(fontWeight: FontWeight.w900)),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _spec(IconData icon, int value, String label) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            Icon(icon, size: 16, color: AppColors.muted),
            const SizedBox(height: 4),
            Text('$value',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w800)),
            Text(label.toUpperCase(),
                style: const TextStyle(
                    fontSize: 9,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w800,
                    color: AppColors.muted)),
          ]),
        ),
      );

  Future<void> _openBookingSheet(Stay s) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _BookingSheet(stay: s),
    );
  }
}

class _BookingSheet extends StatefulWidget {
  const _BookingSheet({required this.stay});
  final Stay stay;
  @override
  State<_BookingSheet> createState() => _BookingSheetState();
}

class _BookingSheetState extends State<_BookingSheet> {
  DateTime? _checkIn;
  DateTime? _checkOut;
  int _guests = 2;
  final _notes = TextEditingController();
  bool _busy = false;

  int get _nights {
    if (_checkIn == null || _checkOut == null) return 0;
    return _checkOut!.difference(_checkIn!).inDays.clamp(0, 365);
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _reserve() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to reserve')));
      return;
    }
    if (_checkIn == null || _checkOut == null || _nights < 1) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Pick valid dates')));
      return;
    }
    if (_guests > widget.stay.guests) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Max ${widget.stay.guests} guests')));
      return;
    }
    setState(() => _busy = true);
    try {
      final rate = widget.stay.pricePerNight;
      final subtotal = _nights * rate;
      final cleaning = _nights > 0 ? (rate * 0.15).round().toDouble() : 0.0;
      final service = (subtotal * 0.1).round().toDouble();
      final total = subtotal + cleaning + service;
      await supabase.from('stay_bookings').insert({
        'stay_id': widget.stay.id,
        'guest_id': uid,
        'check_in': DateFormat('yyyy-MM-dd').format(_checkIn!),
        'check_out': DateFormat('yyyy-MM-dd').format(_checkOut!),
        'guests': _guests,
        'nights': _nights,
        'nightly_rate': rate,
        'cleaning_fee': cleaning,
        'service_fee': service,
        'total': total,
        'currency': 'USD',
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Reserved! Host will confirm shortly.')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.stay;
    final rate = s.pricePerNight;
    final subtotal = _nights * rate;
    final cleaning = _nights > 0 ? (rate * 0.15).round().toDouble() : 0.0;
    final service = (subtotal * 0.1).round().toDouble();
    final total = subtotal + cleaning + service;

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          left: 20,
          right: 20,
          top: 20),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: const Color(0xFFFBBF24).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(999)),
              child: Row(mainAxisSize: MainAxisSize.min, children: const [
                Icon(LucideIcons.sparkles,
                    size: 10, color: Color(0xFFB45309)),
                SizedBox(width: 4),
                Text('Reserve',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFB45309),
                        letterSpacing: 1.2)),
              ]),
            ),
            const Spacer(),
            IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(LucideIcons.x, size: 18)),
          ]),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(s.title,
                style: const TextStyle(
                    fontFamily: 'serif', fontSize: 22, height: 1.15)),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text([s.city, s.country].whereType<String>().join(', '),
                style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _dateField('Check-in', _checkIn, (d) {
              setState(() {
                _checkIn = d;
                if (_checkOut != null && !_checkOut!.isAfter(d)) {
                  _checkOut = null;
                }
              });
            })),
            const SizedBox(width: 8),
            Expanded(
                child: _dateField('Check-out', _checkOut, (d) {
              setState(() => _checkOut = d);
            }, min: _checkIn)),
          ]),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: AppColors.mutedSurface.withOpacity(0.4),
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              const Icon(LucideIcons.users, size: 16, color: AppColors.muted),
              const SizedBox(width: 6),
              Text('$_guests guest${_guests == 1 ? '' : 's'}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700)),
              const Spacer(),
              _stepBtn('−',
                  () => setState(() => _guests = (_guests - 1).clamp(1, 99))),
              const SizedBox(width: 6),
              _stepBtn(
                  '+',
                  () => setState(
                      () => _guests = (_guests + 1).clamp(1, s.guests))),
            ]),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
                'Max ${s.guests} guests · ${s.bedrooms} bedroom${s.bedrooms == 1 ? '' : 's'}',
                style: const TextStyle(fontSize: 10, color: AppColors.muted)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Anything the host should know? (optional)',
            ),
          ),
          if (_nights > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: AppColors.mutedSurface.withOpacity(0.4),
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                _row('\$${rate.round()} × $_nights night${_nights == 1 ? '' : 's'}',
                    '\$${subtotal.toStringAsFixed(2)}'),
                _row('Cleaning fee', '\$${cleaning.toStringAsFixed(2)}'),
                _row('Service fee', '\$${service.toStringAsFixed(2)}'),
                const Divider(height: 12),
                _row('Total', '\$${total.toStringAsFixed(2)}', bold: true),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.foreground,
                foregroundColor: AppColors.background,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
              ),
              onPressed: _busy || _nights < 1 ? null : _reserve,
              child: Text(
                _busy
                    ? 'Reserving…'
                    : _nights > 0
                        ? 'Reserve · \$${total.toStringAsFixed(2)}'
                        : 'Pick dates to continue',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text("You won't be charged yet — host confirms first.",
              style: TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
      ),
    );
  }

  Widget _dateField(String label, DateTime? value,
      ValueChanged<DateTime> onPick, {DateTime? min}) {
    return InkWell(
      onTap: () async {
        final now = DateTime.now();
        final first = min ?? DateTime(now.year, now.month, now.day);
        final picked = await showDatePicker(
          context: context,
          firstDate:
              min != null ? min.add(const Duration(days: 1)) : first,
          lastDate: now.add(const Duration(days: 365 * 2)),
          initialDate: value ??
              (min != null ? min.add(const Duration(days: 1)) : first),
        );
        if (picked != null) onPick(picked);
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
            color: AppColors.mutedSurface.withOpacity(0.4),
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(12)),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label.toUpperCase(),
                  style: const TextStyle(
                      fontSize: 9,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800,
                      color: AppColors.muted)),
              const SizedBox(height: 4),
              Row(children: [
                const Icon(LucideIcons.calendar,
                    size: 14, color: AppColors.muted),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                      value == null
                          ? 'Select'
                          : DateFormat('MMM d, yyyy').format(value),
                      style: TextStyle(
                          fontSize: 13,
                          color: value == null
                              ? AppColors.muted
                              : AppColors.foreground)),
                ),
              ]),
            ]),
      ),
    );
  }

  Widget _stepBtn(String label, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
              color: AppColors.background,
              border: Border.all(color: AppColors.border),
              shape: BoxShape.circle),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w900)),
        ),
      );

  Widget _row(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  color: AppColors.muted,
                  fontWeight: bold ? FontWeight.w900 : FontWeight.w500)),
          const Spacer(),
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: bold ? FontWeight.w900 : FontWeight.w600)),
        ]),
      );
}
