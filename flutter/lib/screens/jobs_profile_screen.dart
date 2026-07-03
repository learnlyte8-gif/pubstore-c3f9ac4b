import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/JobsProfile.tsx` — job seeker profile: headline, about,
/// experience, education, skills. Reads/writes `job_seeker_profiles` and its
/// related tables.
class JobsProfileScreen extends StatefulWidget {
  const JobsProfileScreen({super.key});
  @override
  State<JobsProfileScreen> createState() => _JobsProfileScreenState();
}

class _JobsProfileScreenState extends State<JobsProfileScreen> {
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _experiences = [];
  List<Map<String, dynamic>> _education = [];
  bool _loading = true;
  bool _editing = false;

  final _headline = TextEditingController();
  final _about = TextEditingController();
  final _location = TextEditingController();
  final _skills = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final p = await supabase.from('job_seeker_profiles').select('*').eq('user_id', uid).maybeSingle();
      final e = await supabase.from('job_seeker_experiences').select('*').eq('user_id', uid).order('start_date', ascending: false);
      final ed = await supabase.from('job_seeker_education').select('*').eq('user_id', uid).order('start_date', ascending: false);
      _profile = p == null ? null : Map<String, dynamic>.from(p);
      _headline.text = _profile?['headline']?.toString() ?? '';
      _about.text = _profile?['about']?.toString() ?? '';
      _location.text = _profile?['location']?.toString() ?? '';
      _skills.text = (_profile?['skills'] as List?)?.join(', ') ?? '';
      _experiences = (e as List).cast<Map<String, dynamic>>();
      _education = (ed as List).cast<Map<String, dynamic>>();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('job_seeker_profiles').upsert({
      'user_id': uid,
      'headline': _headline.text.trim(),
      'about': _about.text.trim(),
      'location': _location.text.trim(),
      'skills': _skills.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
    });
    setState(() => _editing = false);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Skeletons.list(count: 4));
    return Scaffold(
      appBar: AppBar(
        title: const Text('My professional profile'),
        actions: [
          IconButton(
            icon: Icon(_editing ? LucideIcons.check : LucideIcons.pencil),
            onPressed: _editing ? _save : () => setState(() => _editing = true),
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AppColors.mutedSurface,
            backgroundImage: (_profile?['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(_profile!['avatar_url']) : null,
            child: (_profile?['avatar_url'] ?? '').toString().isEmpty ? const Icon(LucideIcons.user, size: 28) : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _editing
                  ? TextField(controller: _headline, decoration: const InputDecoration(labelText: 'Headline'))
                  : Text(_headline.text.isEmpty ? 'Add a headline' : _headline.text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              _editing
                  ? TextField(controller: _location, decoration: const InputDecoration(labelText: 'Location'))
                  : Text(_location.text, style: const TextStyle(color: AppColors.muted)),
            ]),
          ),
        ]),
        const SizedBox(height: 24),
        _sectionTitle('About'),
        _editing
            ? TextField(controller: _about, maxLines: 4, decoration: const InputDecoration(border: OutlineInputBorder()))
            : Text(_about.text.isEmpty ? 'Tell recruiters about yourself.' : _about.text, style: const TextStyle(height: 1.4)),
        const SizedBox(height: 24),
        _sectionTitle('Skills'),
        _editing
            ? TextField(controller: _skills, decoration: const InputDecoration(hintText: 'e.g. Flutter, PostgreSQL, Figma', border: OutlineInputBorder()))
            : Wrap(spacing: 6, runSpacing: 6, children: [
                for (final s in _skills.text.split(',').map((x) => x.trim()).where((x) => x.isNotEmpty))
                  Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)), child: Text(s, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
              ]),
        const SizedBox(height: 24),
        _sectionTitle('Experience'),
        for (final e in _experiences) _card(e['title'], '${e['company']} · ${e['location'] ?? ''}', '${e['start_date'] ?? ''} — ${e['end_date'] ?? 'Present'}'),
        if (_experiences.isEmpty) const Text('No experience added yet.', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 24),
        _sectionTitle('Education'),
        for (final e in _education) _card(e['school'], e['degree'], '${e['start_date'] ?? ''} — ${e['end_date'] ?? ''}'),
        if (_education.isEmpty) const Text('No education added yet.', style: TextStyle(color: AppColors.muted)),
      ]),
    );
  }

  Widget _sectionTitle(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)));
  Widget _card(dynamic title, dynamic subtitle, String range) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${title ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
          Text('${subtitle ?? ''}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          Text(range, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
        ]),
      );
}
