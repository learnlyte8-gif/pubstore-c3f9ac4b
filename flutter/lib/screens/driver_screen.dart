import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Driver.tsx` — driver hub: online toggle, active ride,
/// earnings, and incoming ride requests with offer submission.
class DriverScreen extends StatefulWidget {
  const DriverScreen({super.key});
  @override
  State<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
  bool _online = false;
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _currentRide;
  List<Map<String, dynamic>> _requests = const [];
  double _todayEarnings = 0;
  int _todayRides = 0;
  StreamSubscription? _reqSub;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reqSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final p = await supabase.from('driver_profiles').select('*').eq('user_id', uid).maybeSingle();
    final current = await supabase.from('rides').select('*').eq('driver_id', uid)
        .inFilter('status', ['accepted', 'arriving', 'in_progress']).maybeSingle();
    final since = DateTime.now().toUtc().subtract(const Duration(hours: 24)).toIso8601String();
    final rides = await supabase.from('rides').select('final_fare')
        .eq('driver_id', uid).eq('status', 'completed').gte('completed_at', since);
    if (!mounted) return;
    double earnings = 0;
    for (final r in (rides as List)) {
      earnings += ((r as Map)['final_fare'] as num?)?.toDouble() ?? 0;
    }
    setState(() {
      _profile = p == null ? null : Map<String, dynamic>.from(p);
      _online = _profile?['online'] == true;
      _currentRide = current == null ? null : Map<String, dynamic>.from(current);
      _todayRides = rides.length;
      _todayEarnings = earnings;
    });
    if (_online) _subscribeRequests();
  }

  Future<void> _toggleOnline(bool v) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _online = v);
    await supabase.from('driver_profiles').upsert({
      'user_id': uid, 'online': v, 'last_seen_at': DateTime.now().toIso8601String(),
    });
    if (v) {
      _subscribeRequests();
    } else {
      _reqSub?.cancel();
      setState(() => _requests = const []);
    }
  }

  void _subscribeRequests() {
    _loadRequests();
    _reqSub?.cancel();
    _reqSub = supabase
        .channel('driver-requests')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'rides',
          callback: (_) => _loadRequests(),
        )
        .subscribe() as StreamSubscription?;
  }

  Future<void> _loadRequests() async {
    final since = DateTime.now().toUtc().subtract(const Duration(minutes: 20)).toIso8601String();
    final rows = await supabase.from('rides').select('*')
        .inFilter('status', ['searching', 'offered'])
        .gte('created_at', since).order('created_at', ascending: false).limit(30);
    if (!mounted) return;
    setState(() => _requests = (rows as List).cast<Map<String, dynamic>>());
  }

  Future<void> _sendOffer(Map<String, dynamic> req, double fare) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null || _profile == null) return;
    try {
      await supabase.from('ride_offers').insert({
        'ride_id': req['id'],
        'driver_id': uid,
        'driver_name': _profile!['display_name'] ?? 'Driver',
        'driver_avatar': _profile!['selfie_photo'],
        'driver_rating': (_profile!['rating'] as num?)?.toDouble() ?? 5,
        'driver_trips': _profile!['trips'] ?? 0,
        'vehicle_label': '${_profile!['vehicle_color'] ?? ''} ${_profile!['vehicle_make'] ?? ''} ${_profile!['vehicle_model'] ?? ''}'.trim(),
        'vehicle_plate': _profile!['vehicle_plate'],
        'fare': fare,
        'eta_minutes': math.max(2, (req['distance_km'] as num?)?.toInt() ?? 5),
      });
      await supabase.from('rides').update({'status': 'offered'}).eq('id', req['id']);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Offer sent for \$${fare.toStringAsFixed(2)}')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _advance(String next) async {
    if (_currentRide == null) return;
    final stamps = <String, dynamic>{};
    if (next == 'in_progress') stamps['started_at'] = DateTime.now().toIso8601String();
    if (next == 'completed') stamps['completed_at'] = DateTime.now().toIso8601String();
    await supabase.from('rides').update({'status': next, ...stamps}).eq('id', _currentRide!['id']);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Driver hub')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: _online ? AppColors.success : AppColors.mutedSurface, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Icon(_online ? LucideIcons.radio : LucideIcons.circleOff, color: _online ? Colors.white : AppColors.muted),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_online ? "You're online" : 'Go online', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: _online ? Colors.white : AppColors.foreground)),
                Text(_online ? 'Receiving ride requests' : 'Tap to start accepting rides',
                    style: TextStyle(color: _online ? Colors.white70 : AppColors.muted, fontSize: 12)),
              ])),
              Switch(value: _online, onChanged: _toggleOnline),
            ]),
          ),
          const SizedBox(height: 16),
          Row(children: [
            _kpi("Today's earnings", '\$${_todayEarnings.toStringAsFixed(2)}', LucideIcons.dollarSign, AppColors.success),
            const SizedBox(width: 10),
            _kpi('Rides today', '$_todayRides', LucideIcons.car, AppColors.primary),
          ]),
          const SizedBox(height: 20),
          if (_currentRide != null) ...[
            const Text('Current ride', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _activeRideCard(),
            const SizedBox(height: 20),
          ],
          if (_online) ...[
            Row(children: [
              const Text('Incoming requests', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text('${_requests.length} nearby', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ]),
            const SizedBox(height: 8),
            if (_requests.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
                child: const Center(child: Text('Waiting for nearby riders…', style: TextStyle(color: AppColors.muted))),
              )
            else
              ..._requests.map((r) => Padding(padding: const EdgeInsets.only(bottom: 8), child: _RequestCard(req: r, onSend: (f) => _sendOffer(r, f)))),
          ] else if (_currentRide == null)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
              child: const Center(child: Text('Go online to receive ride requests', style: TextStyle(color: AppColors.muted))),
            ),
        ]),
      ),
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]),
    ),
  );

  Widget _activeRideCard() {
    final r = _currentRide!;
    final status = '${r['status']}';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.primary)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(LucideIcons.mapPin, size: 14, color: AppColors.success), const SizedBox(width: 6),
          Expanded(child: Text('${r['pickup_address'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          const Icon(LucideIcons.mapPin, size: 14, color: AppColors.destructive), const SizedBox(width: 6),
          Expanded(child: Text('${r['dropoff_address'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        const SizedBox(height: 10),
        Text('Fare: \$${r['final_fare'] ?? r['rider_offer'] ?? '—'} · ${status.toUpperCase()}', style: const TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (status == 'accepted') Row(children: [
          Expanded(child: FilledButton(onPressed: () => _advance('arriving'), child: const Text("I'm on the way"))),
          const SizedBox(width: 8),
          Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.primary), onPressed: () => _advance('in_progress'), child: const Text('Start'))),
        ]),
        if (status == 'arriving')
          SizedBox(width: double.infinity, child: FilledButton(onPressed: () => _advance('in_progress'), child: const Text('Start trip'))),
        if (status == 'in_progress')
          SizedBox(width: double.infinity, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.destructive), onPressed: () => _advance('completed'), child: const Text('Complete trip'))),
      ]),
    );
  }
}

class _RequestCard extends StatefulWidget {
  const _RequestCard({required this.req, required this.onSend});
  final Map<String, dynamic> req;
  final void Function(double fare) onSend;
  @override
  State<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<_RequestCard> {
  late double _fare;
  @override
  void initState() {
    super.initState();
    _fare = ((widget.req['rider_offer'] as num?) ?? 5).toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.req;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${r['vehicle_class'] ?? ''} · ${(r['distance_km'] as num?)?.toStringAsFixed(1) ?? '?'} km',
              style: const TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w700))),
          Text('Rider offers \$${(r['rider_offer'] as num?)?.toStringAsFixed(2) ?? '?'}',
              style: const TextStyle(fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 6),
        Row(children: [const Icon(LucideIcons.mapPin, size: 12, color: AppColors.success), const SizedBox(width: 4),
          Expanded(child: Text('${r['pickup_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)))]),
        Row(children: [const Icon(LucideIcons.mapPin, size: 12, color: AppColors.destructive), const SizedBox(width: 4),
          Expanded(child: Text('${r['dropoff_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)))]),
        const SizedBox(height: 8),
        Row(children: [
          IconButton(icon: const Icon(LucideIcons.minus, size: 16), onPressed: () => setState(() => _fare = math.max(1, _fare - 0.5))),
          Text('\$${_fare.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900)),
          IconButton(icon: const Icon(LucideIcons.plus, size: 16), onPressed: () => setState(() => _fare += 0.5)),
          const Spacer(),
          FilledButton(onPressed: () => widget.onSend(_fare), child: const Text('Send offer')),
        ]),
      ]),
    );
  }
}
