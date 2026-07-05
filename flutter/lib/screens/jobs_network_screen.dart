import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'user_profile_screen.dart';

/// Mirrors `src/pages/JobsNetwork.tsx` — Connections / Requests / Discover
/// tabs backed by `job_connections` and `job_seeker_profiles`.
class JobsNetworkScreen extends StatefulWidget {
  const JobsNetworkScreen({super.key});
  @override
  State<JobsNetworkScreen> createState() => _JobsNetworkScreenState();
}

class _JobsNetworkScreenState extends State<JobsNetworkScreen> {
  int _tab = 0;
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return [];
    if (_tab == 2) {
      // Discover: seeker profiles minus me
      final rows = await supabase
          .from('job_seeker_profiles')
          .select('user_id, headline, avatar_url, location_city, location_country, current_title, current_company')
          .neq('user_id', uid).limit(50);
      // Existing connection ids to hide status
      final conns = await supabase.from('job_connections').select('requester_id, recipient_id, status')
          .or('requester_id.eq.$uid,recipient_id.eq.$uid');
      final connected = <String, String>{};
      for (final c in (conns as List)) {
        final m = Map<String, dynamic>.from(c as Map);
        final other = m['requester_id'] == uid ? m['recipient_id'] : m['requester_id'];
        connected[other.toString()] = m['status'].toString();
      }
      return (rows as List).cast<Map<String, dynamic>>().map((r) {
        r['_connection_status'] = connected[r['user_id'].toString()];
        return r;
      }).toList();
    }
    final status = _tab == 0 ? 'accepted' : 'pending';
    final rows = await supabase
        .from('job_connections')
        .select('*, requester:requester_id(display_name, avatar_url, headline), recipient:recipient_id(display_name, avatar_url, headline)')
        .or('requester_id.eq.$uid,recipient_id.eq.$uid')
        .eq('status', status)
        .order('created_at', ascending: false);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> _respond(String id, String action) async {
    await supabase.from('job_connections').update({'status': action}).eq('id', id);
    setState(() => _future = _load());
  }

  Future<void> _sendConnect(String otherId) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      await supabase.from('job_connections').insert({
        'requester_id': uid, 'recipient_id': otherId, 'status': 'pending',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Request sent')));
      setState(() => _future = _load());
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  void _select(int i) => setState(() { _tab = i; _future = _load(); });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My network'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Row(children: [
            for (final e in const [(0, 'Connections'), (1, 'Requests'), (2, 'Discover')])
              Expanded(
                child: InkWell(
                  onTap: () => _select(e.$1),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _tab == e.$1 ? AppColors.foreground : Colors.transparent, width: 2))),
                    child: Text(e.$2, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w800, color: _tab == e.$1 ? AppColors.foreground : AppColors.muted)),
                  ),
                ),
              ),
          ]),
        ),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final rows = snap.data ?? const [];
          if (rows.isEmpty) return Center(child: Text(_tab == 0 ? 'No connections yet' : _tab == 1 ? 'No pending requests' : 'Nobody to discover'));
          final uid = supabase.auth.currentUser?.id;
          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: rows.length,
            separatorBuilder: (_, __) => const Divider(color: AppColors.border, height: 1),
            itemBuilder: (context, i) {
              final row = rows[i];
              if (_tab == 2) {
                final status = row['_connection_status']?.toString();
                return ListTile(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => UserProfileScreen(userId: row['user_id'].toString()))),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.mutedSurface,
                    backgroundImage: (row['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(row['avatar_url']) : null,
                    child: (row['avatar_url'] ?? '').toString().isEmpty ? const Icon(LucideIcons.user, size: 18) : null,
                  ),
                  title: Text(row['current_title']?.toString() ?? row['headline']?.toString() ?? 'Member', style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text('${row['current_company'] ?? ''} · ${row['location_city'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: status == null
                      ? OutlinedButton(onPressed: () => _sendConnect(row['user_id'].toString()), child: const Text('Connect'))
                      : Text(status.toUpperCase(), style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w900)),
                );
              }
              final otherIsRequester = row['recipient_id'] == uid;
              final other = (otherIsRequester ? row['requester'] : row['recipient']) as Map? ?? {};
              final otherId = (otherIsRequester ? row['requester_id'] : row['recipient_id']).toString();
              return ListTile(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => UserProfileScreen(userId: otherId))),
                leading: CircleAvatar(
                  backgroundColor: AppColors.mutedSurface,
                  backgroundImage: (other['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(other['avatar_url']) : null,
                  child: (other['avatar_url'] ?? '').toString().isEmpty ? const Icon(LucideIcons.user, color: AppColors.muted, size: 18) : null,
                ),
                title: Text(other['display_name']?.toString() ?? 'Member', style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(other['headline']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: _tab == 1 && otherIsRequester
                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(icon: const Icon(LucideIcons.check, color: AppColors.success), onPressed: () => _respond(row['id'].toString(), 'accepted')),
                        IconButton(icon: const Icon(LucideIcons.x, color: AppColors.destructive), onPressed: () => _respond(row['id'].toString(), 'declined')),
                      ])
                    : const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.muted),
              );
            },
          );
        },
      ),
    );
  }
}
