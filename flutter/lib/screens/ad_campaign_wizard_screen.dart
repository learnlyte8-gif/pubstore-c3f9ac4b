import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/ads/AdCampaignWizard.tsx` — multi-step form to create
/// an ad campaign (objective → targeting → budget → creative).
class AdCampaignWizardScreen extends StatefulWidget {
  const AdCampaignWizardScreen({super.key});
  @override
  State<AdCampaignWizardScreen> createState() => _AdCampaignWizardScreenState();
}

class _AdCampaignWizardScreenState extends State<AdCampaignWizardScreen> {
  int _step = 0;
  String _objective = 'traffic';
  String _placement = 'feed';
  final _name = TextEditingController();
  final _budget = TextEditingController(text: '5');
  final _bid = TextEditingController(text: '0.10');
  final _headline = TextEditingController();
  final _body = TextEditingController();
  bool _submitting = false;

  Future<void> _submit() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    setState(() => _submitting = true);
    try {
      await supabase.from('ad_campaigns').insert({
        'advertiser_id': uid,
        'name': _name.text.trim().isEmpty ? 'Campaign' : _name.text.trim(),
        'objective': _objective,
        'placement': _placement,
        'daily_budget': double.tryParse(_budget.text) ?? 5,
        'bid': double.tryParse(_bid.text) ?? 0.1,
        'headline': _headline.text.trim(),
        'body': _body.text.trim(),
        'status': 'draft',
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('New campaign · Step ${_step + 1}/4')),
      body: Stepper(
        currentStep: _step,
        onStepContinue: () => _step < 3 ? setState(() => _step++) : _submit(),
        onStepCancel: _step == 0 ? null : () => setState(() => _step--),
        controlsBuilder: (context, details) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(children: [
            FilledButton(
              onPressed: _submitting ? null : details.onStepContinue,
              style: FilledButton.styleFrom(backgroundColor: AppColors.orange),
              child: Text(_step < 3 ? 'Continue' : (_submitting ? 'Creating…' : 'Launch')),
            ),
            const SizedBox(width: 10),
            if (details.onStepCancel != null) TextButton(onPressed: details.onStepCancel, child: const Text('Back')),
          ]),
        ),
        steps: [
          Step(
            title: const Text('Objective'),
            isActive: _step >= 0,
            content: Column(children: [
              RadioListTile(value: 'traffic', groupValue: _objective, title: const Text('Store visits'), onChanged: (v) => setState(() => _objective = '$v')),
              RadioListTile(value: 'sales', groupValue: _objective, title: const Text('Sales'), onChanged: (v) => setState(() => _objective = '$v')),
              RadioListTile(value: 'awareness', groupValue: _objective, title: const Text('Awareness'), onChanged: (v) => setState(() => _objective = '$v')),
            ]),
          ),
          Step(
            title: const Text('Placement'),
            isActive: _step >= 1,
            content: Column(children: [
              RadioListTile(value: 'feed', groupValue: _placement, title: const Text('Home feed'), onChanged: (v) => setState(() => _placement = '$v')),
              RadioListTile(value: 'search', groupValue: _placement, title: const Text('Search results'), onChanged: (v) => setState(() => _placement = '$v')),
              RadioListTile(value: 'category', groupValue: _placement, title: const Text('Category screens'), onChanged: (v) => setState(() => _placement = '$v')),
            ]),
          ),
          Step(
            title: const Text('Budget'),
            isActive: _step >= 2,
            content: Column(children: [
              TextField(controller: _budget, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Daily budget (USD)', border: OutlineInputBorder(), prefixText: '\$ ')),
              const SizedBox(height: 12),
              TextField(controller: _bid, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max bid per click (USD)', border: OutlineInputBorder(), prefixText: '\$ ')),
            ]),
          ),
          Step(
            title: const Text('Creative'),
            isActive: _step >= 3,
            content: Column(children: [
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Campaign name', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: _headline, decoration: const InputDecoration(labelText: 'Headline (max 40)', border: OutlineInputBorder()), maxLength: 40),
              TextField(controller: _body, maxLines: 3, decoration: const InputDecoration(labelText: 'Body text', border: OutlineInputBorder()), maxLength: 140),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
                child: Row(children: const [
                  Icon(LucideIcons.info, size: 16, color: AppColors.muted),
                  SizedBox(width: 8),
                  Expanded(child: Text('Your campaign starts as a draft. Ads must be approved before they run.', style: TextStyle(fontSize: 12, color: AppColors.muted))),
                ]),
              ),
            ]),
          ),
        ],
      ),
    );
  }
}
