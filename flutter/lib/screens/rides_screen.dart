import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import 'rides/ride_chat_sheet.dart';
import 'rides/ride_data.dart';
import 'rides/ride_map_view.dart';
import 'rides/ride_pool_panel.dart';
import 'rides/ride_rating_sheet.dart';
import 'rides/ride_trips_panel.dart';

/// Mirrors `src/pages/Rides.tsx` — hero map with live HUD, route alternatives,
/// tabs (Now / Schedule / Pool / Trips), request form with class picker &
/// live fare, active-ride flow with offers / driver / chat / share / rating,
/// plus insight strip, demand zones, saved shortcuts, and live driver radar.
class RidesScreen extends StatefulWidget {
  const RidesScreen({super.key});
  @override
  State<RidesScreen> createState() => _RidesScreenState();
}

class _RidesScreenState extends State<RidesScreen> {
  // ------- location & inputs
  ({double lat, double lng})? _me;
  _PickedPlace? _pickup;
  _PickedPlace? _dropoff;
  bool _locBusy = false;

  // ------- ride config
  String _vClass = 'economy';
  double _fare = 5;
  final _notes = TextEditingController();
  String _tab = 'now';
  String _routeChoice = 'fastest';

  // ------- ride state
  String? _activeRideId;
  Map<String, dynamic>? _ride;
  List<Map<String, dynamic>> _offers = const [];
  bool _creating = false;
  bool _showRating = false;
  Map<String, dynamic>? _completedRide;

  // ------- live radar / demand
  List<DriverPin> _drivers = const [];
  List<SharedTripPin> _pool = const [];
  List<LatLng> _demand = const [];

  RealtimeChannel? _rideCh;
  RealtimeChannel? _offersCh;
  RealtimeChannel? _driversCh;
  RealtimeChannel? _demandCh;
  StreamSubscription<Position>? _posSub;
  Timer? _demandTimer;

  @override
  void initState() {
    super.initState();
    _initLocation();
    _rehydrateRide();
    _subscribeDrivers();
    _loadPool();
  }

  @override
  void dispose() {
    _notes.dispose();
    _posSub?.cancel();
    _demandTimer?.cancel();
    for (final ch in [_rideCh, _offersCh, _driversCh, _demandCh]) {
      if (ch != null) supabase.removeChannel(ch);
    }
    super.dispose();
  }

  // ============================================================ location
  Future<void> _initLocation() async {
    if (_locBusy) return;
    setState(() => _locBusy = true);
    try {
      final perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      final p = await Geolocator.getCurrentPosition().timeout(const Duration(seconds: 8));
      final me = (lat: p.latitude, lng: p.longitude);
      if (!mounted) return;
      setState(() => _me = me);
      if (_pickup == null) {
        final addr = await reverseGeocode(p.latitude, p.longitude);
        if (!mounted) return;
        setState(() => _pickup = _PickedPlace(p.latitude, p.longitude, addr));
      }
    } catch (_) {} finally {
      if (mounted) setState(() => _locBusy = false);
    }
  }

  Future<void> _useMyLocationFor(bool pickup) async {
    setState(() => _locBusy = true);
    try {
      final p = await Geolocator.getCurrentPosition().timeout(const Duration(seconds: 8));
      final addr = await reverseGeocode(p.latitude, p.longitude);
      if (!mounted) return;
      final v = _PickedPlace(p.latitude, p.longitude, addr);
      setState(() {
        if (pickup) _pickup = v; else _dropoff = v;
        _me = (lat: p.latitude, lng: p.longitude);
      });
    } catch (_) {} finally {
      if (mounted) setState(() => _locBusy = false);
    }
  }

