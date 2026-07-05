import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/jobs_models.dart';
import '../services/jobs_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Mirrors `src/pages/Jobs.tsx` — LinkedIn-style hub with feed / saved /
/// applied / manage tabs.
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  int _tab = 0; // feed / saved / applied / manage
  String _query = '';
  String? _category;
  String? _workplace;
  bool _loading = true;
  List<JobPosting> _jobs = const [];
  Set<String> _saved = {};
  Set<String> _applied = {};
  String? _userId;

  static const _categories = [
    ['engineering', 'Engineering'],
    ['design', 'Design'],
    ['marketing', 'Marketing'],
    ['sales', 'Sales'],
    ['finance', 'Finance'],
    ['operations', 'Operations'],
    ['general', 'Other'],
  ];
  static const _workplaces = [
    ['on_site', 'On-site'],
    ['hybrid', 'Hybrid'],
    ['remote', 'Remote'],
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _userId = supabase.auth.currentUser?.id;
    final jobs = await jobsService.fetchJobs(
      category: _category,
      workplace: _workplace,
      query: _query.isEmpty ? null : _query,
    );
    final saved = _userId == null ? <String>{} : await jobsService.fetchSavedIds(_userId!);
    Set<String> applied = {};
    if (_userId != null) {
      final apps = await supabase.from('job_applications').select('job_id').eq('applicant_id', _userId!);
      applied = (apps as List).map((r) => (r as Map)['job_id'].toString()).toSet();
    }
    if (!mounted) return;
    setState(() {
      _jobs = jobs;
      _saved = saved;
      _applied = applied;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildHero(context)),
          if (_tab == 0)
            SliverToBoxAdapter(child: _buildFilters()),
          if (_loading)
            const SliverFillRemaining(
                child: Skeletons.list(count: 4))
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              sliver: SliverList.separated(
              itemCount: _visible().length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _JobCard(
                  job: _visible()[i],
                  saved: _saved.contains(_visible()[i].id),
                  applied: _applied.contains(_visible()[i].id),
                  onSave: _toggleSave,
                  onOpen: () => _openJob(_visible()[i]),
                ),
              ),
            ),
        ],
      ),
    );
  }

  List<JobPosting> _visible() {
    if (_tab == 1) return _jobs.where((j) => _saved.contains(j.id)).toList();
    if (_tab == 2) return _jobs.where((j) => _applied.contains(j.id)).toList();
    return _jobs;
  }

  void _openJob(JobPosting j) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _JobDetailSheet(
        job: j,
        saved: _saved.contains(j.id),
        applied: _applied.contains(j.id),
        onToggleSave: () => _toggleSave(j),
        onApplied: () async { await _load(); if (mounted) Navigator.of(context).maybePop(); },
      ),
    );
  }

  Future<void> _toggleSave(JobPosting j) async {
    if (_userId == null) return;
    final was = _saved.contains(j.id);
    await jobsService.toggleSave(_userId!, j.id, was);
    setState(() {
      if (was) {
        _saved.remove(j.id);
      } else {
        _saved.add(j.id);
      }
    });
  }

  Widget _buildHero(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 12,
          left: 16, right: 16, bottom: 16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1D4ED8), Color(0xFF4338CA), Color(0xFF0284C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(children: [
        Row(children: [
          _iconChip(LucideIcons.arrowLeft,
              onTap: () => Navigator.of(context).maybePop()),
          const SizedBox(width: 8),
          _iconChip(LucideIcons.briefcase),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Jobs',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800)),
                Text('Hire talent. Find work. Build your network.',
                    style: TextStyle(color: Colors.white70, fontSize: 11)),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.foreground,
              padding: const EdgeInsets.symmetric(horizontal: 12),
            ),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Post-a-job flow coming soon'))),
            icon: const Icon(LucideIcons.plus, size: 14),
            label: const Text('Post', style: TextStyle(fontSize: 12)),
          ),
        ]),
        const SizedBox(height: 12),
        TextField(
          onSubmitted: (v) { _query = v; _load(); },
          style: const TextStyle(color: AppColors.foreground),
          decoration: InputDecoration(
            hintText: 'Search title, skill, company',
            prefixIcon: const Icon(LucideIcons.search, size: 16),
            filled: true,
            fillColor: Colors.white,
            isDense: true,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            children: List.generate(4, (i) {
              const labels = ['All jobs', 'Saved', 'Applied', 'Manage'];
              final active = _tab == i;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _tab = i),
                  child: Container(
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: active ? Colors.white : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(labels[i],
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: active ? AppColors.foreground : Colors.white)),
                  ),
                ),
              );
            }),
          ),
        ),
      ]),
    );
  }

  Widget _iconChip(IconData icon, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Wrap(spacing: 8, runSpacing: 8, children: [
        _dropdown('Category', _category, _categories, (v) {
          setState(() => _category = v); _load();
        }),
        _dropdown('Workplace', _workplace, _workplaces, (v) {
          setState(() => _workplace = v); _load();
        }),
      ]),
    );
  }

  Widget _dropdown(String label, String? value, List<List<String>> opts,
      ValueChanged<String?> onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(999),
      ),
      child: DropdownButton<String?>(
        value: value,
        hint: Text(label, style: const TextStyle(fontSize: 12)),
        underline: const SizedBox.shrink(),
        style: const TextStyle(fontSize: 12, color: AppColors.foreground),
        items: [
          const DropdownMenuItem<String?>(value: null, child: Text('Any')),
          ...opts.map((o) => DropdownMenuItem<String?>(
              value: o[0], child: Text(o[1]))),
        ],
        onChanged: onChanged,
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.saved, required this.applied, required this.onSave, required this.onOpen});
  final JobPosting job;
  final bool saved;
  final bool applied;
  final ValueChanged<JobPosting> onSave;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.md),
          color: AppColors.card,
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(job.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            ),
            IconButton(
              icon: Icon(saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark,
                  size: 18, color: saved ? AppColors.primary : AppColors.muted),
              onPressed: () => onSave(job),
            ),
          ]),
          const SizedBox(height: 4),
          Wrap(spacing: 6, runSpacing: 6, children: [
            _pill(job.employmentType.replaceAll('_', ' ')),
            _pill(job.workplaceType.replaceAll('_', '-')),
            if (job.city != null) _pill('${job.city}${job.country != null ? ', ${job.country}' : ''}', icon: LucideIcons.mapPin),
            if (applied) Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(999)),
              child: const Text('✓ Applied', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w800)),
            ),
          ]),
          if (job.salaryLabel != null) ...[
            const SizedBox(height: 8),
            Text(job.salaryLabel!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.primary)),
          ],
          if (job.description != null && job.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(job.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ],
        ]),
      ),
    );
  }

  Widget _pill(String text, {IconData? icon}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      if (icon != null) ...[Icon(icon, size: 10), const SizedBox(width: 3)],
      Text(text, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
    ]),
  );
}

