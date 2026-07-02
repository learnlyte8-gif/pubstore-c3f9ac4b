import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Driver.tsx` — driver dashboard: online toggle, current
/// ride, and earnings.
class DriverScreen extends StatefulWidget {
  const DriverScreen({super.key});
  @override
  State<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
  bool _online = false;
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _currentRide;
  double _todayEarnings = 0;
  int _todayRides = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final p = await supabase.from('driver_profiles').select('*').eq('user_id', uid).maybeSingle();
    final current = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', uid)
        .inFilter('status', ['accepted', 'in_progress'])
        .maybeSingle();
    final since = DateTime.now().toUtc().subtract(const Duration(hours: 24)).toIso8601String();
    final rides = await supabase
        .from('rides')
        .select('fare')
        .eq('driver_id', uid)
        .eq('status', 'completed')
        .gte('completed_at', since);
    if (!mounted) return;
    double earnings = 0;
    for (final r in (rides as List)) {
      earnings += ((r as Map)['fare'] as num?)?.toDouble() ?? 0;
    }
    setState(() {
      _profile = p == null ? null : Map<String, dynamic>.from(p);
      _online = _profile?['online'] == true;
      _currentRide = current == null ? null : Map<String, dynamic>.from(current);
      _todayRides = (rides).length;
      _todayEarnings = earnings;
    });
  }

  Future<void> _toggleOnline(bool v) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _online = v);
    await supabase.from('driver_profiles').upsert({'user_id': uid, 'online': v, 'last_seen_at': DateTime.now().toIso8601String()});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Driver hub')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: _online ? AppColors.success : AppColors.mutedSurface, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Icon(_online ? LucideIcons.radio : LucideIcons.circleOff, color: _online ? Colors.white : AppColors.muted),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_online ? 'You’re online' : 'Go online', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: _online ? Colors.white : AppColors.foreground)),
                Text(_online ? 'Receiving ride requests' : 'Tap to start accepting rides', style: TextStyle(color: _online ? Colors.white70 : AppColors.muted, fontSize: 12)),
              ]),
            ),
            Switch(value: _online, onChanged: _toggleOnline),
          ]),
        ),
        const SizedBox(height: 20),
        Row(children: [
          _kpi('Today’s earnings', '\$${_todayEarnings.toStringAsFixed(2)}', LucideIcons.dollarSign, AppColors.success),
          const SizedBox(width: 10),
          _kpi('Rides today', '$_todayRides', LucideIcons.car, AppColors.primary),
        ]),
        const SizedBox(height: 24),
        if (_currentRide != null) ...[
          const Text('Current ride', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.primary)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(LucideIcons.mapPin, size: 16, color: AppColors.success),
                const SizedBox(width: 6),
                Expanded(child: Text('${_currentRide!['pickup_address'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 6),
              Row(children: [
                const Icon(LucideIcons.mapPin, size: 16, color: AppColors.destructive),
                const SizedBox(width: 6),
                Expanded(child: Text('${_currentRide!['dropoff_address'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 10),
              Text('Fare: \$${_currentRide!['fare'] ?? '—'} · ${_currentRide!['status']}', style: const TextStyle(fontWeight: FontWeight.w800)),
            ]),
          ),
        ] else
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(14)),
            child: const Center(child: Text('No active ride — waiting for requests', style: TextStyle(color: AppColors.muted))),
          ),
      ]),
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
}
