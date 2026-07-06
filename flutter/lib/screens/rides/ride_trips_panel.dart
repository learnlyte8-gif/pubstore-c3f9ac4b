import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

/// Past + current rides for the signed-in user. Mirrors the Trips tab.
class RideTripsPanel extends StatefulWidget {
  const RideTripsPanel({super.key});
  @override
  State<RideTripsPanel> createState() => _RideTripsPanelState();
}

class _RideTripsPanelState extends State<RideTripsPanel> {
  List<Map<String, dynamic>> _trips = const [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() { _loading = false; }); return; }
    final rows = await supabase.from('rides').select('*').eq('rider_id', uid).order('created_at', ascending: false).limit(50);
    if (!mounted) return;
    setState(() { _trips = (rows as List).cast<Map<String, dynamic>>(); _loading = false; });
  }

  Color _statusColor(String s) => switch (s) {
        'completed' => AppColors.success,
        'cancelled' => AppColors.danger,
        'in_progress' || 'accepted' || 'arriving' => AppColors.primary,
        _ => AppColors.warning,
      };

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    if (_trips.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: Text('No trips yet', style: TextStyle(color: AppColors.muted))),
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
        final status = '${t['status'] ?? ''}';
        final fare = (t['final_fare'] ?? t['rider_offer'] ?? 0);
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: _statusColor(status).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                child: Text(status.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _statusColor(status))),
              ),
              const Spacer(),
              Text('\$${(fare as num).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900)),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(LucideIcons.mapPin, size: 12, color: AppColors.success),
              const SizedBox(width: 4),
              Expanded(child: Text('${t['pickup_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12))),
            ]),
            const SizedBox(height: 3),
            Row(children: [
              const Icon(LucideIcons.navigation, size: 12, color: AppColors.orange),
              const SizedBox(width: 4),
              Expanded(child: Text('${t['dropoff_address'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12))),
            ]),
          ]),
        );
      },
    );
  }
}
