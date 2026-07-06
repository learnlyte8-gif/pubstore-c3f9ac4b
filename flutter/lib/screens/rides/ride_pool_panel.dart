import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';
import 'ride_data.dart';

/// Nearby shared trips + join. Mirrors `PoolPanel.tsx`.
class RidePoolPanel extends StatefulWidget {
  const RidePoolPanel({super.key, this.me});
  final ({double lat, double lng})? me;
  @override
  State<RidePoolPanel> createState() => _RidePoolPanelState();
}

class _RidePoolPanelState extends State<RidePoolPanel> {
  List<Map<String, dynamic>> _trips = const [];
  RealtimeChannel? _ch;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    _ch = supabase.channel('shared-trips-mobile').onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'shared_trips',
          callback: (_) => _load(),
        ).subscribe();
  }

  @override
  void dispose() {
    if (_ch != null) supabase.removeChannel(_ch!);
    super.dispose();
  }

  Future<void> _load() async {
    final since = DateTime.now().subtract(const Duration(minutes: 30)).toUtc().toIso8601String();
    final rows = await supabase
        .from('shared_trips')
        .select('*')
        .inFilter('status', ['open', 'in_progress'])
        .gte('departure_at', since)
        .order('departure_at')
        .limit(100);
    if (!mounted) return;
    var all = (rows as List).cast<Map<String, dynamic>>();
    if (widget.me != null) {
      all = all.where((t) {
        final la = (t['origin_lat'] as num?)?.toDouble();
        final lo = (t['origin_lng'] as num?)?.toDouble();
        if (la == null || lo == null) return false;
        return haversineKm(widget.me!.lat, widget.me!.lng, la, lo) <= 25;
      }).toList();
    }
    setState(() { _trips = all; _loading = false; });
  }

  Future<void> _join(Map<String, dynamic> t) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to join')));
      return;
    }
    try {
      await supabase.from('shared_trip_joins').insert({
        'trip_id': t['id'],
        'rider_id': uid,
        'seats': 1,
        'status': 'pending',
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Join request sent')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    if (_trips.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: Text('No shared trips nearby right now', style: TextStyle(color: AppColors.muted))),
      );
    }
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      itemCount: _trips.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final t = _trips[i];
        final seatsA = (t['seats_available'] as num?)?.toInt() ?? 0;
        final seatsT = (t['seats_total'] as num?)?.toInt() ?? 0;
        final price = (t['seat_price'] as num?)?.toDouble() ?? 0;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(LucideIcons.users, size: 14, color: AppColors.ridesMint),
              const SizedBox(width: 6),
              Expanded(child: Text('${t['origin_address'] ?? ''} → ${t['dest_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
            ]),
            const SizedBox(height: 6),
            Row(children: [
              Text('$seatsA/$seatsT seats', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              const SizedBox(width: 12),
              Text('\$${price.toStringAsFixed(2)} / seat', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              const Spacer(),
              FilledButton(
                onPressed: seatsA > 0 ? () => _join(t) : null,
                style: FilledButton.styleFrom(minimumSize: const Size(72, 32), backgroundColor: AppColors.foreground),
                child: const Text('Join', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ]),
          ]),
        );
      },
    );
  }
}
