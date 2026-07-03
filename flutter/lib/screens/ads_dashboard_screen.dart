import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import 'ad_campaign_wizard_screen.dart';

/// Mirrors `src/pages/ads/AdsDashboard.tsx` — list of ad campaigns owned by
/// the current user with impressions/click stats.
class AdsDashboardScreen extends StatefulWidget {
  const AdsDashboardScreen({super.key});
  @override
  State<AdsDashboardScreen> createState() => _AdsDashboardScreenState();
}

class _AdsDashboardScreenState extends State<AdsDashboardScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return [];
    final rows = await supabase
        .from('ad_campaigns')
        .select('*, ad_campaign_stats(impressions, clicks)')
        .eq('advertiser_id', uid)
        .order('created_at', ascending: false);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ads'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.plus),
            onPressed: () async {
              final r = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const AdCampaignWizardScreen()));
              if (r == true) setState(() => _future = _load());
            },
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final rows = snap.data ?? const [];
          if (rows.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(LucideIcons.megaphone, size: 44, color: AppColors.muted),
                  const SizedBox(height: 10),
                  const Text('No campaigns yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  const Text('Run an ad to reach shoppers across feed, search, and category screens.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () async {
                      final r = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const AdCampaignWizardScreen()));
                      if (r == true) setState(() => _future = _load());
                    },
                    icon: const Icon(LucideIcons.plus, size: 16),
                    label: const Text('Create campaign'),
                    style: FilledButton.styleFrom(backgroundColor: AppColors.orange),
                  ),
                ]),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final c = rows[i];
              final stats = (c['ad_campaign_stats'] ?? []) as List;
              int impressions = 0, clicks = 0;
              for (final s in stats) {
                impressions += ((s as Map)['impressions'] as num?)?.toInt() ?? 0;
                clicks += ((s)['clicks'] as num?)?.toInt() ?? 0;
              }
              final ctr = impressions == 0 ? 0.0 : (clicks / impressions) * 100;
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('${c['name'] ?? 'Campaign'}', style: const TextStyle(fontWeight: FontWeight.w800))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: c['status'] == 'active' ? AppColors.success.withOpacity(.15) : AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
                      child: Text('${c['status']}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: c['status'] == 'active' ? AppColors.success : AppColors.muted)),
                    ),
                  ]),
                  const SizedBox(height: 6),
                  Text('Budget \$${c['daily_budget'] ?? 0}/day · Bid \$${c['bid'] ?? '—'}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  const SizedBox(height: 10),
                  Row(children: [
                    _stat('$impressions', 'Impressions'),
                    const SizedBox(width: 24),
                    _stat('$clicks', 'Clicks'),
                    const SizedBox(width: 24),
                    _stat('${ctr.toStringAsFixed(1)}%', 'CTR'),
                  ]),
                ]),
              );
            },
          );
        },
      ),
    );
  }

  Widget _stat(String v, String l) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(v, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
        Text(l, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      ]);
}