  // ============================================================ realtime
  void _subscribeDrivers() {
    Future<void> load() async {
      final rows = await supabase.from('driver_locations').select('*').eq('online', true).limit(200);
      if (!mounted) return;
      var list = (rows as List).cast<Map<String, dynamic>>().map((d) => DriverPin(
            id: '${d['user_id']}',
            lat: (d['lat'] as num).toDouble(),
            lng: (d['lng'] as num).toDouble(),
            vehicleClass: '${d['vehicle_class']}',
            name: d['display_name'] as String?,
          )).toList();
      if (_me != null) {
        list = list.where((d) => haversineKm(_me!.lat, _me!.lng, d.lat, d.lng) <= 10).toList();
      }
      if (!mounted) return;
      setState(() => _drivers = list);
    }
    load();
    _driversCh = supabase.channel('rides:drivers').onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'driver_locations',
          callback: (_) => load(),
        ).subscribe();
  }

  Future<void> _loadPool() async {
    final since = DateTime.now().subtract(const Duration(minutes: 30)).toUtc().toIso8601String();
    final rows = await supabase
        .from('shared_trips')
        .select('id,current_lat,current_lng,dest_address,seats_available,origin_lat,origin_lng,status,departure_at')
        .inFilter('status', ['open', 'in_progress'])
        .gte('departure_at', since)
        .limit(60);
    if (!mounted) return;
    final list = (rows as List)
        .cast<Map<String, dynamic>>()
        .where((t) => t['current_lat'] != null && t['current_lng'] != null)
        .map((t) => SharedTripPin(
              id: '${t['id']}',
              lat: (t['current_lat'] as num).toDouble(),
              lng: (t['current_lng'] as num).toDouble(),
              destAddress: '${t['dest_address'] ?? ''}',
              seatsAvailable: (t['seats_available'] as num?)?.toInt() ?? 0,
            ))
        .toList();
    setState(() => _pool = list);
  }

  // ============================================================ ride flow
  Future<void> _rehydrateRide() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final row = await supabase
        .from('rides')
        .select('id')
        .eq('rider_id', uid)
        .inFilter('status', ['searching', 'offered', 'accepted', 'arriving', 'in_progress'])
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (row != null && row['id'] != null) {
      _bindRide('${row['id']}');
    }
  }

  void _bindRide(String rideId) {
    _activeRideId = rideId;
    _subscribeRide(rideId);
    _subscribeOffers(rideId);
    _startPositionTracking();
    setState(() {});
  }

  void _subscribeRide(String id) {
    Future<void> load() async {
      final r = await supabase.from('rides').select('*').eq('id', id).maybeSingle();
      if (!mounted) return;
      setState(() => _ride = r);
      if (r != null) {
        final st = '${r['status']}';
        if (st == 'cancelled') {
          _clearRide();
        } else if (st == 'completed' && !_showRating) {
          setState(() { _completedRide = r; _showRating = true; });
          _openRating(r);
          _clearRide(silent: true);
        }
      }
    }
    if (_rideCh != null) supabase.removeChannel(_rideCh!);
    load();
    _rideCh = supabase.channel('ride:$id').onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'rides',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'id', value: id),
          callback: (_) => load(),
        ).subscribe();
  }

  void _subscribeOffers(String id) {
    Future<void> load() async {
      final rows = await supabase.from('ride_offers').select('*').eq('ride_id', id).order('fare');
      if (!mounted) return;
      setState(() => _offers = (rows as List).cast<Map<String, dynamic>>());
    }
    if (_offersCh != null) supabase.removeChannel(_offersCh!);
    load();
    _offersCh = supabase.channel('ride-offers:$id').onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'ride_offers',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'ride_id', value: id),
          callback: (_) => load(),
        ).subscribe();
  }

  void _startPositionTracking() {
    _posSub?.cancel();
    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15),
    ).listen((p) async {
      if (_activeRideId == null) return;
      _me = (lat: p.latitude, lng: p.longitude);
      await supabase.from('rides').update({'rider_lat': p.latitude, 'rider_lng': p.longitude}).eq('id', _activeRideId!);
      if (mounted) setState(() {});
    });
  }

  void _clearRide({bool silent = false}) {
    if (_offersCh != null) { supabase.removeChannel(_offersCh!); _offersCh = null; }
    if (_rideCh != null) { supabase.removeChannel(_rideCh!); _rideCh = null; }
    _posSub?.cancel(); _posSub = null;
    if (mounted) setState(() { _activeRideId = null; _ride = null; _offers = const []; });
  }

  Future<void> _requestRide() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to request a ride')));
      return;
    }
    if (_pickup == null || _dropoff == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Set pickup and drop-off')));
      return;
    }
    setState(() => _creating = true);
    try {
      final active = _activeRoute;
      final row = await supabase.from('rides').insert({
        'rider_id': uid,
        'status': 'searching',
        'pickup_address': _pickup!.address,
        'pickup_lat': _pickup!.lat, 'pickup_lng': _pickup!.lng,
        'dropoff_address': _dropoff!.address,
        'dropoff_lat': _dropoff!.lat, 'dropoff_lng': _dropoff!.lng,
        'distance_km': double.parse((active?.km ?? _distance).toStringAsFixed(2)),
        'rider_offer': _fare,
        'vehicle_class': _vClass,
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'rider_lat': _me?.lat ?? _pickup!.lat,
        'rider_lng': _me?.lng ?? _pickup!.lng,
        'currency': 'USD',
      }).select('id').single();
      _bindRide('${row['id']}');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Looking for nearby drivers…')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _acceptOffer(Map<String, dynamic> o) async {
    if (_activeRideId == null) return;
    try {
      await supabase.from('ride_offers').update({'status': 'rejected'}).eq('ride_id', _activeRideId!).neq('id', o['id']);
      await supabase.from('ride_offers').update({'status': 'accepted'}).eq('id', o['id']);
      await supabase.from('rides').update({
        'driver_id': o['driver_id'],
        'status': 'accepted',
        'final_fare': o['fare'],
        'accepted_at': DateTime.now().toIso8601String(),
      }).eq('id', _activeRideId!);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Driver accepted! Heading your way.')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _cancelRide() async {
    if (_activeRideId == null) return;
    await supabase.from('rides').update({'status': 'cancelled'}).eq('id', _activeRideId!);
    _clearRide();
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ride cancelled')));
  }

  Future<void> _startTrip() async {
    if (_activeRideId == null) return;
    await supabase.from('rides').update({'status': 'in_progress', 'started_at': DateTime.now().toIso8601String()}).eq('id', _activeRideId!);
  }

  Future<void> _completeTrip() async {
    if (_activeRideId == null || _ride == null) return;
    await supabase.from('rides').update({'status': 'completed', 'completed_at': DateTime.now().toIso8601String()}).eq('id', _activeRideId!);
  }

  Future<void> _shareTrip() async {
    if (_ride == null) return;
    final url = 'https://pubstore.app/rides?share=${_ride!['id']}';
    await Share.share("I'm on a ${_ride!['vehicle_class']} ride to ${_ride!['dropoff_address']}. Track me: $url");
  }

  void _swap() {
    if (_pickup == null || _dropoff == null) return;
    setState(() { final p = _pickup; _pickup = _dropoff; _dropoff = p; });
  }

  Future<void> _openRating(Map<String, dynamic> r) async {
    final me = supabase.auth.currentUser?.id;
    final drv = r['driver_id'];
    if (me == null || drv == null) return;
    final match = _offers.where((o) => o['driver_id'] == drv).toList();
    final name = match.isNotEmpty ? '${match.first['driver_name'] ?? 'Driver'}' : 'Driver';
    await showRideRatingSheet(
      context,
      rideId: '${r['id']}',
      raterId: me,
      rateeId: '$drv',
      direction: 'rider_to_driver',
      rateeName: '$name',
    );
    if (mounted) setState(() { _showRating = false; _completedRide = null; });
  }

  Future<void> _quickDestination(String label) async {
    if (label == 'Home' || label == 'Work') {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('ride_saved_${label.toLowerCase()}');
      if (raw != null) {
        try {
          final j = jsonDecode(raw) as Map<String, dynamic>;
          setState(() => _dropoff = _PickedPlace(
                (j['lat'] as num).toDouble(),
                (j['lng'] as num).toDouble(),
                '${j['address']}',
              ));
          return;
        } catch (_) {}
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label not saved yet')));
      return;
    }
    final center = _pickup ?? (_me == null ? null : _PickedPlace(_me!.lat, _me!.lng, ''));
    final q = center == null ? label : '$label near ${center.lat.toStringAsFixed(3)},${center.lng.toStringAsFixed(3)}';
    final res = await searchPlace(q);
    if (res.isNotEmpty) {
      setState(() => _dropoff = _PickedPlace(res.first.lat, res.first.lng, res.first.label));
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No $label found nearby')));
    }
  }

  // ============================================================ derived
  double get _distance => (_pickup != null && _dropoff != null)
      ? haversineKm(_pickup!.lat, _pickup!.lng, _dropoff!.lat, _dropoff!.lng)
      : 0;

  List<RouteAlt> get _routes => (_pickup != null && _dropoff != null)
      ? buildRoutes(_pickup!.lat, _pickup!.lng, _dropoff!.lat, _dropoff!.lng)
      : const [];
  RouteAlt? get _activeRoute {
    if (_routes.isEmpty) return null;
    return _routes.firstWhere((r) => r.id == _routeChoice, orElse: () => _routes.first);
  }

  double get _surge => computeSurge(_drivers.length);
  double get _suggested => _distance > 0 ? suggestFare(_distance, _vClass) : 0;

  bool get _inActive => _ride != null && ['searching', 'offered', 'accepted', 'arriving', 'in_progress'].contains('${_ride!['status']}');

  @override
  void didUpdateWidget(covariant RidesScreen old) {
    super.didUpdateWidget(old);
  }

  void _syncFare() {
    if (_suggested > 0) {
      final v = double.parse((_suggested * _surge).toStringAsFixed(2));
      if ((v - _fare).abs() > 0.005) _fare = v;
    }
  }

  // ============================================================ UI
  @override
  Widget build(BuildContext context) {
    _syncFare();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _header(),
            _mapHero(),
            if (!_inActive) _tabStrip(),
            _mainPanel(),
            if (!_inActive && _pickup != null && _dropoff != null) _insightStrip(),
            _perks(),
            _demandZones(),
            _savedShortcuts(),
            _radar(),
          ]),
        ),
      ),
    );
  }

  Widget _header() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
    child: Row(children: [
      IconButton(icon: const Icon(LucideIcons.arrowLeft), onPressed: () => Navigator.of(context).maybePop()),
      _chip(icon: LucideIcons.radio, label: '${_drivers.length} LIVE', color: AppColors.ridesMint),
      const SizedBox(width: 6),
      _chip(icon: LucideIcons.flame, label: '${_surge.toStringAsFixed(2)}× SURGE', color: AppColors.warning),
      const Spacer(),
      _chip(icon: LucideIcons.wallet, label: 'Wallet', color: AppColors.primary, onTap: () => Navigator.of(context).pushNamed('/wallet')),
    ]),
  );

  Widget _chip({required IconData icon, required String label, required Color color, VoidCallback? onTap}) => GestureDetector(
    onTap: onTap,
    child: Container(
      height: 26, padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: color)),
      ]),
    ),
  );

  Widget _mapHero() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.42,
        child: Stack(children: [
          RideMapView(
            me: _me == null ? null : LatLng(_me!.lat, _me!.lng),
            pickup: _pickup == null ? null : LatLng(_pickup!.lat, _pickup!.lng),
            dropoff: _dropoff == null ? null : LatLng(_dropoff!.lat, _dropoff!.lng),
            driverPosition: (_ride != null && _ride!['driver_lat'] != null && _ride!['driver_lng'] != null)
                ? LatLng((_ride!['driver_lat'] as num).toDouble(), (_ride!['driver_lng'] as num).toDouble())
                : null,
            drivers: _inActive ? const [] : _drivers,
            sharedTrips: _inActive ? const [] : _pool,
            demand: _inActive ? const [] : _demand,
            routes: _routes,
            selectedRouteId: _routeChoice,
          ),
          Positioned(
            top: 8, right: 8,
            child: Material(
              color: Colors.white,
              shape: const CircleBorder(),
              elevation: 3,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _useMyLocationFor(true),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: _locBusy
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(LucideIcons.crosshair, size: 16, color: AppColors.primary),
                ),
              ),
            ),
          ),
          if (!_inActive && _routes.isNotEmpty)
            Positioned(
              left: 8, right: 8, bottom: 8,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  for (final r in _routes) _routePill(r),
                ]),
              ),
            ),
        ]),
      ),
    ),
  );

  Widget _routePill(RouteAlt r) {
    final active = r.id == _routeChoice;
    final trafficColor = switch (r.traffic) {
      'free' => AppColors.success,
      'light' => AppColors.primary,
      _ => AppColors.warning,
    };
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: () => setState(() => _routeChoice = r.id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: active ? AppColors.foreground : Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: active ? AppColors.foreground : AppColors.border),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 6, height: 6, decoration: BoxDecoration(color: trafficColor, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(r.label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: active ? Colors.white : AppColors.foreground)),
            const SizedBox(width: 6),
            Text('${r.mins}m · ${r.km.toStringAsFixed(1)}km', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: active ? Colors.white70 : AppColors.muted)),
          ]),
        ),
      ),
    );
  }

  Widget _tabStrip() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        _tabBtn('now', 'RIDE NOW', LucideIcons.zap),
        _tabBtn('schedule', 'SCHEDULE', LucideIcons.timer),
        _tabBtn('share', 'POOL', LucideIcons.users),
        _tabBtn('trips', 'TRIPS', LucideIcons.route),
      ]),
    ),
  );

  Widget _tabBtn(String id, String label, IconData icon) {
    final active = _tab == id;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = id),
        child: Container(
          height: 34, alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? AppColors.foreground : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 12, color: active ? Colors.white : AppColors.muted),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: active ? Colors.white : AppColors.muted)),
          ]),
        ),
      ),
    );
  }

  Widget _mainPanel() {
    if (_inActive) return _activePanel();
    if (_tab == 'share') {
      return Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: RidePoolPanel(me: _me));
    }
    if (_tab == 'trips') {
      return const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: RideTripsPanel());
    }
    return _requestPanel();
  }

  // ---------------------------------------------------------- request panel
  Widget _requestPanel() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _addressBlock(),
      if (_tab == 'schedule')
        Container(
          margin: const EdgeInsets.only(top: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
          child: const Row(children: [
            Icon(LucideIcons.timer, color: AppColors.primary, size: 14),
            SizedBox(width: 6),
            Expanded(child: Text("Schedule up to 7 days ahead. We'll match you 15 min before pickup.", style: TextStyle(fontSize: 11))),
          ]),
        ),
      const SizedBox(height: 12),
      Row(children: [
        const Text('CHOOSE A RIDE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted, letterSpacing: 1.2)),
        const Spacer(),
        if (_distance > 0)
          Text('${_distance.toStringAsFixed(1)} km · ~${_activeRoute?.mins ?? 0} min', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        for (final c in kVehicleClasses) Expanded(child: _classCard(c)),
      ]),
      const SizedBox(height: 12),
      _fareCard(),
      const SizedBox(height: 10),
      TextField(
        controller: _notes,
        maxLines: 2,
        decoration: InputDecoration(
          hintText: 'Notes for driver (optional)',
          filled: true, fillColor: AppColors.mutedSurface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadii.md), borderSide: BorderSide.none),
        ),
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: AppColors.foreground, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
        onPressed: _creating ? null : _requestRide,
        icon: const Icon(LucideIcons.zap, size: 16),
        label: Text(_creating ? 'Requesting…' : 'Request ride  •  \$${_fare.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
    ]),
  );

  Widget _addressBlock() => Container(
    padding: const EdgeInsets.all(6),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(16)),
    child: Column(children: [
      _AddressField(
        icon: LucideIcons.mapPin, iconColor: AppColors.success,
        hint: 'Pickup location',
        value: _pickup?.address,
        onCrosshair: () => _useMyLocationFor(true),
        onPicked: (p) => setState(() => _pickup = p),
      ),
      const Divider(height: 1, indent: 44),
      _AddressField(
        icon: LucideIcons.navigation, iconColor: AppColors.orange,
        hint: 'Where to?',
        value: _dropoff?.address,
        onPicked: (p) => setState(() => _dropoff = p),
        trailing: (_pickup != null && _dropoff != null)
            ? IconButton(icon: const Icon(LucideIcons.arrowUpDown, size: 16), onPressed: _swap)
            : null,
      ),
    ]),
  );

  Widget _classCard(VehicleClassMeta c) {
    final active = _vClass == c.id;
    final price = _distance > 0 ? suggestFare(_distance, c.id) * _surge : 0;
    final icon = c.id == 'moto' ? LucideIcons.bike : c.id == 'xl' ? LucideIcons.users : LucideIcons.car;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: GestureDetector(
        onTap: () => setState(() => _vClass = c.id),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: active ? AppColors.foreground : AppColors.mutedSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? AppColors.foreground : AppColors.border),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 16, color: active ? Colors.white : AppColors.foreground),
            const SizedBox(height: 6),
            Text(c.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: active ? Colors.white : AppColors.foreground)),
            Text(c.eta, style: TextStyle(fontSize: 9, color: active ? Colors.white70 : AppColors.muted)),
            if (price > 0)
              Text('\$${price.toStringAsFixed(2)}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: active ? Colors.white : AppColors.primary)),
          ]),
        ),
      ),
    );
  }

  Widget _fareCard() => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
    child: Row(children: [
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Your offer', style: TextStyle(fontSize: 11, color: AppColors.muted)),
        Text('\$${_fare.toStringAsFixed(2)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
        if (_surge > 1) Text('${_surge.toStringAsFixed(2)}× surge', style: const TextStyle(fontSize: 10, color: AppColors.warning, fontWeight: FontWeight.w800)),
      ]),
      const Spacer(),
      _stepBtn(LucideIcons.minus, () => setState(() => _fare = math.max(1, double.parse((_fare - 0.5).toStringAsFixed(2))))),
      const SizedBox(width: 8),
      _stepBtn(LucideIcons.plus, () => setState(() => _fare = double.parse((_fare + 0.5).toStringAsFixed(2)))),
    ]),
  );

  Widget _stepBtn(IconData i, VoidCallback tap) => InkWell(
    borderRadius: BorderRadius.circular(999),
    onTap: tap,
    child: Container(
      width: 36, height: 36,
      decoration: const BoxDecoration(color: AppColors.card, shape: BoxShape.circle),
      child: Icon(i, size: 16),
    ),
  );

  // ---------------------------------------------------------- active panel
  Widget _activePanel() {
    final status = '${_ride?['status'] ?? ''}';
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.primary.withValues(alpha: 0.4))),
          child: Row(children: [
            if (status == 'searching' || status == 'offered')
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            else
              Icon(LucideIcons.checkCircle2, color: AppColors.success),
            const SizedBox(width: 10),
            Expanded(child: Text(
              switch (status) {
                'searching' || 'offered' => 'Looking for drivers…',
                'accepted' => 'Driver on the way',
                'arriving' => 'Driver arriving',
                'in_progress' => 'Trip in progress',
                _ => status.toUpperCase(),
              },
              style: const TextStyle(fontWeight: FontWeight.w900),
            )),
            TextButton(onPressed: _cancelRide, child: const Text('Cancel', style: TextStyle(color: AppColors.danger))),
          ]),
        ),
        const SizedBox(height: 10),
        if (status == 'searching' || status == 'offered') _offersList(),
        if (['accepted', 'arriving', 'in_progress'].contains(status)) _driverCard(status),
      ]),
    );
  }

  Widget _offersList() {
    if (_offers.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: Text('Waiting for driver offers…', style: TextStyle(color: AppColors.muted))),
      );
    }
    return Column(children: [
      for (final o in _offers) Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          CircleAvatar(radius: 18, child: Text('${(o['driver_name'] ?? '?').toString()[0]}')),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${o['driver_name'] ?? 'Driver'}', style: const TextStyle(fontWeight: FontWeight.w800)),
            Text('${o['vehicle_label'] ?? ''} · ETA ${o['eta_minutes'] ?? '?'} min · ⭐ ${o['driver_rating'] ?? '5'}',
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('\$${(o['fare'] as num?)?.toStringAsFixed(2) ?? '0'}', style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            FilledButton(onPressed: () => _acceptOffer(o), style: FilledButton.styleFrom(minimumSize: const Size(72, 30), backgroundColor: AppColors.primary), child: const Text('Accept', style: TextStyle(fontSize: 12))),
          ]),
        ]),
      ),
    ]);
  }

  Widget _driverCard(String status) {
    final r = _ride!;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          const CircleAvatar(radius: 22, child: Icon(LucideIcons.car, size: 20)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Your driver', style: TextStyle(fontSize: 11, color: AppColors.muted)),
            Text('${r['vehicle_class']}', style: const TextStyle(fontWeight: FontWeight.w900)),
          ])),
          Text('\$${(r['final_fare'] as num?)?.toStringAsFixed(2) ?? ''}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: OutlinedButton.icon(
            onPressed: () => showRideChatSheet(context, rideId: '${r['id']}'),
            icon: const Icon(LucideIcons.messageCircle, size: 14), label: const Text('Chat'),
          )),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton.icon(
            onPressed: _shareTrip,
            icon: const Icon(LucideIcons.share2, size: 14), label: const Text('Share'),
          )),
        ]),
        const SizedBox(height: 8),
        if (status == 'accepted' || status == 'arriving')
          FilledButton.icon(onPressed: _startTrip, style: FilledButton.styleFrom(backgroundColor: AppColors.foreground), icon: const Icon(LucideIcons.playCircle, size: 16), label: const Text('Start trip')),
        if (status == 'in_progress')
          FilledButton.icon(onPressed: _completeTrip, style: FilledButton.styleFrom(backgroundColor: AppColors.success), icon: const Icon(LucideIcons.checkCircle2, size: 16), label: const Text('Complete trip')),
      ]),
    );
  }

  // ---------------------------------------------------------- extra sections
  Widget _insightStrip() {
    final km = _activeRoute?.km ?? _distance;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      child: Row(children: [
        _insight(LucideIcons.route, 'Route', '${km.toStringAsFixed(1)}km', AppColors.primary),
        _insight(LucideIcons.timer, 'ETA', '${_activeRoute?.mins ?? 0}m', AppColors.success),
        _insight(LucideIcons.fuel, 'CO₂', '${(km * 0.19).toStringAsFixed(1)}kg', AppColors.warning),
        _insight(LucideIcons.leaf, 'Saved', '\$${(km * 0.35).toStringAsFixed(1)}', AppColors.priceRed),
      ]),
    );
  }

  Widget _insight(IconData icon, String label, String value, Color tone) => Expanded(
    child: Container(
      margin: const EdgeInsets.symmetric(horizontal: 3),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 14, color: tone),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      ]),
    ),
  );

  Widget _perks() => Padding(
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
    child: Row(children: [
      _perk(LucideIcons.shield, 'Verified drivers', AppColors.success),
      _perk(LucideIcons.zap, 'Fair-fare bidding', AppColors.warning),
      _perk(LucideIcons.wallet, 'In-app wallet', AppColors.primary),
    ]),
  );

  Widget _perk(IconData i, String l, Color c) => Expanded(child: Container(
    margin: const EdgeInsets.symmetric(horizontal: 3), padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
    child: Row(children: [Icon(i, size: 12, color: c), const SizedBox(width: 4), Expanded(child: Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)))]),
  ));

  Widget _demandZones() {
    const zones = [
      ('City Center', 'High', '1.4×', '+12%', LucideIcons.flame, AppColors.priceRed),
      ('Airport', 'Peak', '1.7×', '+28%', LucideIcons.trendingUp, AppColors.primary),
      ('University', 'Medium', '1.1×', '+4%', LucideIcons.activity, AppColors.accent),
      ('Suburbs', 'Low', '1.0×', '−2%', LucideIcons.leaf, AppColors.success),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(padding: EdgeInsets.only(bottom: 6),
          child: Text('Demand zones', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final z in zones)
            SizedBox(
              width: (MediaQuery.of(context).size.width - 32) / 2,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(width: 30, height: 30, decoration: BoxDecoration(color: z.$6.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)), child: Icon(z.$5, size: 16, color: z.$6)),
                    const Spacer(),
                    Text(z.$4, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted)),
                  ]),
                  const SizedBox(height: 6),
                  Text(z.$1, style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text('${z.$2} demand', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                  Text('${z.$3} surge', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.primary)),
                ]),
              ),
            ),
        ]),
      ]),
    );
  }

  Widget _savedShortcuts() {
    final items = <(String, String, IconData, Color)>[
      ('Home', 'Set address', LucideIcons.mapPin, AppColors.success),
      ('Work', 'Set address', LucideIcons.mapPin, AppColors.primary),
      ('Airport', 'Quick fare', LucideIcons.navigation, AppColors.accent),
      ('Mall', 'Quick fare', LucideIcons.sparkles, AppColors.warning),
      ('Hospital', 'Priority', LucideIcons.alertTriangle, AppColors.danger),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(padding: EdgeInsets.only(bottom: 6),
          child: Text('Saved & frequent', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900))),
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final s = items[i];
              return GestureDetector(
                onTap: () => _quickDestination(s.$1),
                child: Container(
                  width: 128, padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 32, height: 32, decoration: BoxDecoration(color: s.$4.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)), child: Icon(s.$3, size: 16, color: s.$4)),
                    const Spacer(),
                    Text(s.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
                    Text(s.$2, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  Widget _radar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(LucideIcons.radio, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          const Text('Live radar', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
          const Spacer(),
          TextButton.icon(
            onPressed: () => Navigator.of(context).pushNamed('/driver'),
            icon: const Icon(LucideIcons.car, size: 12),
            label: const Text('Switch to driver', style: TextStyle(fontSize: 11)),
          ),
        ]),
        Container(
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
          child: _drivers.isEmpty
              ? const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('No drivers in range. Try again in a moment.', style: TextStyle(color: AppColors.muted))))
              : Column(children: [
                  for (final d in _drivers.take(6)) _radarRow(d),
                ]),
        ),
      ]),
    );
  }

  Widget _radarRow(DriverPin d) {
    final km = _me == null ? 0.0 : haversineKm(_me!.lat, _me!.lng, d.lat, d.lng);
    final eta = math.max(1, (km * 2.2).round());
    final icon = d.vehicleClass == 'moto' ? LucideIcons.bike : LucideIcons.car;
    return InkWell(
      onTap: () => setState(() => _vClass = d.vehicleClass),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)), child: Icon(icon, size: 16, color: AppColors.foreground)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(d.name ?? 'Driver', style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(d.vehicleClass, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${km.toStringAsFixed(1)}km', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
            Text('${eta}m', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
          ]),
        ]),
      ),
    );
  }
}

