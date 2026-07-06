import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../models/message_models.dart';
import '../../services/supabase_client.dart';
import '../../theme/palette.dart';
import 'attachment_card.dart';

/// Flutter port of `src/components/chat/ShareToChatSheet.tsx`.
///
/// Opens a modal bottom sheet listing supplier chats, group chats, direct
/// messages, and followed users; lets the user pick one or more targets and
/// sends the given [attachment] (optionally with a note) to each conversation.
Future<void> showShareToChatSheet(
  BuildContext context, {
  required ChatAttachment attachment,
  String defaultNote = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ShareToChatSheet(
      attachment: attachment,
      defaultNote: defaultNote,
    ),
  );
}

enum _RecipientKind { supplier, dm, group, followedUser }

class _Recipient {
  _Recipient({
    required this.key,
    required this.kind,
    this.conversationId,
    this.peerUserId,
    required this.name,
    this.logo,
    this.verified = false,
    this.subtitle,
  });
  final String key;
  final _RecipientKind kind;
  final String? conversationId;
  final String? peerUserId;
  final String name;
  final String? logo;
  final bool verified;
  final String? subtitle;
}

class _ShareToChatSheet extends StatefulWidget {
  const _ShareToChatSheet({required this.attachment, required this.defaultNote});
  final ChatAttachment attachment;
  final String defaultNote;

  @override
  State<_ShareToChatSheet> createState() => _ShareToChatSheetState();
}

class _ShareToChatSheetState extends State<_ShareToChatSheet> {
  final _searchCtl = TextEditingController();
  final _noteCtl = TextEditingController();
  final _selected = <String>{};
  List<_Recipient> _recipients = const [];
  bool _loading = true;
  bool _sending = false;
  String? _uid;

