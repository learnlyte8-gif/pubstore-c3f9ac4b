import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Mirrors the core flow of `src/pages/Rides.tsx` — pickup/dropoff entry,
/// vehicle class picker with fare suggestion, ride request creation, and
/// live driver offers list.
class RidesScreen extends StatefulWidget {
  const RidesScreen({super.key});
  @override
  State<RidesScreen> createState() => _RidesScreenState();
}

class _RidesScreenState extends State<RidesScreen> {
  int _tab = 0;
  int _classIdx = 1;
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();
  double? _pickupLat, _pickupLng, _dropLat, _dropLng;
  String? _activeRideId;
  RealtimeChannel? _offersChannel;
  List<Map<String, dynamic>> _offers = const [];
  List<Map<String, dynamic>> _trips = const [];
  bool _creating = false;

  static const _classes = [
    {'id': 'moto', 'label': 'Moto', 'icon': LucideIcons.bike, 'eta': '2 min', 'seats': '1 seat', 'mult': 0.55, 'base': 1.0, 'perKm': 0.5},
    {'id': 'economy', 'label': 'Economy', 'icon': LucideIcons.car, 'eta': '4 min', 'seats': '4 seats', 'mult': 1.0, 'base': 1.5, 'perKm': 0.8},
    {'id': 'comfort', 'label': 'Comfort', 'icon': LucideIcons.car, 'eta': '5 min', 'seats': '4 seats', 'mult': 1.35, 'base': 2.2, 'perKm': 1.2},
    {'id': 'xl', 'label': 'XL', 'icon': LucideIcons.users, 'eta': '6 min', 'seats': '6 seats', 'mult': 1.7, 'base': 3.0, 'perKm': 1.6},
  ];

  double get _distanceKm {
    if (_pickupLat == null || _dropLat == null) return 4; // default
    return _haversine(_pickupLat!, _pickupLng!, _dropLat!, _dropLng!);
  }

  double get _fare {
    final c = _classes[_classIdx];
    return math.max(2, (c['base']! as double) + _distanceKm * (c['perKm']! as double));
  }

  @override
  void dispose() {
    if (_offersChannel != null) supabase.removeChannel(_offersChannel!);
    _pickup.dispose();
    _dropoff.dispose();
    super.dispose();
  }

