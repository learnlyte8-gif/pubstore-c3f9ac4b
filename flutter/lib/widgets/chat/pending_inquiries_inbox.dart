import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

/// Flutter port of `src/components/marketplace/PendingInquiriesInbox.tsx`.
/// Shows a collapsible list of pending inquiries when the current user
/// owns one or more suppliers. Approve/Decline bulk-updates and (on
/// approval) posts a cart-unlock message to the buyer conversation.
class PendingInquiriesInbox extends StatefulWidget {
  const PendingInquiriesInbox({super.key, required this.userId});
  final String userId;

  @override
  State<PendingInquiriesInbox> createState() => _PendingInquiriesInboxState();
}

class _PendingInquiriesInboxState extends State<PendingInquiriesInbox> {
  final List<Map<String, dynamic>> _items = [];
  final Set<String> _selected = {};
  bool _open = true;
  bool _busy = false;
  RealtimeChannel? _ch;
  List<String> _supplierIds = const [];

  @override
  void initState() {
    super.initState();
    _load();
    _ch = supabase
        .channel('pending-inbox:${widget.userId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'product_inquiries',
          callback: (_) => _load(),
        )
        .subscribe();
  }

  @override
  void dispose() {
    if (_ch != null) supabase.removeChannel(_ch!);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final sups = await supabase
          .from('suppliers')
          .select('id')
          .eq('owner_id', widget.userId);
      _supplierIds = (sups as List)
          .map((s) => (s as Map)['id'].toString())
          .toList(growable: false);
      if (_supplierIds.isEmpty) {
        if (mounted) setState(_items.clear);
        return;
      }
      final rows = await supabase
          .from('product_inquiries')
          .select(
              'id,product_id,product_title,message,status,created_at,buyer_id,supplier_id')
          .inFilter('supplier_id', _supplierIds)
          .eq('status', 'pending')
          .order('created_at', ascending: false)
          .limit(50);
      final list =
          (rows as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
      final buyerIds =
          list.map((r) => r['buyer_id'] as String).toSet().toList();
      final profileMap = <String, Map<String, dynamic>>{};
      if (buyerIds.isNotEmpty) {
        final profs = await supabase
            .from('profiles')
            .select('user_id,display_name,username,avatar_url')
            .inFilter('user_id', buyerIds);
        for (final p in (profs as List)) {
          profileMap[(p as Map)['user_id'] as String] =
              Map<String, dynamic>.from(p);
        }
      }
      for (final r in list) {
        final p = profileMap[r['buyer_id']];
        r['buyer_name'] =
            p?['display_name'] ?? p?['username'] ?? 'Customer';
        r['buyer_avatar'] = p?['avatar_url'];
      }
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(list);
        _selected.removeWhere((id) => !list.any((r) => r['id'] == id));
      });
    } catch (_) {}
  }

  Future<void> _decideBulk(String status) async {
    final ids = _selected.isEmpty
        ? _items.map((i) => i['id'] as String).toList()
        : _selected.toList();
    if (ids.isEmpty) return;
    setState(() => _busy = true);
    final targets = _items.where((i) => ids.contains(i['id'])).toList();
    try {
      await supabase.from('product_inquiries').update({
        'status': status,
        'decided_at': DateTime.now().toIso8601String(),
        'decided_by': widget.userId,
      }).inFilter('id', ids);
      if (status == 'approved') {
        for (final t in targets) {
          try {
            await _sendCartUnlockMessage(
              buyerId: t['buyer_id'] as String,
              supplierId: t['supplier_id'] as String,
              supplierOwnerId: widget.userId,
              productId: t['product_id'] as String,
            );
          } catch (_) {}
        }
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(status == 'approved'
              ? 'Approved ${ids.length} · buyers notified'
              : 'Declined ${ids.length}')));
      setState(() {
        _items.removeWhere((i) => ids.contains(i['id']));
        _selected.clear();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _sendCartUnlockMessage({
    required String buyerId,
    required String supplierId,
    required String supplierOwnerId,
    required String productId,
  }) async {
    final p = await supabase
        .from('products')
        .select('id,title,image,price,unit,moq')
        .eq('id', productId)
        .maybeSingle();
    if (p == null) return;
    final ex = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('supplier_id', supplierId)
        .maybeSingle();
    String? convId = ex?['id'] as String?;
    if (convId == null) {
      final c = await supabase
          .from('conversations')
          .insert({'buyer_id': buyerId, 'supplier_id': supplierId})
          .select('id')
          .single();
      convId = c['id'] as String;
    }
    final title = p['title']?.toString() ?? 'Product';
    final body = '✅ Inquiry approved — you can now add "$title" to your cart.';
    await supabase.from('messages').insert({
      'conversation_id': convId,
      'sender_id': supplierOwnerId,
      'body': body,
      'attachment': {
        'kind': 'cart-unlock',
        'productId': p['id'],
        'title': title,
        'image': p['image'],
        'price': p['price'],
        'currency': 'USD',
        'unit': p['unit'],
        'moq': p['moq'] ?? 1,
      },
    });
    await supabase.from('conversations').update({
      'last_message': body,
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', convId);
    await supabase.from('notifications').insert({
      'user_id': buyerId,
      'type': 'inquiry_approved',
      'title': 'Cart unlocked',
      'body': 'You can now add "$title" to your cart.',
      'link': '/messages?supplier=$supplierId',
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();
    final allSelected = _selected.length == _items.length;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withOpacity(0.06),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.35)),
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              const Icon(LucideIcons.shieldCheck,
                  size: 16, color: Color(0xFFB45309)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Trade Assurance · ${_items.length} pending inquir${_items.length > 1 ? "ies" : "y"}',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w900),
                ),
              ),
              Icon(_open ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                  size: 16),
            ]),
          ),
        ),
        if (_open) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12).copyWith(bottom: 8),
            child: Row(children: [
              OutlinedButton(
                onPressed: () => setState(() {
                  if (allSelected) {
                    _selected.clear();
                  } else {
                    _selected
                      ..clear()
                      ..addAll(_items.map((i) => i['id'] as String));
                  }
                }),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  minimumSize: const Size(0, 28),
                  shape: const StadiumBorder(),
                ),
                child: Text(allSelected ? 'Clear' : 'Select all',
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _selected.isNotEmpty
                      ? '${_selected.length} selected'
                      : 'Choose to bulk action',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.muted),
                ),
              ),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _decideBulk('declined'),
                icon: const Icon(LucideIcons.x, size: 12),
                label: Text(
                    'Decline${_selected.isNotEmpty ? " (${_selected.length})" : " all"}',
                    style: const TextStyle(fontSize: 11)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  minimumSize: const Size(0, 28),
                ),
              ),
              const SizedBox(width: 6),
              FilledButton.icon(
                onPressed: _busy ? null : () => _decideBulk('approved'),
                icon: const Icon(LucideIcons.check, size: 12),
                label: Text(
                    'Approve${_selected.isNotEmpty ? " (${_selected.length})" : " all"}',
                    style: const TextStyle(fontSize: 11)),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  minimumSize: const Size(0, 28),
                ),
              ),
            ]),
          ),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 260),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: _items.length,
              separatorBuilder: (_, __) => const Divider(
                  height: 1, thickness: 1, color: AppColors.border),
              itemBuilder: (_, i) {
                final it = _items[i];
                final id = it['id'] as String;
                final on = _selected.contains(id);
                return InkWell(
                  onTap: () => setState(() {
                    if (on) {
                      _selected.remove(id);
                    } else {
                      _selected.add(id);
                    }
                  }),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(children: [
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          color: on ? AppColors.primary : Colors.transparent,
                          border: Border.all(
                              color: on
                                  ? AppColors.primary
                                  : AppColors.muted.withOpacity(0.4),
                              width: 2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: on
                            ? const Icon(LucideIcons.check,
                                size: 14, color: Colors.white)
                            : null,
                      ),
                      const SizedBox(width: 8),
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: AppColors.mutedSurface,
                        backgroundImage: it['buyer_avatar'] != null
                            ? CachedNetworkImageProvider(
                                it['buyer_avatar'].toString())
                            : null,
                        child: it['buyer_avatar'] == null
                            ? Text(
                                (it['buyer_name'] as String? ?? 'C')[0]
                                    .toUpperCase(),
                                style: const TextStyle(fontSize: 10))
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(
                              '${it['buyer_name']} · ${it['product_title'] ?? 'Product'}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800),
                            ),
                            if ((it['message'] ?? '').toString().isNotEmpty)
                              Text(it['message'],
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 10,
                                      color: AppColors.muted)),
                          ])),
                    ]),
                  ),
                );
              },
            ),
          ),
        ],
      ]),
    );
  }
}