class _PickedPlace {
  const _PickedPlace(this.lat, this.lng, this.address);
  final double lat;
  final double lng;
  final String address;
}

/// Address input with Nominatim typeahead in a bottom sheet.
class _AddressField extends StatefulWidget {
  const _AddressField({
    required this.icon, required this.iconColor,
    required this.hint, required this.value,
    required this.onPicked, this.onCrosshair, this.trailing,
  });
  final IconData icon;
  final Color iconColor;
  final String hint;
  final String? value;
  final void Function(_PickedPlace) onPicked;
  final VoidCallback? onCrosshair;
  final Widget? trailing;

  @override
  State<_AddressField> createState() => _AddressFieldState();
}

class _AddressFieldState extends State<_AddressField> {
  Future<void> _open() async {
    final picked = await showModalBottomSheet<_PickedPlace>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FractionallySizedBox(heightFactor: 0.85, child: _PlaceSearchSheet(hint: widget.hint)),
    );
    if (picked != null) widget.onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _open,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(children: [
          Container(width: 28, height: 28, alignment: Alignment.center,
            decoration: BoxDecoration(color: widget.iconColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
            child: Icon(widget.icon, size: 14, color: widget.iconColor)),
          const SizedBox(width: 10),
          Expanded(child: Text(
            widget.value ?? widget.hint,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: widget.value == null ? AppColors.muted : AppColors.foreground,
            ),
          )),
          if (widget.onCrosshair != null)
            IconButton(onPressed: widget.onCrosshair, icon: const Icon(LucideIcons.crosshair, size: 16), color: AppColors.primary),
          if (widget.trailing != null) widget.trailing!,
        ]),
      ),
    );
  }
}

