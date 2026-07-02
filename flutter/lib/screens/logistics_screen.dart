import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/jobs_models.dart';
import '../services/logistics_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Mirrors `src/pages/Logistics.tsx` — driver/courier marketplace with
/// Browse / Request / My deliveries / Couriers tabs.
class LogisticsScreen extends StatefulWidget {
  const LogisticsScreen({super.key});
  @override
  State<LogisticsScreen> createState() => _LogisticsScreenState();
}

class _LogisticsScreenState extends State<LogisticsScreen> {
  int _tab = 0;
  bool _loading = true;
  List<LogisticsRequest> _requests = const [];
  String? _userId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _userId = supabase.auth.currentUser?.id;
    final list = _tab == 2 && _userId != null
        ? await logisticsService.fetchMine(_userId!)
        : await logisticsService.fetchOpen();
    if (!mounted) return;
    setState(() { _requests = list; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(children: [
        Container(
          width: double.infinity,
          padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 12,
              left: 16, right: 16, bottom: 12),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFEA580C), Color(0xFFDC2626), Color(0xFFE11D48)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(children: [
            Row(children: [
              GestureDetector(
                onTap: () => Navigator.of(context).maybePop(),
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(999)),
                  child: const Icon(LucideIcons.arrowLeft,
                      color: Colors.white, size: 18),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(14)),
                child: const Icon(LucideIcons.truck, color: Colors.white),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Logistics & delivery',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    Text('Couriers, freight & supplier delivery partners.',
                        style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(children: List.generate(4, (i) {
                const labels = ['Open jobs', 'Request', 'Mine', 'Couriers'];
                final active = _tab == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () { setState(() => _tab = i); _load(); },
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
              })),
            ),
          ]),
        ),
        Expanded(
          child: _tab == 1
              ? _RequestForm(onPosted: () { setState(() => _tab = 2); _load(); })
              : _tab == 3
                  ? const Center(
                      child: Text('Courier directory — coming soon',
                          style: TextStyle(color: AppColors.muted)))
                  : _loading
                      ? const Center(child: CircularProgressIndicator())
                      : _requests.isEmpty
                          ? const Center(
                              child: Text('No active requests',
                                  style: TextStyle(color: AppColors.muted)))
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _requests.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (_, i) =>
                                  _RequestCard(req: _requests[i]),
                            ),
        ),
      ]),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.req});
  final LogisticsRequest req;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(LucideIcons.package, size: 16, color: AppColors.orange),
          const SizedBox(width: 8),
          Expanded(
            child: Text(req.title,
                style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.mutedSurface,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(req.vehicleType.toUpperCase(),
                style: const TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w800)),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          const Icon(LucideIcons.mapPin, size: 12, color: AppColors.muted),
          const SizedBox(width: 4),
          Expanded(
            child: Text('${req.pickupCity} → ${req.dropoffCity}',
                style: const TextStyle(fontSize: 12)),
          ),
        ]),
        if (req.budget != null) ...[
          const SizedBox(height: 6),
          Text('Budget: ${req.currency} ${req.budget!.toStringAsFixed(0)}',
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary)),
        ],
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
                backgroundColor: AppColors.foreground,
                foregroundColor: Colors.white),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Place bid — coming soon'))),
            icon: const Icon(LucideIcons.send, size: 14),
            label: const Text('Place bid'),
          ),
        ),
      ]),
    );
  }
}

class _RequestForm extends StatefulWidget {
  const _RequestForm({required this.onPosted});
  final VoidCallback onPosted;
  @override
  State<_RequestForm> createState() => _RequestFormState();
}

class _RequestFormState extends State<_RequestForm> {
  final _title = TextEditingController();
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _weight = TextEditingController();
  final _budget = TextEditingController();
  String _vehicle = 'van';
  bool _submitting = false;

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    if (_title.text.trim().isEmpty ||
        _from.text.trim().isEmpty ||
        _to.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Title, pickup and dropoff required')));
      return;
    }
    setState(() => _submitting = true);
    await logisticsService.createRequest(
      buyerId: uid,
      title: _title.text.trim(),
      vehicleType: _vehicle,
      pickupCity: _from.text.trim(),
      dropoffCity: _to.text.trim(),
      weightKg: double.tryParse(_weight.text),
      budget: double.tryParse(_budget.text),
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    widget.onPosted();
  }

  @override
  Widget build(BuildContext context) {
    InputDecoration deco(String label) => InputDecoration(
          labelText: label,
          filled: true,
          fillColor: AppColors.input,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
              borderSide: BorderSide.none),
        );
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: _title, decoration: deco('What are you shipping?')),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: TextField(controller: _from, decoration: deco('Pickup city'))),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: _to, decoration: deco('Dropoff city'))),
      ]),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(
          child: TextField(
              controller: _weight,
              keyboardType: TextInputType.number,
              decoration: deco('Weight (kg)')),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
              controller: _budget,
              keyboardType: TextInputType.number,
              decoration: deco('Budget')),
        ),
      ]),
      const SizedBox(height: 10),
      Wrap(spacing: 8, children: [
        for (final v in ['bike', 'car', 'van', 'truck'])
          ChoiceChip(
            label: Text(v.toUpperCase()),
            selected: _vehicle == v,
            onSelected: (_) => setState(() => _vehicle = v),
          ),
      ]),
      const SizedBox(height: 16),
      FilledButton.icon(
        onPressed: _submitting ? null : _submit,
        icon: const Icon(LucideIcons.send, size: 16),
        label: Text(_submitting ? 'Posting…' : 'Post delivery request'),
      ),
    ]);
  }
}
