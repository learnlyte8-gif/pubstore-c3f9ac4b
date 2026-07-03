import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/GroupBuyDetail.tsx` — group-buy campaign detail with
/// progress bar and join button.
class GroupBuyDetailScreen extends StatefulWidget {
  const GroupBuyDetailScreen({super.key, required this.groupBuyId});
  final String groupBuyId;
  @override
  State<GroupBuyDetailScreen> createState() => _GroupBuyDetailScreenState();
}

class _GroupBuyDetailScreenState extends State<GroupBuyDetailScreen> {
  Map<String, dynamic>? _gb;
  int _members = 0;
  bool _joined = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final gb = await supabase.from('group_buys').select('*, products(title, cover)').eq('id', widget.groupBuyId).maybeSingle();
    final members = await supabase.from('group_buy_members').select('user_id').eq('group_buy_id', widget.groupBuyId);
    final uid = supabase.auth.currentUser?.id;
    if (!mounted) return;
    setState(() {
      _gb = gb == null ? null : Map<String, dynamic>.from(gb);
      _members = (members as List).length;
      _joined = uid != null && (members).any((m) => (m as Map)['user_id'] == uid);
      _loading = false;
    });
  }

  Future<void> _join() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    if (_joined) {
      await supabase.from('group_buy_members').delete().match({'group_buy_id': widget.groupBuyId, 'user_id': uid});
    } else {
      await supabase.from('group_buy_members').insert({'group_buy_id': widget.groupBuyId, 'user_id': uid});
    }
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Skeletons.list(count: 4));
    final gb = _gb;
    if (gb == null) return const Scaffold(body: Center(child: Text('Group buy not found')));
    final product = (gb['products'] ?? {}) as Map;
    final target = (gb['target_members'] as num?)?.toInt() ?? 10;
    final progress = (_members / target).clamp(0.0, 1.0);
    final endsAt = DateTime.tryParse(gb['ends_at']?.toString() ?? '');
    final remaining = endsAt == null ? null : endsAt.difference(DateTime.now());
    return Scaffold(
      appBar: AppBar(title: const Text('Group buy')),
      body: ListView(children: [
        if ((product['cover'] ?? '').toString().isNotEmpty)
          AspectRatio(aspectRatio: 16 / 9, child: CachedNetworkImage(imageUrl: product['cover'], fit: BoxFit.cover)),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(product['title']?.toString() ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Row(children: [
              Text('\$${gb['group_price']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
              const SizedBox(width: 8),
              Text('\$${gb['regular_price']}', style: const TextStyle(color: AppColors.muted, decoration: TextDecoration.lineThrough)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.success.withOpacity(.15), borderRadius: BorderRadius.circular(99)),
                child: Text('Save ${((1 - (gb['group_price'] as num) / (gb['regular_price'] as num)) * 100).toStringAsFixed(0)}%', style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w800, fontSize: 11)),
              ),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              Text('$_members / $target joined', style: const TextStyle(fontWeight: FontWeight.w800)),
              const Spacer(),
              if (remaining != null && remaining.inSeconds > 0)
                Text('Ends in ${remaining.inHours}h ${remaining.inMinutes.remainder(60)}m', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: progress, minHeight: 8, color: AppColors.orange, backgroundColor: AppColors.mutedSurface)),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _join,
              icon: Icon(_joined ? LucideIcons.check : LucideIcons.users),
              label: Text(_joined ? 'You’re in — invite friends' : 'Join group buy'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: _joined ? AppColors.success : AppColors.orange),
            ),
            const SizedBox(height: 24),
            const Text('How it works', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Enough buyers join, everyone gets the group price. If the target isn’t reached before the timer ends, no one is charged.', style: TextStyle(color: AppColors.muted, height: 1.4)),
          ]),
        ),
      ]),
    );
  }
}
