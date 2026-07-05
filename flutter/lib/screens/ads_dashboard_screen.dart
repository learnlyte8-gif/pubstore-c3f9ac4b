import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'ad_campaign_wizard_screen.dart';

/// Mirrors `src/pages/ads/AdsDashboard.tsx` — totals row + list of ad
/// campaigns with pause / activate toggles.
class AdsDashboardScreen extends StatefulWidget {
  const AdsDashboardScreen({super.key});
  @override
  State<AdsDashboardScreen> createState() => _AdsDashboardScreenState();
}

const _placementLabels = <String, String>{
  'banner': 'Sticky banner',
  'inline': 'Feed card',
  'interstitial': 'Full-screen',
  'rewarded': 'Rewarded reel',
};

class _AdsDashboardScreenState extends State<AdsDashboardScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return const [];
    try {
      final rows = await supabase
          .from('ad_campaigns')
          .select('*')
          .order('created_at', ascending: false);
      return (rows as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> _toggle(Map<String, dynamic> c) async {
    final next = c['status'] == 'active' ? 'paused' : 'active';
    try {
      await supabase.from('ad_campaigns').update({'status': next}).eq('id', c['id']);
      setState(() => _future = _load());
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _newCampaign() async {
    final ok = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => const AdCampaignWizardScreen()));
    if (ok == true) setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('PUBSTORE Ads', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          Text('Promote your products across the marketplace',
              style: TextStyle(fontSize: 11, color: AppColors.muted)),
        ]),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilledButton.icon(
              onPressed: _newCampaign,
              icon: const Icon(LucideIcons.plus, size: 14),
              label: const Text('New'),
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12)),
            ),
          ),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final rows = snap.data ?? const [];
          int impressions = 0, clicks = 0;
          double spent = 0;
          for (final c in rows) {
            impressions += ((c['impressions'] ?? 0) as num).toInt();
            clicks += ((c['clicks'] ?? 0) as num).toInt();
            spent += ((c['total_spent'] ?? 0) as num).toDouble();
          }
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: rows.length + 2,
            itemBuilder: (context, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(children: [
                    _stat('Impressions', '$impressions', LucideIcons.eye),
                    const SizedBox(width: 8),
                    _stat('Clicks', '$clicks', LucideIcons.mousePointerClick),
                    const SizedBox(width: 8),
                    _stat('Spent', '\$${spent.toStringAsFixed(2)}', LucideIcons.dollarSign),
                  ]),
                );
              }
              if (i == 1) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
                  child: Text('YOUR CAMPAIGNS',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1)),
                );
              }
              if (rows.isEmpty && i == 2) {
                return Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(children: [
                    const Icon(LucideIcons.megaphone, size: 44, color: AppColors.muted),
                    const SizedBox(height: 10),
                    const Text('No campaigns yet', style: TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    const Text('Run your first ad to reach buyers across PUBSTORE.',
                        textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 16),
                    FilledButton.icon(onPressed: _newCampaign, icon: const Icon(LucideIcons.plus, size: 14), label: const Text('Create campaign')),
                  ]),
                );
              }
              final c = rows[i - 2];
              final imp = ((c['impressions'] ?? 0) as num).toInt();
              final clk = ((c['clicks'] ?? 0) as num).toInt();
              final ctr = imp == 0 ? '0.0' : ((clk / imp) * 100).toStringAsFixed(1);
              final creative = c['creative'] is Map ? c['creative'] as Map : const {};
              final image = creative['image'] as String?;
              final placement = _placementLabels[c['placement']] ?? '${c['placement']}';
              final pricingMode = c['pricing_mode'] as String? ?? 'flat_boost';
              final priceLine = pricingMode == 'cpc'
                  ? '\$${((c['max_bid_cpc'] ?? 0) as num).toStringAsFixed(2)} CPC'
                  : '\$${((c['daily_budget'] ?? 0) as num).toStringAsFixed(2)}/day';
              final status = (c['status'] ?? 'draft') as String;
              final canToggle = status != 'exhausted' && status != 'ended';
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
                child: Column(children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 48, height: 48, clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
                        child: image != null && image.isNotEmpty ? Image.network(image, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox()) : null),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('${c['name'] ?? 'Campaign'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800))),
                        _statusChip(status),
                      ]),
                      const SizedBox(height: 2),
                      Text('$placement · $priceLine', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                      const SizedBox(height: 6),
                      Row(children: [
                        _tinyStat(LucideIcons.eye, '$imp'),
                        const SizedBox(width: 10),
                        _tinyStat(LucideIcons.mousePointerClick, '$clk'),
                        const SizedBox(width: 10),
                        Text('CTR $ctr%', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                        const Spacer(),
                        Text('\$${((c['total_spent'] ?? 0) as num).toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                      ]),
                    ])),
                  ]),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: canToggle ? () => _toggle(c) : null,
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(36)),
                    icon: Icon(status == 'active' ? LucideIcons.pause : LucideIcons.play, size: 14),
                    label: Text(status == 'active' ? 'Pause' : 'Activate'),
                  ),
                ]),
              );
            },
          );
        },
      ),
    );
  }

  Widget _stat(String label, String value, IconData icon) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Icon(icon, size: 12, color: AppColors.muted), const SizedBox(width: 4),
              Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1))]),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ]),
        ),
      );

  Widget _tinyStat(IconData icon, String v) => Row(children: [
        Icon(icon, size: 12, color: AppColors.muted),
        const SizedBox(width: 3),
        Text(v, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);

  Widget _statusChip(String status) {
    Color bg, fg;
    switch (status) {
      case 'active': bg = AppColors.success.withOpacity(0.15); fg = AppColors.success; break;
      case 'exhausted': bg = AppColors.warning.withOpacity(0.15); fg = AppColors.warning; break;
      default: bg = AppColors.mutedSurface; fg = AppColors.muted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(status.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: fg, letterSpacing: 0.5)),
    );
  }
}
