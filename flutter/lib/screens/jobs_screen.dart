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
    if (!mounted) return;
    setState(() {
      _jobs = jobs;
      _saved = saved;
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
                itemBuilder: (context, i) =>
                    _JobCard(job: _visible()[i], saved: _saved.contains(_visible()[i].id), onSave: _toggleSave),
              ),
            ),
        ],
      ),
    );
  }

  List<JobPosting> _visible() {
    if (_tab == 1) return _jobs.where((j) => _saved.contains(j.id)).toList();
    return _jobs;
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
  const _JobCard({required this.job, required this.saved, required this.onSave});
  final JobPosting job;
  final bool saved;
  final ValueChanged<JobPosting> onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadii.md),
        color: AppColors.card,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(job.title,
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w800)),
          ),
          IconButton(
            icon: Icon(saved ? LucideIcons.bookmarkCheck : LucideIcons.bookmark,
                size: 18,
                color: saved ? AppColors.primary : AppColors.muted),
            onPressed: () => onSave(job),
          ),
        ]),
        const SizedBox(height: 4),
        Wrap(spacing: 6, runSpacing: 6, children: [
          _pill(job.employmentType.replaceAll('_', ' ')),
          _pill(job.workplaceType.replaceAll('_', '-')),
          if (job.city != null) _pill('${job.city}${job.country != null ? ', ${job.country}' : ''}',
              icon: LucideIcons.mapPin),
        ]),
        if (job.salaryLabel != null) ...[
          const SizedBox(height: 8),
          Text(job.salaryLabel!,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary)),
        ],
        if (job.description != null && job.description!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(job.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ]),
    );
  }

  Widget _pill(String text, {IconData? icon}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.mutedSurface,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 10), const SizedBox(width: 3)],
          Text(text,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
        ]),
      );
}
