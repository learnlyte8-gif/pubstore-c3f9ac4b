import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../models/models.dart';
import '../../services/supabase_client.dart';
import '../../theme/palette.dart';
import '../../screens/group_buy_detail_screen.dart';

/// Flutter port of `src/components/social/GroupBuyStartSheet.tsx`.
/// Presents a bottom sheet to configure and create a group buy; on success
/// navigates to the group buy detail screen.
Future<void> showGroupBuyStartSheet(BuildContext context, Product product) async {
  if (product.supplierId == null || product.id.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Group buy is not available for this product.')),
    );
    return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _GroupBuyStartSheet(product: product),
  );
}

class _Friend {
  _Friend(this.userId, this.name, this.avatar);
  final String userId;
  final String name;
  final String? avatar;
}

class _GroupBuyStartSheet extends StatefulWidget {
  const _GroupBuyStartSheet({required this.product});
  final Product product;

  @override
  State<_GroupBuyStartSheet> createState() => _GroupBuyStartSheetState();
}

class _GroupBuyStartSheetState extends State<_GroupBuyStartSheet> {
  late final TextEditingController _title =
      TextEditingController(text: 'Group buy: ${widget.product.title}');
  final _searchCtl = TextEditingController();
  int _targetQty = 10;
  DateTime? _deadline;
  List<_Friend> _friends = const [];
  final _picked = <String>{};
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  @override
  void dispose() {
    _title.dispose();
    _searchCtl.dispose();
    super.dispose();
  }

  Future<void> _loadFriends() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final follows = await supabase
          .from('user_follows').select('followee_id').eq('follower_id', uid);
      final ids = (follows as List).map((f) => (f as Map)['followee_id'].toString()).toList();
      if (ids.isEmpty) { setState(() { _friends = []; _loading = false; }); return; }
      final profs = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url').inFilter('user_id', ids);
      final list = (profs as List).map((p) {
        final m = Map<String, dynamic>.from(p as Map);
        return _Friend(
          m['user_id'].toString(),
          (m['display_name'] ?? m['username'] ?? 'User').toString(),
          m['avatar_url']?.toString(),
        );
      }).toList();
      if (mounted) setState(() { _friends = list; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    if (_title.text.trim().isEmpty || _targetQty < 1) return;
    setState(() => _busy = true);
    try {
      final row = await supabase.from('group_buys').insert({
        'owner_id': uid,
        'product_id': widget.product.id,
        'supplier_id': widget.product.supplierId,
        'title': _title.text.trim(),
        'target_qty': _targetQty,
        'deadline': _deadline?.toUtc().toIso8601String(),
      }).select('id').single();
      final gbId = (row as Map)['id'].toString();
      if (_picked.isNotEmpty) {
        try {
          await supabase.from('group_buy_invites').insert(
            _picked.map((invitee) => {
              'group_id': gbId,
              'inviter_id': uid,
              'invitee_id': invitee,
            }).toList(),
          );
        } catch (_) {}
      }
      if (!mounted) return;
      Navigator.of(context).pop();
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => GroupBuyDetailScreen(groupBuyId: gbId)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't create group buy: $e")));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickDeadline() async {
    final now = DateTime.now();
    final d = await showDatePicker(
        context: context, firstDate: now, lastDate: now.add(const Duration(days: 60)),
        initialDate: _deadline ?? now.add(const Duration(days: 3)));
    if (d == null) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    setState(() => _deadline = DateTime(d.year, d.month, d.day, t?.hour ?? 23, t?.minute ?? 59));
  }

  @override
  Widget build(BuildContext context) {
    final q = _searchCtl.text.trim().toLowerCase();
    final list = q.isEmpty
        ? _friends
        : _friends.where((f) => f.name.toLowerCase().contains(q)).toList();
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
              const Icon(LucideIcons.users, size: 18),
              const SizedBox(width: 6),
              const Expanded(child: Text('Start group buy',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16))),
              IconButton(icon: const Icon(LucideIcons.x),
                  onPressed: () => Navigator.of(context).pop()),
            ]),
          ),
          Expanded(
            child: ListView(
              controller: scrollCtl,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                const Text('TITLE', style: TextStyle(
                    fontSize: 10, letterSpacing: 0.6,
                    fontWeight: FontWeight.w800, color: AppColors.muted)),
                const SizedBox(height: 4),
                TextField(controller: _title, decoration: _fieldDeco()),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('TARGET UNITS', style: TextStyle(
                        fontSize: 10, letterSpacing: 0.6,
                        fontWeight: FontWeight.w800, color: AppColors.muted)),
                    const SizedBox(height: 4),
                    TextField(
                      keyboardType: TextInputType.number,
                      controller: TextEditingController(text: '$_targetQty'),
                      onChanged: (v) => _targetQty = int.tryParse(v) ?? 1,
                      decoration: _fieldDeco(),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('DEADLINE', style: TextStyle(
                        fontSize: 10, letterSpacing: 0.6,
                        fontWeight: FontWeight.w800, color: AppColors.muted)),
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: _pickDeadline,
                      child: Container(
                        height: 48, padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
                        alignment: Alignment.centerLeft,
                        child: Text(_deadline == null
                            ? 'Pick a date'
                            : '${_deadline!.year}-${_deadline!.month.toString().padLeft(2, '0')}-${_deadline!.day.toString().padLeft(2, '0')}',
                            style: TextStyle(
                                color: _deadline == null ? AppColors.muted : AppColors.foreground,
                                fontSize: 13)),
                      ),
                    ),
                  ])),
                ]),
                const SizedBox(height: 16),
                const Text('INVITE (FROM YOUR FOLLOWS)', style: TextStyle(
                    fontSize: 10, letterSpacing: 0.6,
                    fontWeight: FontWeight.w800, color: AppColors.muted)),
                const SizedBox(height: 4),
                TextField(
                  controller: _searchCtl,
                  onChanged: (_) => setState(() {}),
                  decoration: _fieldDeco().copyWith(
                    hintText: 'Search people',
                    prefixIcon: const Icon(LucideIcons.search, size: 18)),
                ),
                const SizedBox(height: 8),
                if (_loading)
                  const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
                else if (list.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(_friends.isEmpty
                        ? 'Follow people first to invite them here.'
                        : 'No matches.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  )
                else ...list.map((f) {
                  final on = _picked.contains(f.userId);
                  return InkWell(
                    onTap: () => setState(() =>
                        on ? _picked.remove(f.userId) : _picked.add(f.userId)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Row(children: [
                        CircleAvatar(
                          radius: 18, backgroundColor: AppColors.mutedSurface,
                          backgroundImage: f.avatar != null ? CachedNetworkImageProvider(f.avatar!) : null,
                          child: f.avatar == null
                              ? Text(f.name.isNotEmpty ? f.name[0].toUpperCase() : '?',
                                  style: const TextStyle(fontWeight: FontWeight.w800))
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(f.name,
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                        Container(
                          width: 22, height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: on ? AppColors.primary : Colors.transparent,
                            border: Border.all(
                              color: on ? AppColors.primary : AppColors.border, width: 2),
                          ),
                          child: on ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
                        ),
                      ]),
                    ),
                  );
                }),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(
                width: double.infinity, height: 48,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _submit,
                  icon: const Icon(LucideIcons.users, size: 16),
                  label: Text(_busy ? 'Creating…' : 'Create group buy'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28))),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  InputDecoration _fieldDeco() => InputDecoration(
    filled: true, fillColor: AppColors.mutedSurface,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
  );
}