  @override
  void initState() {
    super.initState();
    _noteCtl.text = widget.defaultNote;
    _load();
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    _noteCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    _uid = uid;
    try {
      // Conversations as buyer
      final buyerConvs = await supabase
          .from('conversations').select('*').eq('buyer_id', uid);
      // As supplier owner
      final mySup = await supabase.from('suppliers').select('id').eq('owner_id', uid);
      List<dynamic> supConvs = [];
      final supIds = (mySup as List).map((s) => (s as Map)['id']).toList();
      if (supIds.isNotEmpty) {
        supConvs = await supabase.from('conversations').select('*').inFilter('supplier_id', supIds);
      }
      // As member
      final memberRows = await supabase
          .from('conversation_members').select('conversation_id').eq('user_id', uid);
      List<dynamic> memberConvs = [];
      final memberIds =
          (memberRows as List).map((r) => (r as Map)['conversation_id']).toList();
      if (memberIds.isNotEmpty) {
        memberConvs =
            await supabase.from('conversations').select('*').inFilter('id', memberIds);
      }
      final merged = <String, Map<String, dynamic>>{};
      for (final c in [...(buyerConvs as List), ...supConvs, ...memberConvs]) {
        final m = Map<String, dynamic>.from(c as Map);
        merged[m['id'].toString()] = m;
      }

      // Hydrate suppliers
      final supplierIds =
          merged.values.map((c) => c['supplier_id']).where((v) => v != null).toSet().toList();
      final supMap = <String, Map<String, dynamic>>{};
      if (supplierIds.isNotEmpty) {
        final sups = await supabase
            .from('suppliers').select('id,name,logo,verified,owner_id').inFilter('id', supplierIds);
        for (final s in (sups as List)) {
          final m = Map<String, dynamic>.from(s as Map);
          supMap[m['id'].toString()] = m;
        }
      }

      // Peer ids from DMs
      final peerIds = <String>{};
      for (final c in merged.values) {
        final kind = (c['kind'] ?? 'buyer_supplier').toString();
        if (kind == 'dm') {
          final peer = (c['peer_user_id'] ?? (c['buyer_id'] == uid ? null : c['buyer_id']))
              ?.toString();
          if (peer != null && peer != uid) peerIds.add(peer);
        }
      }
      // Follows
      final follows = await supabase
          .from('user_follows').select('followee_id').eq('follower_id', uid);
      final followIds =
          (follows as List).map((f) => (f as Map)['followee_id'].toString()).toList();
      peerIds.addAll(followIds);

      final profMap = <String, Map<String, dynamic>>{};
      if (peerIds.isNotEmpty) {
        final profs = await supabase
            .from('profiles')
            .select('user_id, display_name, username, avatar_url')
            .inFilter('user_id', peerIds.toList());
        for (final p in (profs as List)) {
          final m = Map<String, dynamic>.from(p as Map);
          profMap[m['user_id'].toString()] = m;
        }
      }

      final list = <_Recipient>[];
      final dmPeers = <String>{};
      for (final c in merged.values) {
        final kind = (c['kind'] ?? 'buyer_supplier').toString();
        if (kind == 'group_buy') {
          list.add(_Recipient(
            key: c['id'].toString(), kind: _RecipientKind.group,
            conversationId: c['id'].toString(),
            name: (c['title'] ?? 'Group buy').toString(), logo: null, subtitle: 'Group chat',
          ));
        } else if (kind == 'dm') {
          final peer = (c['peer_user_id'] ?? (c['buyer_id'] == uid ? null : c['buyer_id']))
              ?.toString();
          if (peer != null) dmPeers.add(peer);
          final p = peer != null ? profMap[peer] : null;
          list.add(_Recipient(
            key: c['id'].toString(), kind: _RecipientKind.dm,
            conversationId: c['id'].toString(), peerUserId: peer,
            name: (p?['display_name'] ?? p?['username'] ?? 'Direct message').toString(),
            logo: p?['avatar_url']?.toString(),
            subtitle: p?['username'] != null ? '@${p!['username']}' : 'Direct message',
          ));
        } else {
          final s = supMap[c['supplier_id']?.toString()];
          if (s == null) continue;
          list.add(_Recipient(
            key: c['id'].toString(), kind: _RecipientKind.supplier,
            conversationId: c['id'].toString(),
            name: (s['name'] ?? 'Supplier').toString(),
            logo: s['logo']?.toString(),
            verified: s['verified'] == true, subtitle: 'Supplier',
          ));
        }
      }
      for (final id in followIds) {
        if (dmPeers.contains(id)) continue;
        final p = profMap[id];
        if (p == null) continue;
        list.add(_Recipient(
          key: 'user:$id', kind: _RecipientKind.followedUser, peerUserId: id,
          name: (p['display_name'] ?? p['username'] ?? 'Following').toString(),
          logo: p['avatar_url']?.toString(),
          subtitle: p['username'] != null ? '@${p['username']} · Following' : 'Following',
        ));
      }

      if (mounted) setState(() { _recipients = list; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<String?> _resolveConvId(_Recipient r) async {
    if (r.conversationId != null) return r.conversationId;
    if (r.kind == _RecipientKind.followedUser && r.peerUserId != null && _uid != null) {
      final existing = await supabase
          .from('conversations').select('id').eq('kind', 'dm')
          .or('and(buyer_id.eq.$_uid,peer_user_id.eq.${r.peerUserId}),and(buyer_id.eq.${r.peerUserId},peer_user_id.eq.$_uid)')
          .limit(1).maybeSingle();
      if (existing != null) return (existing as Map)['id'].toString();
      final created = await supabase
          .from('conversations')
          .insert({'buyer_id': _uid, 'peer_user_id': r.peerUserId, 'kind': 'dm'})
          .select('id').single();
      final cid = (created as Map)['id'].toString();
      try {
        await supabase.from('conversation_members').insert([
          {'conversation_id': cid, 'user_id': _uid},
          {'conversation_id': cid, 'user_id': r.peerUserId},
        ]);
      } catch (_) {}
      return cid;
    }
    return null;
  }

  Future<void> _send() async {
    if (_uid == null || _selected.isEmpty) return;
    setState(() => _sending = true);
    final att = widget.attachment;
    final d = att.data;
    final preview = switch (att.kind) {
      'product' => '📦 ${d['title'] ?? 'Product'}',
      'supplier' => '🏬 ${d['name'] ?? 'Supplier'}',
      'wishlist' => '❤️ Wishlist · ${d['count'] ?? 0} items',
      'cart-unlock' => '✅ Cart unlocked · ${d['title'] ?? ''}',
      _ => '🗂 Catalog · ${d['count'] ?? 0} items',
    };
    var sent = 0;
    try {
      for (final key in _selected) {
        final r = _recipients.firstWhere((x) => x.key == key,
            orElse: () => _Recipient(key: '', kind: _RecipientKind.dm, name: ''));
        if (r.key.isEmpty) continue;
        final cid = await _resolveConvId(r);
        if (cid == null) continue;
        final note = _noteCtl.text.trim();
        if (note.isNotEmpty) {
          await supabase.from('messages')
              .insert({'conversation_id': cid, 'sender_id': _uid, 'body': note});
        }
        await supabase.from('messages').insert({
          'conversation_id': cid, 'sender_id': _uid, 'body': preview, 'attachment': att.toJson(),
        });
        await supabase.from('conversations').update({
          'last_message': preview, 'last_message_at': DateTime.now().toIso8601String(),
        }).eq('id', cid);
        sent++;
      }
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sent to $sent chat${sent == 1 ? '' : 's'}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not send: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _searchCtl.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _recipients
        : _recipients.where((r) =>
            r.name.toLowerCase().contains(q) ||
            (r.subtitle ?? '').toLowerCase().contains(q)).toList();
    final groups = filtered.where((r) => r.kind == _RecipientKind.group).toList();
    final dms = filtered.where((r) => r.kind == _RecipientKind.dm).toList();
    final follows = filtered.where((r) => r.kind == _RecipientKind.followedUser).toList();
    final suppliers = filtered.where((r) => r.kind == _RecipientKind.supplier).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtl) => Container(
        decoration: const BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(children: [
          Container(margin: const EdgeInsets.only(top: 8), width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
            child: Row(children: [
              const Expanded(child: Text('Send to…',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16))),
              IconButton(icon: const Icon(LucideIcons.x),
                  onPressed: () => Navigator.of(context).pop()),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: AttachmentCard(attachment: widget.attachment, mine: false),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            child: TextField(
              controller: _searchCtl,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search people, groups, suppliers',
                prefixIcon: const Icon(LucideIcons.search, size: 18),
                filled: true, fillColor: AppColors.mutedSurface,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('Nothing to share with yet.\nFollow people or start a supplier chat first.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: AppColors.muted)),
                        ),
                      )
                    : ListView(
                        controller: scrollCtl,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        children: [
                          _section('Groups', LucideIcons.users, groups),
                          _section('Direct messages', LucideIcons.messageCircle, dms),
                          _section('Following', LucideIcons.userPlus, follows),
                          _section('Suppliers', LucideIcons.shieldCheck, suppliers),
                        ],
                      ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(children: [
                TextField(
                  controller: _noteCtl,
                  decoration: InputDecoration(
                    hintText: 'Write a message…',
                    filled: true, fillColor: AppColors.mutedSurface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity, height: 48,
                  child: FilledButton.icon(
                    onPressed: _selected.isEmpty || _sending ? null : _send,
                    icon: const Icon(LucideIcons.send, size: 16),
                    label: Text(_sending
                        ? 'Sending…'
                        : 'Send${_selected.isEmpty ? '' : ' (${_selected.length})'}'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _section(String title, IconData icon, List<_Recipient> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Row(children: [
          Icon(icon, size: 12, color: AppColors.muted),
          const SizedBox(width: 6),
          Text(title.toUpperCase(),
              style: const TextStyle(fontSize: 10, letterSpacing: 0.6,
                  fontWeight: FontWeight.w800, color: AppColors.muted)),
        ]),
      ),
      ...items.map((r) {
        final selected = _selected.contains(r.key);
        return InkWell(
          onTap: () => setState(() =>
              selected ? _selected.remove(r.key) : _selected.add(r.key)),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: selected ? AppColors.primary.withOpacity(0.08) : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(children: [
              CircleAvatar(
                radius: 20, backgroundColor: AppColors.mutedSurface,
                backgroundImage: r.logo != null ? CachedNetworkImageProvider(r.logo!) : null,
                child: r.logo == null
                    ? (r.kind == _RecipientKind.group
                        ? const Icon(LucideIcons.users, size: 18)
                        : Text(r.name.isNotEmpty ? r.name[0].toUpperCase() : '?',
                            style: const TextStyle(fontWeight: FontWeight.w800)))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(r.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14))),
                    if (r.verified) ...[
                      const SizedBox(width: 4),
                      const Icon(LucideIcons.shieldCheck, size: 13, color: AppColors.primary),
                    ],
                  ]),
                  if (r.subtitle != null)
                    Text(r.subtitle!,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
              ),
              Container(
                width: 22, height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? AppColors.primary : Colors.transparent,
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border, width: 2),
                ),
                child: selected ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
              ),
            ]),
          ),
        );
      }),
    ]);
  }
}