  double _haversine(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371.0;
    double d2r(double d) => d * math.pi / 180.0;
    final dLat = d2r(lat2 - lat1);
    final dLon = d2r(lon2 - lon1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(d2r(lat1)) * math.cos(d2r(lat2)) * math.sin(dLon / 2) * math.sin(dLon / 2);
    return 2 * R * math.asin(math.sqrt(a));
  }

  Future<void> _useMyLocation() async {
    try {
      final perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      final p = await Geolocator.getCurrentPosition();
      setState(() {
        _pickupLat = p.latitude;
        _pickupLng = p.longitude;
        _pickup.text = 'Current location (${p.latitude.toStringAsFixed(3)}, ${p.longitude.toStringAsFixed(3)})';
      });
    } catch (_) {}
  }

  Future<void> _requestRide() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to request a ride')));
      return;
    }
    if (_pickup.text.trim().isEmpty || _dropoff.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter pickup and drop-off')));
      return;
    }
    setState(() => _creating = true);
    try {
      // Fall back to arbitrary coords if not geocoded — the row still records intent.
      final pLat = _pickupLat ?? -17.8252;
      final pLng = _pickupLng ?? 31.0335;
      final dLat = _dropLat ?? (pLat + 0.02);
      final dLng = _dropLng ?? (pLng + 0.02);
      final row = await supabase.from('rides').insert({
        'rider_id': uid,
        'status': 'searching',
        'pickup_address': _pickup.text.trim(),
        'pickup_lat': pLat,
        'pickup_lng': pLng,
        'dropoff_address': _dropoff.text.trim(),
        'dropoff_lat': dLat,
        'dropoff_lng': dLng,
        'distance_km': _distanceKm,
        'rider_offer': _fare,
        'currency': 'USD',
        'vehicle_class': _classes[_classIdx]['id'],
      }).select('id').single();
      final id = row['id'].toString();
      setState(() { _activeRideId = id; });
      _subscribeOffers(id);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  void _subscribeOffers(String rideId) {
    if (_offersChannel != null) supabase.removeChannel(_offersChannel!);
    _loadOffers(rideId);
    _offersChannel = supabase
        .channel('offers:$rideId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'ride_offers',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'ride_id', value: rideId),
          callback: (_) => _loadOffers(rideId),
        )
        .subscribe();
  }

  Future<void> _loadOffers(String rideId) async {
    final rows = await supabase.from('ride_offers').select('*').eq('ride_id', rideId).order('fare', ascending: true);
    if (!mounted) return;
    setState(() => _offers = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _acceptOffer(Map<String, dynamic> o) async {
    if (_activeRideId == null) return;
    try {
      await supabase.from('rides').update({
        'status': 'accepted',
        'driver_id': o['driver_id'],
        'final_fare': o['fare'],
        'accepted_at': DateTime.now().toIso8601String(),
      }).eq('id', _activeRideId!);
      await supabase.from('ride_offers').update({'status': 'accepted'}).eq('id', o['id']);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ride confirmed with ${o['driver_name']}')));
      setState(() { _activeRideId = null; _offers = const []; });
      if (_offersChannel != null) supabase.removeChannel(_offersChannel!);
      _offersChannel = null;
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _cancelRide() async {
    if (_activeRideId == null) return;
    await supabase.from('rides').update({'status': 'cancelled'}).eq('id', _activeRideId!);
    setState(() { _activeRideId = null; _offers = const []; });
    if (_offersChannel != null) supabase.removeChannel(_offersChannel!);
    _offersChannel = null;
  }

  Future<void> _loadTrips() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final rows = await supabase.from('rides').select('*').eq('rider_id', uid).order('created_at', ascending: false).limit(30);
    if (!mounted) return;
    setState(() => _trips = (rows as List).cast<Map<String, dynamic>>());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          _header(),
          _tabs(),
          if (_tab == 3)
            Expanded(child: _tripsList())
          else if (_activeRideId != null)
            Expanded(child: _searchingView())
          else
            Expanded(child: SingleChildScrollView(child: _requestForm())),
        ]),
      ),
    );
  }