/* --------- Job detail bottom sheet with apply flow --------- */

class _JobDetailSheet extends StatefulWidget {
  const _JobDetailSheet({required this.job, required this.saved, required this.applied, required this.onToggleSave, required this.onApplied});
  final JobPosting job;
  final bool saved;
  final bool applied;
  final VoidCallback onToggleSave;
  final Future<void> Function() onApplied;

  @override
  State<_JobDetailSheet> createState() => _JobDetailSheetState();
}

class _JobDetailSheetState extends State<_JobDetailSheet> {
  Map<String, dynamic>? _company;
  bool _loadingCompany = true;

  @override
  void initState() {
    super.initState();
    _loadCompany();
  }

  Future<void> _loadCompany() async {
    try {
      final c = await supabase.from('job_companies').select('*').eq('id', widget.job.companyId).maybeSingle();
      if (mounted) setState(() { _company = c == null ? null : Map<String, dynamic>.from(c); _loadingCompany = false; });
    } catch (_) { if (mounted) setState(() => _loadingCompany = false); }
  }

  Future<void> _openApply() async {
    final ok = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _ApplyDialog(job: widget.job),
    );
    if (ok == true) await widget.onApplied();
  }

  @override
  Widget build(BuildContext context) {
    final j = widget.job;
    return DraggableScrollableSheet(
      expand: false, initialChildSize: .9, maxChildSize: .95,
      builder: (_, ctrl) => Column(children: [
        Expanded(
          child: ListView(controller: ctrl, padding: const EdgeInsets.all(16), children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 56, height: 56, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(16)),
                child: const Icon(LucideIcons.building2, color: AppColors.muted)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(j.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                if (!_loadingCompany && _company != null)
                  Text('${_company!['name']}${_company!['verified'] == true ? ' · ✓ Verified' : ''}',
                      style: const TextStyle(color: AppColors.muted)),
                if (j.city != null || j.country != null)
                  Text([j.city, j.country].where((s) => s != null).join(', '), style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ])),
            ]),
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _tag(j.workplaceType.replaceAll('_', '-')),
              _tag(j.employmentType.replaceAll('_', ' ')),
              _tag(j.experienceLevel),
              if (j.featured) Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(999)),
                child: const Text('Featured', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w900)),
              ),
            ]),
            if (j.salaryLabel != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('SALARY', style: TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w900)),
                  Text(j.salaryLabel!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                ]),
              ),
            ],
            if (j.description != null && j.description!.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('About the role', style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text(j.description!, style: const TextStyle(height: 1.4)),
            ],
            if (j.skills.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Required skills', style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: j.skills.map(_tag).toList()),
            ],
            if (j.benefits.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Benefits', style: TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              ...j.benefits.map((b) => Padding(padding: const EdgeInsets.only(top: 2), child: Text('• $b'))),
            ],
            const SizedBox(height: 20),
          ]),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
          child: Row(children: [
            IconButton(
              icon: Icon(widget.saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark, color: widget.saved ? AppColors.primary : null),
              onPressed: widget.onToggleSave,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46), backgroundColor: widget.applied ? AppColors.muted : AppColors.foreground),
                onPressed: widget.applied ? null : _openApply,
                child: Text(widget.applied ? '✓ Applied' : 'Apply now', style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _tag(String t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)),
    child: Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
  );
}

class _ApplyDialog extends StatefulWidget {
  const _ApplyDialog({required this.job});
  final JobPosting job;
  @override
  State<_ApplyDialog> createState() => _ApplyDialogState();
}

class _ApplyDialogState extends State<_ApplyDialog> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _cover = TextEditingController();
  final _cv = TextEditingController();
  bool _saving = false;

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to apply')));
      return;
    }
    if (_name.text.trim().isEmpty || _email.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name and email required')));
      return;
    }
    setState(() => _saving = true);
    try {
      await jobsService.applyToJob(
        jobId: widget.job.id,
        applicantId: uid,
        name: _name.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
        coverLetter: _cover.text.trim(),
        cvLink: _cv.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application submitted')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
    child: SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Apply for ${widget.job.title}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Full name *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _cv, decoration: const InputDecoration(labelText: 'CV link (URL)', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _cover, maxLines: 4, decoration: const InputDecoration(labelText: 'Cover letter', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46), backgroundColor: AppColors.foreground),
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Submitting…' : 'Submit application', style: const TextStyle(fontWeight: FontWeight.w900)),
        ),
      ]),
    ),
  );
}
