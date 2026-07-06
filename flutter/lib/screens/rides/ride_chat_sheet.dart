import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

Future<void> showRideChatSheet(BuildContext context, {required String rideId}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => FractionallySizedBox(
      heightFactor: 0.85,
      child: _RideChatSheet(rideId: rideId),
    ),
  );
}

class _RideChatSheet extends StatefulWidget {
  const _RideChatSheet({required this.rideId});
  final String rideId;
  @override
  State<_RideChatSheet> createState() => _RideChatSheetState();
}

class _RideChatSheetState extends State<_RideChatSheet> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _msgs = const [];
  RealtimeChannel? _ch;

  @override
  void initState() {
    super.initState();
    _load();
    _ch = supabase.channel('ride-msgs:${widget.rideId}').onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'ride_messages',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'ride_id', value: widget.rideId),
          callback: (_) => _load(),
        ).subscribe();
  }

  @override
  void dispose() {
    if (_ch != null) supabase.removeChannel(_ch!);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final rows = await supabase.from('ride_messages').select('*').eq('ride_id', widget.rideId).order('created_at');
    if (!mounted) return;
    setState(() => _msgs = (rows as List).cast<Map<String, dynamic>>());
    await Future<void>.delayed(const Duration(milliseconds: 60));
    if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
  }

  Future<void> _send() async {
    final uid = supabase.auth.currentUser?.id;
    final t = _input.text.trim();
    if (uid == null || t.isEmpty) return;
    _input.clear();
    await supabase.from('ride_messages').insert({
      'ride_id': widget.rideId,
      'sender_id': uid,
      'body': t,
    });
  }

  @override
  Widget build(BuildContext context) {
    final me = supabase.auth.currentUser?.id;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
          child: Row(children: [
            const Icon(LucideIcons.messageCircle, size: 18),
            const SizedBox(width: 8),
            const Text('Ride chat', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
            const Spacer(),
            IconButton(onPressed: () => Navigator.of(context).maybePop(), icon: const Icon(LucideIcons.x)),
          ]),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.all(12),
            itemCount: _msgs.length,
            itemBuilder: (_, i) {
              final m = _msgs[i];
              final mine = m['sender_id'] == me;
              return Align(
                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  constraints: const BoxConstraints(maxWidth: 280),
                  decoration: BoxDecoration(
                    color: mine ? AppColors.primary : AppColors.mutedSurface,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text('${m['body'] ?? ''}',
                      style: TextStyle(color: mine ? Colors.white : AppColors.foreground)),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Message…',
                  filled: true, fillColor: AppColors.mutedSurface,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _send, style: FilledButton.styleFrom(shape: const CircleBorder(), padding: const EdgeInsets.all(14)), child: const Icon(LucideIcons.send, size: 16)),
          ]),
        ),
      ]),
    );
  }
}