  Widget _header() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
    child: Row(children: [
      IconButton(icon: const Icon(LucideIcons.arrowLeft), onPressed: () => Navigator.of(context).maybePop()),
      const Text('Rides', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      const Spacer(),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.wallet, size: 12), SizedBox(width: 4),
          Text('Rider', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
        ]),
      ),
    ]),
  );

  Widget _tabs() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)),
      child: Row(children: List.generate(4, (i) {
        const labels = ['Now', 'Schedule', 'Share', 'Trips'];
        final active = _tab == i;
        return Expanded(child: GestureDetector(
          onTap: () { setState(() => _tab = i); if (i == 3) _loadTrips(); },
          child: Container(
            height: 32, alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? AppColors.foreground : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(labels[i], style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w800,
              color: active ? Colors.white : AppColors.foreground)),
          ),
        ));
      })),
    ),
  );

  Widget _requestForm() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        margin: const EdgeInsets.only(bottom: 12),
        height: 160,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.md),
          gradient: const LinearGradient(colors: [Color(0xFFE0F2FE), Color(0xFFDCFCE7)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        alignment: Alignment.center,
        child: const Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.mapPin, size: 32, color: AppColors.primary),
          SizedBox(height: 6),
          Text('Live map', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.muted)),
        ]),
      ),
      TextField(
        controller: _pickup,
        decoration: InputDecoration(
          hintText: 'Pickup',
          prefixIcon: const Icon(LucideIcons.mapPin, size: 16, color: AppColors.primary),
          suffixIcon: IconButton(icon: const Icon(LucideIcons.crosshair, size: 16), onPressed: _useMyLocation),
          filled: true, fillColor: AppColors.input,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide.none),
        ),
      ),
      const SizedBox(height: 8),
      TextField(
        controller: _dropoff,
        decoration: InputDecoration(
          hintText: 'Where to?',
          prefixIcon: const Icon(LucideIcons.navigation, size: 16, color: AppColors.orange),
          filled: true, fillColor: AppColors.input,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide.none),
        ),
      ),
      const SizedBox(height: 14),
      SizedBox(
        height: 96,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _classes.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final c = _classes[i];
            final active = _classIdx == i;
            return GestureDetector(
              onTap: () => setState(() => _classIdx = i),
              child: Container(
                width: 120, padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: active ? AppColors.foreground : AppColors.mutedSurface,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(c['icon'] as IconData, size: 18, color: active ? Colors.white : AppColors.foreground),
                  const Spacer(),
                  Text(c['label'] as String, style: TextStyle(fontWeight: FontWeight.w800, color: active ? Colors.white : AppColors.foreground)),
                  Text('${c['eta']} · ${c['seats']}', style: TextStyle(fontSize: 10, color: active ? Colors.white70 : AppColors.muted)),
                ]),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Suggested fare', style: TextStyle(fontSize: 11, color: AppColors.muted)),
            Text('\$${_fare.toStringAsFixed(2)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          ]),
          const Spacer(),
          Text('~ ${_distanceKm.toStringAsFixed(1)} km', style: const TextStyle(color: AppColors.muted)),
        ]),
      ),
      const SizedBox(height: 14),
      FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.foreground, foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        onPressed: _creating ? null : _requestRide,
        icon: const Icon(LucideIcons.zap, size: 16),
        label: Text(_creating ? 'Requesting…' : 'Request ride', style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      const SizedBox(height: 24),
    ]),
  );

  Widget _searchingView() => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.primary)),
        child: Row(children: [
          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 12),
          const Expanded(child: Text('Searching drivers…', style: TextStyle(fontWeight: FontWeight.w800))),
          TextButton(onPressed: _cancelRide, child: const Text('Cancel')),
        ]),
      ),
      const SizedBox(height: 12),
      const Text('Offers', style: TextStyle(fontWeight: FontWeight.w900)),
      const SizedBox(height: 8),
      Expanded(
        child: _offers.isEmpty
          ? const Center(child: Text('Waiting for driver offers…', style: TextStyle(color: AppColors.muted)))
          : ListView.separated(
              itemCount: _offers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final o = _offers[i];
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                  child: Row(children: [
                    CircleAvatar(child: Text('${(o['driver_name'] ?? '?').toString()[0]}')),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${o['driver_name'] ?? 'Driver'}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text('${o['vehicle_label'] ?? ''} · ETA ${o['eta_minutes'] ?? '?'} min · ⭐ ${o['driver_rating'] ?? '5'}',
                          style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                    ])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('\$${(o['fare'] as num?)?.toStringAsFixed(2) ?? '0'}', style: const TextStyle(fontWeight: FontWeight.w900)),
                      FilledButton(onPressed: () => _acceptOffer(o), style: FilledButton.styleFrom(minimumSize: const Size(80, 32)), child: const Text('Accept')),
                    ]),
                  ]),
                );
              },
            ),
      ),
    ]),
  );

  Widget _tripsList() {
    if (_trips.isEmpty) return const Center(child: Text('No trips yet', style: TextStyle(color: AppColors.muted)));
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _trips.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final t = _trips[i];
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(4)),
                child: Text('${t['status']}'.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
              ),
              const Spacer(),
              Text('\$${(t['final_fare'] ?? t['rider_offer'] ?? 0).toString()}', style: const TextStyle(fontWeight: FontWeight.w900)),
            ]),
            const SizedBox(height: 6),
            Row(children: [const Icon(LucideIcons.mapPin, size: 12, color: AppColors.success), const SizedBox(width: 4), Expanded(child: Text('${t['pickup_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)))]),
            Row(children: [const Icon(LucideIcons.mapPin, size: 12, color: AppColors.destructive), const SizedBox(width: 4), Expanded(child: Text('${t['dropoff_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)))]),
          ]),
        );
      },
    );
  }
}
