import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/JobsProfile.tsx` — job seeker profile with editable
/// headline, about, skills, and add/remove of experiences & education.
/// Backed by `job_seeker_profiles`, `job_seeker_experiences`,
/// `job_seeker_education`.
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
  final _city = TextEditingController();
  final _country = TextEditingController();
  final _skills = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final p = await supabase.from('job_seeker_profiles').select('*').eq('user_id', uid).maybeSingle();
      final e = await supabase.from('job_seeker_experiences').select('*').eq('user_id', uid).order('sort_order', ascending: true).order('start_date', ascending: false);
      final ed = await supabase.from('job_seeker_education').select('*').eq('user_id', uid).order('sort_order', ascending: true).order('start_year', ascending: false);
      _profile = p == null ? null : Map<String, dynamic>.from(p);
      _headline.text = _profile?['headline']?.toString() ?? '';
      _about.text = _profile?['about']?.toString() ?? '';
      _city.text = _profile?['location_city']?.toString() ?? '';
      _country.text = _profile?['location_country']?.toString() ?? '';
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
      'location_city': _city.text.trim(),
      'location_country': _country.text.trim(),
      'skills': _skills.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
    });
    if (!mounted) return;
    setState(() => _editing = false);
    _load();
  }

  Future<void> _addExperience() async {
    final r = await showModalBottomSheet<Map<String, dynamic>>(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => const _ExperienceSheet(),
    );
    if (r == null) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('job_seeker_experiences').insert({...r, 'user_id': uid});
    _load();
  }

  Future<void> _addEducation() async {
    final r = await showModalBottomSheet<Map<String, dynamic>>(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => const _EducationSheet(),
    );
    if (r == null) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('job_seeker_education').insert({...r, 'user_id': uid});
    _load();
  }

  Future<void> _delete(String table, String id) async {
    await supabase.from(table).delete().eq('id', id);
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
                  ? Row(children: [
                      Expanded(child: TextField(controller: _city, decoration: const InputDecoration(labelText: 'City'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: _country, decoration: const InputDecoration(labelText: 'Country'))),
                    ])
                  : Text([_city.text, _country.text].where((s) => s.isNotEmpty).join(', '), style: const TextStyle(color: AppColors.muted)),
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
        Row(children: [
          Expanded(child: _sectionTitle('Experience')),
          IconButton(icon: const Icon(LucideIcons.plus, size: 18), onPressed: _addExperience),
        ]),
        if (_experiences.isEmpty) const Text('No experience added yet.', style: TextStyle(color: AppColors.muted)),
        for (final e in _experiences)
          _card(e['title'], '${e['company'] ?? ''}${e['location'] != null ? ' · ${e['location']}' : ''}',
              '${e['start_date'] ?? ''} — ${e['is_current'] == true ? 'Present' : (e['end_date'] ?? '')}',
              onDelete: () => _delete('job_seeker_experiences', e['id'].toString())),
        const SizedBox(height: 24),
        Row(children: [
          Expanded(child: _sectionTitle('Education')),
          IconButton(icon: const Icon(LucideIcons.plus, size: 18), onPressed: _addEducation),
        ]),
        if (_education.isEmpty) const Text('No education added yet.', style: TextStyle(color: AppColors.muted)),
        for (final e in _education)
          _card(e['school'], '${e['degree'] ?? ''}${e['field_of_study'] != null ? ' · ${e['field_of_study']}' : ''}',
              '${e['start_year'] ?? ''} — ${e['end_year'] ?? ''}',
              onDelete: () => _delete('job_seeker_education', e['id'].toString())),
      ]),
    );
  }

  Widget _sectionTitle(String t) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)));

  Widget _card(dynamic title, dynamic subtitle, String range, {VoidCallback? onDelete}) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${title ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
        Text('${subtitle ?? ''}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        Text(range, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
      ])),
      if (onDelete != null)
        IconButton(icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.destructive), onPressed: onDelete),
    ]),
  );
}

class _ExperienceSheet extends StatefulWidget {
  const _ExperienceSheet();
  @override
  State<_ExperienceSheet> createState() => _ExperienceSheetState();
}

class _ExperienceSheetState extends State<_ExperienceSheet> {
  final _title = TextEditingController();
  final _company = TextEditingController();
  final _location = TextEditingController();
  final _start = TextEditingController();
  final _end = TextEditingController();
  final _desc = TextEditingController();
  bool _current = false;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
    child: SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Add experience', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _company, decoration: const InputDecoration(labelText: 'Company *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _location, decoration: const InputDecoration(labelText: 'Location', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: _start, decoration: const InputDecoration(labelText: 'Start (YYYY-MM)', border: OutlineInputBorder()))),
          const SizedBox(width: 8),
          Expanded(child: TextField(controller: _end, enabled: !_current, decoration: const InputDecoration(labelText: 'End (YYYY-MM)', border: OutlineInputBorder()))),
        ]),
        CheckboxListTile(value: _current, onChanged: (v) => setState(() => _current = v ?? false), title: const Text('I currently work here'), controlAffinity: ListTileControlAffinity.leading, contentPadding: EdgeInsets.zero),
        TextField(controller: _desc, maxLines: 3, decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () {
            if (_title.text.trim().isEmpty || _company.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'title': _title.text.trim(), 'company': _company.text.trim(),
              'location': _location.text.trim(),
              'start_date': _start.text.trim().isEmpty ? null : _start.text.trim(),
              'end_date': _current ? null : (_end.text.trim().isEmpty ? null : _end.text.trim()),
              'is_current': _current,
              'description': _desc.text.trim(),
            });
          },
          child: const Text('Save'),
        ),
      ]),
    ),
  );
}

class _EducationSheet extends StatefulWidget {
  const _EducationSheet();
  @override
  State<_EducationSheet> createState() => _EducationSheetState();
}

class _EducationSheetState extends State<_EducationSheet> {
  final _school = TextEditingController();
  final _degree = TextEditingController();
  final _field = TextEditingController();
  final _start = TextEditingController();
  final _end = TextEditingController();

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
    child: SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Add education', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        TextField(controller: _school, decoration: const InputDecoration(labelText: 'School *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _degree, decoration: const InputDecoration(labelText: 'Degree', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _field, decoration: const InputDecoration(labelText: 'Field of study', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: _start, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Start year', border: OutlineInputBorder()))),
          const SizedBox(width: 8),
          Expanded(child: TextField(controller: _end, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'End year', border: OutlineInputBorder()))),
        ]),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () {
            if (_school.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'school': _school.text.trim(),
              'degree': _degree.text.trim(),
              'field_of_study': _field.text.trim(),
              'start_year': int.tryParse(_start.text.trim()),
              'end_year': int.tryParse(_end.text.trim()),
            });
          },
          child: const Text('Save'),
        ),
      ]),
    ),
  );
}
