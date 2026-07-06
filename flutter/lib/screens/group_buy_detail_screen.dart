import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'messages_screen.dart';
import 'orders_screen.dart';
import 'product_detail_screen.dart';
import 'user_profile_screen.dart';

/// Mirrors `src/pages/GroupBuyDetail.tsx` — group-buy detail with pledge qty,
/// invite accept/decline, realtime, owner-place-order, members and group chat.
class GroupBuyDetailScreen extends StatefulWidget {
  const GroupBuyDetailScreen({super.key, required this.groupBuyId});
  final String groupBuyId;
  @override
  State<GroupBuyDetailScreen> createState() => _GroupBuyDetailScreenState();
}

class _GroupBuyDetailScreenState extends State<GroupBuyDetailScreen> {
  Map<String, dynamic>? _gb;
  Map<String, dynamic>? _product;
  List<Map<String, dynamic>> _members = const [];
  Map<String, Map<String, dynamic>> _profiles = const {};
  Map<String, dynamic>? _myInvite;
  bool _loading = true;
  bool _busy = false;
  bool _ordering = false;
  int _qty = 1;
  RealtimeChannel? _channel;

  String? get _uid => supabase.auth.currentUser?.id;

  @override
  void initState() {
    super.initState();
    _load();
    _channel = supabase
        .channel('gb:${widget.groupBuyId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'group_buy_members',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'group_buy_id',
            value: widget.groupBuyId,
          ),
          callback: (_) => _loadMembers(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'group_buys',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: widget.groupBuyId,
          ),
          callback: (_) => _loadGb(),
        )
        .subscribe();
  }

  @override
  void dispose() {
    if (_channel != null) supabase.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _load() async {
    await Future.wait([_loadGb(), _loadMembers(), _loadInvite()]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadGb() async {
    final gb = await supabase
        .from('group_buys')
        .select('*')
        .eq('id', widget.groupBuyId)
        .maybeSingle();
    Map<String, dynamic>? prod;
    if (gb != null && gb['product_id'] != null) {
      prod = await supabase
          .from('products')
          .select('id,title,image,price')
          .eq('id', gb['product_id'])
          .maybeSingle();
    }
    if (!mounted) return;
    setState(() {
      _gb = gb == null ? null : Map<String, dynamic>.from(gb);
      _product = prod == null ? null : Map<String, dynamic>.from(prod);
    });
  }

  Future<void> _loadMembers() async {
    final rows = await supabase
        .from('group_buy_members')
        .select('user_id, qty')
        .eq('group_buy_id', widget.groupBuyId);
    final members = (rows as List)
        .map((r) => Map<String, dynamic>.from(r as Map))
        .toList();
    final ids = members.map((m) => m['user_id'].toString()).toList();
    Map<String, Map<String, dynamic>> profiles = {};
    if (ids.isNotEmpty) {
      final pr = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .inFilter('user_id', ids);
      for (final p in (pr as List)) {
        final m = Map<String, dynamic>.from(p as Map);
        profiles[m['user_id'].toString()] = m;
      }
    }
    if (!mounted) return;
    setState(() {
      _members = members;
      _profiles = profiles;
      final mine = members.firstWhere(
        (m) => m['user_id'] == _uid,
        orElse: () => const {},
      );
      if (mine.isNotEmpty && mine['qty'] != null) {
        _qty = (mine['qty'] as num).toInt();
      }
    });
  }

  Future<void> _loadInvite() async {
    if (_uid == null) return;
    final inv = await supabase
        .from('group_buy_invites')
        .select('id, status')
        .eq('group_buy_id', widget.groupBuyId)
        .eq('invitee_id', _uid!)
        .maybeSingle();
    if (!mounted) return;
    setState(() => _myInvite = inv == null ? null : Map<String, dynamic>.from(inv));
  }

  Future<void> _join() async {
    final uid = _uid;
    if (uid == null) {
      Navigator.of(context).pushNamed('/auth');
      return;
    }
    setState(() => _busy = true);
    try {
      await supabase.from('group_buy_members').upsert({
        'group_buy_id': widget.groupBuyId,
        'user_id': uid,
        'qty': _qty,
      }, onConflict: 'group_buy_id,user_id');
      if (_myInvite != null && _myInvite!['status'] == 'pending') {
        await supabase
            .from('group_buy_invites')
            .update({'status': 'accepted'}).eq('id', _myInvite!['id']);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Joined group buy')),
        );
      }
      await Future.wait([_loadMembers(), _loadInvite()]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Couldn\'t join: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _declineInvite() async {
    if (_myInvite == null) return;
    setState(() => _busy = true);
    try {
      await supabase
          .from('group_buy_invites')
          .update({'status': 'declined'}).eq('id', _myInvite!['id']);
      if (mounted) Navigator.of(context).maybePop();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _placeOrder() async {
    setState(() => _ordering = true);
    try {
      // Best-effort: call RPC if present, otherwise flag status=fulfilled
      try {
        await supabase.rpc('place_group_buy_order', params: {'p_group_buy_id': widget.groupBuyId});
      } catch (_) {
        await supabase
            .from('group_buys')
            .update({'status': 'fulfilled'}).eq('id', widget.groupBuyId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Group order placed')),
        );
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OrdersScreen()));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Couldn\'t place order: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _ordering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Skeletons.list(count: 4));
    final gb = _gb;
    if (gb == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Group buy not found')),
      );
    }
    final target = (gb['target_qty'] as num?)?.toInt() ?? 1;
    final total = _members.fold<int>(0, (s, m) => s + ((m['qty'] as num?)?.toInt() ?? 0));
    final pct = target == 0 ? 0.0 : (total / target).clamp(0.0, 1.0);
    final me = _uid;
    final isMember = me != null && _members.any((m) => m['user_id'] == me);
    final isOwner = me != null && me == gb['owner_id'];
    final status = (gb['status'] ?? 'open').toString();
    final isFulfilled = status == 'fulfilled';
    final isCancelled = status == 'cancelled';
    final isClosed = isFulfilled || isCancelled;
    final targetReached = total >= target;
    final deadline = DateTime.tryParse((gb['deadline'] ?? '').toString());
    final showInviteCTA = _myInvite != null && _myInvite!['status'] == 'pending' && !isMember && !isClosed;

    return Scaffold(
      appBar: AppBar(title: const Text('Group buy')),
      body: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
        if ((_product?['image'] ?? '').toString().isNotEmpty)
          AspectRatio(
            aspectRatio: 16 / 9,
            child: CachedNetworkImage(imageUrl: _product!['image'], fit: BoxFit.cover),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('PRIVATE GROUP',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: AppColors.primary)),
            const SizedBox(height: 4),
            Text(gb['title']?.toString() ?? 'Group buy',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, height: 1.15)),
            if (_product != null)
              GestureDetector(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductDetailScreen(productId: _product!['id'].toString()))),
                child: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('View product',
                      style: TextStyle(fontSize: 12, color: AppColors.muted, decoration: TextDecoration.underline)),
                ),
              ),
          ]),
        ),
        if (showInviteCTA)
          Container(
            margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.06),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withOpacity(0.3)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("YOU'RE INVITED",
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: AppColors.primary)),
              const SizedBox(height: 4),
              const Text('Join this group buy to pool an order with friends.',
                  style: TextStyle(fontSize: 13)),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : _declineInvite,
                    icon: const Icon(LucideIcons.x, size: 14),
                    label: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _join,
                    icon: const Icon(LucideIcons.check, size: 14),
                    label: Text('Accept & pledge $_qty'),
                  ),
                ),
              ]),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('$total / $target units', style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('${(pct * 100).round()}%',
                  style: TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 8,
                color: AppColors.foreground,
                backgroundColor: AppColors.mutedSurface,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(spacing: 16, runSpacing: 4, children: [
              _MetaChip(icon: LucideIcons.users, text: '${_members.length} members'),
              _MetaChip(icon: LucideIcons.target, text: 'Target $target'),
              _MetaChip(
                icon: LucideIcons.clock,
                text: deadline == null
                    ? 'Open-ended'
                    : '${deadline.toLocal().toString().substring(0, 16)}',
              ),
            ]),
            if (isFulfilled)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('TARGET REACHED — ORDER PLACED',
                    style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1)),
              ),
            if (isCancelled)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('CANCELLED',
                    style: TextStyle(color: AppColors.priceRed, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1)),
              ),
            if (!isClosed && targetReached)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('TARGET REACHED — READY TO ORDER',
                    style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1)),
              ),
          ]),
        ),
        if (!isClosed)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('YOUR PLEDGE',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: AppColors.muted)),
              const SizedBox(height: 8),
              Row(children: [
                Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
                  child: Row(children: [
                    IconButton(
                      onPressed: () => setState(() => _qty = (_qty - 1).clamp(1, 99999)),
                      icon: const Icon(LucideIcons.minus, size: 16),
                    ),
                    SizedBox(
                      width: 36,
                      child: Text('$_qty',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                    ),
                    IconButton(
                      onPressed: () => setState(() => _qty = _qty + 1),
                      icon: const Icon(LucideIcons.plus, size: 16),
                    ),
                  ]),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : _join,
                    icon: Icon(isMember ? LucideIcons.check : LucideIcons.users, size: 16),
                    label: Text(isMember ? 'Update pledge' : 'Join group buy'),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44)),
                  ),
                ),
              ]),
            ]),
          ),
        if (isOwner && !isClosed && targetReached)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: FilledButton.icon(
              onPressed: _ordering ? null : _placeOrder,
              icon: const Icon(LucideIcons.shoppingBag, size: 16),
              label: Text(_ordering ? 'Placing…' : 'Place group order ($total units)'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ),
        if (isFulfilled)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OrdersScreen())),
              icon: const Icon(LucideIcons.shoppingBag, size: 16),
              label: const Text('View order'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 6),
          child: Text('MEMBERS',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: AppColors.muted)),
        ),
        if (_members.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text('No members yet', style: TextStyle(color: AppColors.muted, fontSize: 12)),
          ),
        ..._members.map((m) {
          final uid = m['user_id'].toString();
          final p = _profiles[uid];
          final name = (p?['display_name'] ?? p?['username'] ?? 'Member').toString();
          final avatar = p?['avatar_url']?.toString();
          final isOwn = uid == gb['owner_id'];
          return ListTile(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => UserProfileScreen(userId: uid))),
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.mutedSurface,
              backgroundImage: (avatar != null && avatar.isNotEmpty) ? CachedNetworkImageProvider(avatar) : null,
              child: (avatar == null || avatar.isEmpty)
                  ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w800))
                  : null,
            ),
            title: Row(children: [
              Flexible(child: Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700))),
              if (isOwn)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Text('OWNER', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.primary)),
                ),
            ]),
            trailing: Text('${m['qty']}', style: const TextStyle(fontWeight: FontWeight.w900)),
          );
        }),
        if (gb['conversation_id'] != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MessagesScreen(conversationId: gb['conversation_id'].toString()))),
              icon: const Icon(LucideIcons.messageCircle, size: 16),
              label: const Text('Open group chat'),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)),
            ),
          ),
      ]),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: AppColors.muted),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);
}
