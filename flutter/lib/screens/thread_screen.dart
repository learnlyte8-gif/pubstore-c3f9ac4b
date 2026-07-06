import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/message_models.dart';
import '../services/auth_service.dart';
import '../services/messages_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/chat/attachment_card.dart';
import '../widgets/skeletons.dart';

/// Chat thread — mirrors `src/pages/Messages.tsx` (thread view).
class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({super.key, required this.conversation, this.prefill});
  final ChatConversation conversation;
  final String? prefill;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

const _reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final FocusNode _focus = FocusNode();
  List<ChatMessage> _messages = [];
  bool _loading = true;
  bool _sending = false;
  ChatMessage? _replyTo;
  RealtimeChannel? _channel;
  String? _peerName;

  @override
  void initState() {
    super.initState();
    _peerName = widget.conversation.peer?.name ?? widget.conversation.title;
    if (widget.prefill != null) _input.text = widget.prefill!;
    _load();
    _subscribe();
    _markRead();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    _focus.dispose();
    if (_channel != null) supabase.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await messagesService.listMessages(widget.conversation.id);
      if (!mounted) return;
      setState(() {
        _messages = list;
        _loading = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _subscribe() {
    _channel = supabase
        .channel('thread:${widget.conversation.id}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversation.id,
          ),
          callback: (payload) {
            final rec = payload.newRecord;
            final old = payload.oldRecord;
            setState(() {
              if (payload.eventType == PostgresChangeEvent.insert && rec.isNotEmpty) {
                final m = ChatMessage.fromRow(Map<String, dynamic>.from(rec));
                if (_messages.every((x) => x.id != m.id)) _messages.add(m);
              } else if (payload.eventType == PostgresChangeEvent.update && rec.isNotEmpty) {
                final m = ChatMessage.fromRow(Map<String, dynamic>.from(rec));
                final i = _messages.indexWhere((x) => x.id == m.id);
                if (i >= 0) _messages[i] = m;
              } else if (payload.eventType == PostgresChangeEvent.delete && old.isNotEmpty) {
                _messages.removeWhere((x) => x.id == old['id'].toString());
              }
            });
            _scrollToBottom();
            _markRead();
          },
        )
        .subscribe();
  }

  Future<void> _markRead() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      await supabase.from('conversation_members').upsert({
        'conversation_id': widget.conversation.id,
        'user_id': uid,
        'last_read_at': DateTime.now().toIso8601String(),
      });
    } catch (_) {}
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(_scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _sending = true);
    final reply = _replyTo;
    _input.clear();
    _replyTo = null;
    try {
      await messagesService.insertMessage(
        conversationId: widget.conversation.id,
        senderId: uid,
        body: text,
        replyToId: reply?.id,
      );
      // Notify peer.
      String? otherUserId;
      final conv = widget.conversation;
      if (conv.resolvedKind == 'dm') {
        otherUserId = conv.buyerId == uid ? conv.peerUserId : conv.buyerId;
      } else if (conv.supplierId != null) {
        final ownerId = await messagesService.supplierOwnerId(conv.supplierId!);
        otherUserId = ownerId == uid ? conv.buyerId : ownerId;
      }
      if (otherUserId != null && otherUserId != uid) {
        await messagesService.notifyPeer(otherUserId: otherUserId, preview: text);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to send: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _react(ChatMessage m, String emoji) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final map = <String, List<String>>{};
    (m.reactions ?? {}).forEach((k, v) => map[k] = List<String>.from(v));
    final list = map[emoji] ?? <String>[];
    if (list.contains(uid)) {
      list.remove(uid);
    } else {
      list.add(uid);
    }
    if (list.isEmpty) {
      map.remove(emoji);
    } else {
      map[emoji] = list;
    }
    setState(() {
      final i = _messages.indexWhere((x) => x.id == m.id);
      if (i >= 0) _messages[i] = _messages[i].copyWith(reactions: map);
    });
    try {
      await messagesService.updateReactions(m.id, map);
    } catch (_) {}
  }

  void _showReactionSheet(ChatMessage m) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: _reactionEmojis
              .map((e) => IconButton(
                    iconSize: 28,
                    icon: Text(e, style: const TextStyle(fontSize: 26)),
                    onPressed: () {
                      Navigator.pop(context);
                      _react(m, e);
                    },
                  ))
              .toList(),
        ),
      ),
    );
  }

  void _openMessageMenu(ChatMessage m) {
    final uid = supabase.auth.currentUser?.id;
    final mine = m.senderId == uid;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(LucideIcons.reply, color: AppColors.foreground),
            title: const Text('Reply', style: TextStyle(color: AppColors.foreground)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _replyTo = m);
              _focus.requestFocus();
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.smile, color: AppColors.foreground),
            title: const Text('React', style: TextStyle(color: AppColors.foreground)),
            onTap: () {
              Navigator.pop(context);
              _showReactionSheet(m);
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.copy, color: AppColors.foreground),
            title: const Text('Copy text', style: TextStyle(color: AppColors.foreground)),
            onTap: () async {
              Navigator.pop(context);
              await Clipboard.setData(ClipboardData(text: m.body));
              if (mounted) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('Copied')));
              }
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.forward, color: AppColors.foreground),
            title: const Text('Forward', style: TextStyle(color: AppColors.foreground)),
            onTap: () async {
              Navigator.pop(context);
              await _forwardMessage(m);
            },
          ),
          if (mine)
            ListTile(
              leading: const Icon(LucideIcons.trash2, color: AppColors.priceRed),
              title: const Text('Delete', style: TextStyle(color: AppColors.priceRed)),
              onTap: () async {
                Navigator.pop(context);
                try {
                  await messagesService.deleteMessage(m.id);
                  setState(() => _messages.removeWhere((x) => x.id == m.id));
                } catch (_) {}
              },
            ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final uid = supabase.auth.currentUser?.id;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        title: _headerTitle(),
        actions: [
          IconButton(icon: const Icon(LucideIcons.phone, size: 18), onPressed: _callPeer),
          IconButton(icon: const Icon(LucideIcons.video, size: 18), onPressed: _videoCallPeer),
          IconButton(icon: const Icon(LucideIcons.moreVertical, size: 18), onPressed: _openThreadMenu),
        ],
      ),
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: _loading
                ? Skeletons.screen(SkeletonPreset.chat)
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i];
                      final prev = i == 0 ? null : _messages[i - 1];
                      return Column(children: [
                        if (_needsDivider(prev, m)) _dayDivider(m.createdAt),
                        _bubble(m, uid),
                      ]);
                    },
                  ),
          ),
          if (_replyTo != null) _replyPreview(),
          _composer(),
        ]),
      ),
    );
  }

  Widget _headerTitle() {
    final peer = widget.conversation.peer;
    final name = _peerName ?? peer?.name ?? 'Conversation';
    return Row(children: [
      CircleAvatar(
        radius: 16,
        backgroundColor: AppColors.mutedSurface,
        backgroundImage: peer?.logo != null ? CachedNetworkImageProvider(peer!.logo!) : null,
        child: peer?.logo == null
            ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))
            : null,
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Flexible(
              child: Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, color: AppColors.foreground, fontSize: 15)),
            ),
            if (peer?.verified == true) ...[
              const SizedBox(width: 4),
              const Icon(LucideIcons.shieldCheck, size: 12, color: AppColors.primary),
            ]
          ]),
          if (peer?.subtitle != null)
            Text(peer!.subtitle!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ]),
      ),
    ]);
  }

  bool _needsDivider(ChatMessage? prev, ChatMessage cur) {
    if (prev == null) return true;
    return prev.createdAt.day != cur.createdAt.day ||
        prev.createdAt.month != cur.createdAt.month ||
        prev.createdAt.year != cur.createdAt.year;
  }

  Widget _dayDivider(DateTime at) {
    final label = DateFormat.yMMMd().format(at);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        const Expanded(child: Divider(color: AppColors.border)),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        const SizedBox(width: 8),
        const Expanded(child: Divider(color: AppColors.border)),
      ]),
    );
  }

  Widget _bubble(ChatMessage m, String? uid) {
    final mine = m.senderId == uid;
    final quoted = m.replyToId == null
        ? null
        : _messages.firstWhere(
            (x) => x.id == m.replyToId,
            orElse: () => ChatMessage(
                id: '',
                conversationId: '',
                senderId: '',
                body: 'Original message',
                createdAt: DateTime.now()),
          );
    final bubble = Dismissible(
      key: ValueKey('swipe-${m.id}'),
      direction: DismissDirection.startToEnd,
      confirmDismiss: (_) async {
        setState(() => _replyTo = m);
        _focus.requestFocus();
        return false;
      },
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 16),
        color: AppColors.mutedSurface,
        child: const Icon(LucideIcons.reply, size: 16, color: AppColors.primary),
      ),
      child: GestureDetector(
        onLongPress: () => _openMessageMenu(m),
        onDoubleTap: () => _react(m, '❤️'),
        child: Align(
          alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 3),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: mine ? AppColors.primary : AppColors.mutedSurface,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(mine ? 16 : 4),
                  bottomRight: Radius.circular(mine ? 4 : 16),
                ),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                if (m.forwarded)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text('Forwarded',
                        style: TextStyle(
                            fontSize: 10,
                            fontStyle: FontStyle.italic,
                            color: mine ? Colors.white70 : AppColors.muted)),
                  ),
                if (quoted != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: (mine ? Colors.white : AppColors.foreground).withOpacity(0.08),
                      border: Border(left: BorderSide(width: 3, color: mine ? Colors.white : AppColors.primary)),
                    ),
                    child: Text(quoted.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 11, color: mine ? Colors.white : AppColors.foreground)),
                  ),
                if (m.attachment != null) ...[
                  AttachmentCard(attachment: m.attachment!, mine: mine),
                  if (m.body.isNotEmpty) const SizedBox(height: 6),
                ],
                if (m.body.isNotEmpty)
                  Text(m.body,
                      style: TextStyle(
                          fontSize: 14, color: mine ? Colors.white : AppColors.foreground)),
                const SizedBox(height: 4),
                Text(DateFormat.Hm().format(m.createdAt),
                    style: TextStyle(
                        fontSize: 10, color: mine ? Colors.white70 : AppColors.muted)),
              ]),
            ),
          ),
        ),
      ),
    );

    final rx = m.reactions;
    if (rx == null || rx.isEmpty) return bubble;
    final chips = rx.entries
        .where((e) => e.value.isNotEmpty)
        .map((e) => Container(
              margin: const EdgeInsets.only(right: 4, top: 2),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.background,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('${e.key} ${e.value.length}', style: const TextStyle(fontSize: 10)),
            ))
        .toList();
    return Column(crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
      bubble,
      Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Wrap(children: chips),
      ),
    ]);
  }

  Widget _replyPreview() {
    final m = _replyTo!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.mutedSurface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(children: [
        Container(width: 3, height: 32, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            const Text('Replying to',
                style: TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w700)),
            Text(m.body,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: AppColors.foreground)),
          ]),
        ),
        IconButton(
          icon: const Icon(LucideIcons.x, size: 16, color: AppColors.muted),
          onPressed: () => setState(() => _replyTo = null),
        ),
      ]),
    );
  }

  Future<void> _openAttachMenu() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(LucideIcons.image, color: AppColors.primary),
            title: const Text('Photo',
                style: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w700)),
            onTap: () async {
              Navigator.pop(context);
              await _pickAndSendImage(fromCamera: false);
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.camera, color: AppColors.primary),
            title: const Text('Camera',
                style: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w700)),
            onTap: () async {
              Navigator.pop(context);
              await _pickAndSendImage(fromCamera: true);
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.heart, color: AppColors.destructive),
            title: const Text('Share my wishlist',
                style: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w700)),
            onTap: () async {
              Navigator.pop(context);
              await _sendWishlistAttachment();
            },
          ),
          ListTile(
            leading: const Icon(LucideIcons.package, color: AppColors.primary),
            title: const Text('Share a product from my wishlist',
                style: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w700)),
            onTap: () async {
              Navigator.pop(context);
              await _pickAndShareWishlistProduct();
            },
          ),
        ]),
      ),
    );
  }

  // ── New: image upload ──────────────────────────────────────────────
  Future<void> _pickAndSendImage({required bool fromCamera}) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: fromCamera ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 2000,
        imageQuality: 82,
      );
      if (picked == null) return;
      final file = File(picked.path);
      final ext = picked.path.split('.').last.toLowerCase();
      final path =
          '${widget.conversation.id}/${DateTime.now().millisecondsSinceEpoch}.$ext';
      await supabase.storage.from('chat-media').uploadBinary(
            path,
            await file.readAsBytes(),
            fileOptions: FileOptions(
                contentType: 'image/$ext', upsert: false),
          );
      final url = supabase.storage.from('chat-media').getPublicUrl(path);
      final att = ChatAttachment(kind: 'image', data: {'url': url});
      await messagesService.insertMessage(
        conversationId: widget.conversation.id,
        senderId: uid,
        body: '',
        attachment: att,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    }
  }

  // ── New: forward ───────────────────────────────────────────────────
  Future<void> _forwardMessage(ChatMessage m) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    List<Map<String, dynamic>> convs = const [];
    try {
      final rows = await supabase
          .from('conversations')
          .select('id, title, last_message, buyer_id, supplier_id')
          .order('last_message_at', ascending: false)
          .limit(50);
      convs = (rows as List)
          .map((r) => Map<String, dynamic>.from(r as Map))
          .where((c) => c['id'] != widget.conversation.id)
          .toList();
    } catch (_) {}
    if (!mounted || convs.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No other conversations to forward to')));
      }
      return;
    }
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Forward to…',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: AppColors.foreground)),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: convs.length,
              itemBuilder: (_, i) {
                final c = convs[i];
                return ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: AppColors.mutedSurface,
                    child: Icon(LucideIcons.messageCircle, size: 14),
                  ),
                  title: Text(c['title']?.toString() ?? 'Conversation',
                      style: const TextStyle(color: AppColors.foreground)),
                  subtitle: Text(c['last_message']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted)),
                  onTap: () => Navigator.pop(context, c),
                );
              },
            ),
          ),
        ]),
      ),
    );
    if (picked == null) return;
    try {
      await messagesService.insertMessage(
        conversationId: picked['id'] as String,
        senderId: uid,
        body: m.body,
        attachment: m.attachment,
        forwarded: true,
      );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Forwarded')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Forward failed: $e')));
      }
    }
  }

  // ── New: calls ─────────────────────────────────────────────────────
  Future<String?> _peerPhone() async {
    final peerId = widget.conversation.peerUserId;
    if (peerId == null) return null;
    try {
      final row = await supabase
          .from('profiles')
          .select('phone, whatsapp')
          .eq('user_id', peerId)
          .maybeSingle();
      final p = (row?['whatsapp'] ?? row?['phone']) as String?;
      return p?.trim();
    } catch (_) {
      return null;
    }
  }

  Future<void> _callPeer() async {
    final phone = await _peerPhone();
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No phone number on file')));
      }
      return;
    }
    final uri = Uri.parse('tel:$phone');
    if (!await launchUrl(uri)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not start call')));
      }
    }
  }

  Future<void> _videoCallPeer() async {
    final phone = await _peerPhone();
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No number on file for video call')));
      }
      return;
    }
    // WhatsApp video call deep link (works if WhatsApp is installed and number is normalized).
    final normalized = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final uri = Uri.parse('https://wa.me/$normalized?call=video');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open video call')));
      }
    }
  }

  Future<void> _openThreadMenu() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(LucideIcons.bellOff, color: AppColors.muted),
            title: const Text('Mute notifications',
                style: TextStyle(color: AppColors.foreground)),
            onTap: () => Navigator.pop(context),
          ),
          ListTile(
            leading: const Icon(LucideIcons.flag, color: AppColors.destructive),
            title: const Text('Report',
                style: TextStyle(color: AppColors.destructive)),
            onTap: () => Navigator.pop(context),
          ),
        ]),
      ),
    );
  }

  Future<void> _sendWishlistAttachment() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final rows = await supabase.from('wishlist_items')
          .select('product_id').eq('user_id', uid);
      final count = (rows as List).length;
      final att = ChatAttachment(kind: 'wishlist', data: {'count': count, 'ownerId': uid});
      await messagesService.insertMessage(
        conversationId: widget.conversation.id,
        senderId: uid,
        body: '❤️ Wishlist · $count items',
        attachment: att,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not share wishlist: $e')));
      }
    }
  }

  Future<void> _pickAndShareWishlistProduct() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    List<Map<String, dynamic>> items = const [];
    try {
      final ids = await supabase.from('wishlist_items')
          .select('product_id').eq('user_id', uid);
      final list = (ids as List)
          .map((r) => (r as Map)['product_id'].toString()).toList();
      if (list.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Your wishlist is empty.')));
        }
        return;
      }
      final rows = await supabase.from('products')
          .select('id, title, price, image, supplier_id').inFilter('id', list);
      items = (rows as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load wishlist: $e')));
      }
      return;
    }

    if (!mounted) return;
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      backgroundColor: AppColors.background,
      builder: (_) => SafeArea(
        child: ListView.builder(
          shrinkWrap: true,
          itemCount: items.length,
          itemBuilder: (_, i) {
            final it = items[i];
            return ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.mutedSurface,
                backgroundImage: it['image'] != null
                    ? CachedNetworkImageProvider(it['image'].toString())
                    : null,
                child: it['image'] == null
                    ? const Icon(LucideIcons.package, size: 16)
                    : null,
              ),
              title: Text(it['title']?.toString() ?? 'Product',
                  style: const TextStyle(color: AppColors.foreground)),
              subtitle: Text('\$${it['price'] ?? 0}',
                  style: const TextStyle(color: AppColors.muted)),
              onTap: () => Navigator.pop(context, it),
            );
          },
        ),
      ),
    );
    if (picked == null) return;
    final att = ChatAttachment(kind: 'product', data: {
      'id': picked['id'],
      'title': picked['title'],
      'price': picked['price'],
      'image': picked['image'],
      'supplierId': picked['supplier_id'],
    });
    await messagesService.insertMessage(
      conversationId: widget.conversation.id,
      senderId: uid,
      body: '📦 ${picked['title'] ?? 'Product'}',
      attachment: att,
    );
  }

  Widget _composer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(children: [
        IconButton(
          icon: const Icon(LucideIcons.plus, size: 20, color: AppColors.foreground),
          onPressed: _openAttachMenu,
        ),
        Expanded(
          child: TextField(
            controller: _input,
            focusNode: _focus,
            minLines: 1,
            maxLines: 5,
            textInputAction: TextInputAction.newline,
            decoration: InputDecoration(
              hintText: 'Message',
              filled: true,
              fillColor: AppColors.mutedSurface,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Material(
          color: AppColors.primary,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _sending ? null : _send,
            child: const Padding(
              padding: EdgeInsets.all(10),
              child: Icon(LucideIcons.send, size: 18, color: Colors.white),
            ),
          ),
        ),
      ]),
    );
  }
}
