import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/auth_service.dart';
import '../services/messages_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Single conversation — mirrors the thread pane in `src/pages/Messages.tsx`.
class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({super.key, required this.conversationId, required this.title});
  final String conversationId;
  final String title;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _load();
    _channel = supabase
        .channel('messages:${widget.conversationId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.conversationId,
          ),
          callback: (payload) {
            final row = payload.newRecord;
            if (!mounted) return;
            setState(() => _messages.add(row));
            _scrollToEnd();
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    if (_channel != null) supabase.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await messagesService.listMessages(widget.conversationId);
      if (!mounted) return;
      setState(() {
        _messages = rows;
        _loading = false;
      });
      _scrollToEnd();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(_scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    });
  }

  Future<void> _send() async {
    final user = ref.read(currentUserProvider);
    final text = _controller.text.trim();
    if (user == null || text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await messagesService.sendMessage(
        conversationId: widget.conversationId,
        senderId: user.id,
        body: text,
      );
      _controller.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title,
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(
                        child: Text('Say hi 👋',
                            style: TextStyle(color: AppColors.muted)))
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 12),
                        itemCount: _messages.length,
                        itemBuilder: (context, i) {
                          final m = _messages[i];
                          final mine = m['sender_id'] == user?.id;
                          return _Bubble(
                            mine: mine,
                            body: m['body'] as String? ?? '',
                            at: m['created_at'] as String?,
                          );
                        },
                      ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: AppColors.background,
              border:
                  Border(top: BorderSide(color: AppColors.border, width: 1)),
            ),
            padding: EdgeInsets.only(
                left: 10,
                right: 6,
                top: 8,
                bottom: MediaQuery.of(context).viewInsets.bottom > 0 ? 8 : 12),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: 'Message…',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _sending ? null : _send,
                icon: _sending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(LucideIcons.send, size: 16),
                style: IconButton.styleFrom(
                    backgroundColor: AppColors.foreground,
                    foregroundColor: AppColors.background),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.mine, required this.body, required this.at});
  final bool mine;
  final String body;
  final String? at;

  @override
  Widget build(BuildContext context) {
    final time = at == null
        ? ''
        : DateFormat.Hm().format(DateTime.parse(at!).toLocal());
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: mine ? AppColors.foreground : AppColors.mutedSurface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(AppRadii.md),
            topRight: const Radius.circular(AppRadii.md),
            bottomLeft: Radius.circular(mine ? AppRadii.md : 4),
            bottomRight: Radius.circular(mine ? 4 : AppRadii.md),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(body,
                style: TextStyle(
                    color: mine ? AppColors.background : AppColors.foreground,
                    fontSize: 14,
                    height: 1.35)),
            const SizedBox(height: 2),
            Text(time,
                style: TextStyle(
                    color: mine
                        ? AppColors.background.withOpacity(0.6)
                        : AppColors.muted,
                    fontSize: 10)),
          ],
        ),
      ),
    );
  }
}