class _PlaceSearchSheet extends StatefulWidget {
  const _PlaceSearchSheet({required this.hint});
  final String hint;
  @override
  State<_PlaceSearchSheet> createState() => _PlaceSearchSheetState();
}

class _PlaceSearchSheetState extends State<_PlaceSearchSheet> {
  final _c = TextEditingController();
  Timer? _debounce;
  List<PlaceHit> _hits = const [];
  bool _loading = false;

  @override
  void dispose() { _c.dispose(); _debounce?.cancel(); super.dispose(); }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (v.trim().length < 3) { setState(() => _hits = const []); return; }
      setState(() => _loading = true);
      final r = await searchPlace(v.trim());
      if (!mounted) return;
      setState(() { _hits = r; _loading = false; });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          child: Row(children: [
            IconButton(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(LucideIcons.x)),
            Expanded(
              child: TextField(
                controller: _c, autofocus: true,
                onChanged: _onChanged,
                decoration: InputDecoration(
                  hintText: widget.hint,
                  filled: true, fillColor: AppColors.mutedSurface,
                  prefixIcon: const Icon(LucideIcons.search, size: 16),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ),
          ]),
        ),
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        Expanded(
          child: _hits.isEmpty
              ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Type a place, address or landmark', style: TextStyle(color: AppColors.muted))))
              : ListView.separated(
                  itemCount: _hits.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, indent: 48),
                  itemBuilder: (_, i) {
                    final h = _hits[i];
                    return ListTile(
                      leading: const Icon(LucideIcons.mapPin, size: 18, color: AppColors.primary),
                      title: Text(h.label, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                      onTap: () => Navigator.of(context).pop(_PickedPlace(h.lat, h.lng, h.label)),
                    );
                  },
                ),
        ),
      ]),
    );
  }
}
