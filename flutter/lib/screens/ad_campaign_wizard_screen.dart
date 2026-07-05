import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/ads/AdCampaignWizard.tsx` — 4-step wizard:
/// product → placement → creative → budget & targeting.
class AdCampaignWizardScreen extends StatefulWidget {
  const AdCampaignWizardScreen({super.key});
  @override
  State<AdCampaignWizardScreen> createState() => _AdCampaignWizardScreenState();
}

class _Placement {
  const _Placement(this.id, this.label, this.icon, this.hint, this.defaultMode, this.minBudget);
  final String id;
  final String label;
  final IconData icon;
  final String hint;
  final String defaultMode; // 'cpc' | 'flat_boost'
  final double minBudget;
}

const _placements = <_Placement>[
  _Placement('banner', 'Sticky banner', LucideIcons.eye, 'Bottom of every page · CPC auction', 'cpc', 5),
  _Placement('inline', 'Feed card', LucideIcons.image, 'Sponsored card inside Home / For You', 'flat_boost', 1),
  _Placement('interstitial', 'Full-screen', LucideIcons.tv, 'Once per session · skippable', 'cpc', 10),
  _Placement('rewarded', 'Rewarded reel', LucideIcons.gift, 'Users earn loyalty points · 15s', 'flat_boost', 3),
];

class _AdCampaignWizardScreenState extends State<AdCampaignWizardScreen> {
  int _step = 0;
  Map<String, dynamic>? _supplier;
  List<Map<String, dynamic>> _products = const [];
  String? _productId;
  String _placement = 'inline';
  String _pricingMode = 'flat_boost';
  double _dailyBudget = 5;
  double _maxBid = 0.25;
  final _headline = TextEditingController();
  final _tagline = TextEditingController();
  final _cta = TextEditingController(text: 'Shop now');
  final _categories = TextEditingController();
  final _countries = TextEditingController();
  final _interests = TextEditingController();
  bool _submitting = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final s = await supabase.from('suppliers').select('id,name').eq('owner_id', uid).limit(1).maybeSingle();
      _supplier = s == null ? null : Map<String, dynamic>.from(s);
      if (_supplier != null) {
        final prods = await supabase
            .from('products')
            .select('id,title,price,image,description')
            .eq('supplier_id', _supplier!['id'])
            .limit(100);
        _products = (prods as List).map((p) => Map<String, dynamic>.from(p as Map)).toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Map<String, dynamic>? get _product => _products.firstWhere((p) => p['id'] == _productId, orElse: () => <String, dynamic>{});

  void _onProduct(String id) {
    setState(() {
      _productId = id;
      final p = _products.firstWhere((x) => x['id'] == id, orElse: () => <String, dynamic>{});
      if (_headline.text.isEmpty) {
        final t = (p['title'] ?? '') as String;
        _headline.text = t.length > 60 ? t.substring(0, 60) : t;
      }
      if (_tagline.text.isEmpty) {
        final d = (p['description'] ?? '') as String;
        _tagline.text = d.length > 100 ? d.substring(0, 100) : d;
      }
    });
  }

  void _onPlacementChange(_Placement p) {
    setState(() {
      _placement = p.id;
      _pricingMode = p.defaultMode;
      _dailyBudget = p.minBudget;
    });
  }

  Future<void> _submit() async {
    if (_supplier == null) { _snack('Create your store first'); return; }
    if (_productId == null) { _snack('Pick a product'); return; }
    if (_headline.text.trim().isEmpty) { _snack('Add a headline'); return; }
    setState(() => _submitting = true);
    try {
      final uid = supabase.auth.currentUser?.id;
      final p = _product ?? const {};
      final image = p['image'];
      final targeting = {
        'categories': _splitCsv(_categories.text),
        'countries': _splitCsv(_countries.text).map((s) => s.toUpperCase()).toList(),
        'interests': _splitCsv(_interests.text),
      };
      await supabase.from('ad_campaigns').insert({
        'owner_id': uid,
        'supplier_id': _supplier!['id'],
        'product_id': _productId,
        'name': _headline.text.trim().substring(0, _headline.text.length > 80 ? 80 : _headline.text.length),
        'placement': _placement,
        'pricing_mode': _pricingMode,
        'daily_budget': _dailyBudget,
        'max_bid_cpc': _pricingMode == 'cpc' ? _maxBid : 0,
        'creative': {
          'headline': _headline.text.trim(),
          'tagline': _tagline.text.trim(),
          'image': image,
          'cta': _cta.text.trim().isEmpty ? 'Shop now' : _cta.text.trim(),
        },
        'targeting': targeting,
        'status': 'active',
      });
      if (mounted) {
        _snack('Campaign launched 🚀');
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  List<String> _splitCsv(String s) => s.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

  void _snack(String s) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s)));
  }

  bool get _canContinue {
    if (_step == 0) return _productId != null;
    return true;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(appBar: AppBar(title: const Text('New campaign')), body: Skeletons.list(count: 4));
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('New ad campaign', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          Text('Step ${_step + 1} of 4', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(4),
          child: LinearProgressIndicator(
            value: (_step + 1) / 4,
            minHeight: 4,
            backgroundColor: AppColors.mutedSurface,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(children: [
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _stepBody(),
          )),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              if (_step > 0) ...[
                Expanded(child: OutlinedButton(
                  onPressed: _submitting ? null : () => setState(() => _step--),
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  child: const Text('Back'),
                )),
                const SizedBox(width: 10),
              ],
              Expanded(child: FilledButton(
                onPressed: _submitting || !_canContinue ? null : () {
                  if (_step < 3) {
                    setState(() => _step++);
                  } else {
                    _submit();
                  }
                },
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.orange),
                child: Text(_step < 3 ? 'Continue' : (_submitting ? 'Launching…' : 'Launch campaign'),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              )),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _stepBody() {
    switch (_step) {
      case 0: return _stepProduct();
      case 1: return _stepPlacement();
      case 2: return _stepCreative();
      default: return _stepBudget();
    }
  }

  Widget _stepProduct() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('1. Pick a product', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (_products.isEmpty)
          const Text('You have no products yet. Add one first.', style: TextStyle(color: AppColors.muted, fontSize: 13))
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 0.75),
            itemCount: _products.length,
            itemBuilder: (_, i) {
              final p = _products[i];
              final selected = p['id'] == _productId;
              return InkWell(
                onTap: () => _onProduct(p['id']),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 2 : 1),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    AspectRatio(aspectRatio: 1,
                      child: p['image'] != null && (p['image'] as String).isNotEmpty
                          ? Image.network(p['image'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.mutedSurface))
                          : const ColoredBox(color: AppColors.mutedSurface)),
                    Padding(padding: const EdgeInsets.all(8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${p['title']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, height: 1.15)),
                      Text('\$${((p['price'] ?? 0) as num).toStringAsFixed(2)}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                    ])),
                  ]),
                ),
              );
            },
          ),
      ]);

  Widget _stepPlacement() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('2. Where to show', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        for (final p in _placements) Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: InkWell(
            onTap: () => _onPlacementChange(p),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _placement == p.id ? AppColors.primary : AppColors.border, width: _placement == p.id ? 2 : 1),
              ),
              child: Row(children: [
                Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                    child: Icon(p.icon, color: AppColors.primary, size: 18)),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                  Text(p.hint, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ])),
                const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.muted),
              ]),
            ),
          ),
        ),
      ]);

  Widget _stepCreative() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('3. Creative', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800))),
          OutlinedButton.icon(
            onPressed: _product == null ? null : () {
              final p = _product!;
              _headline.text = ((p['title'] ?? '') as String).substring(0, ((p['title'] ?? '') as String).length > 60 ? 60 : ((p['title'] ?? '') as String).length);
              _tagline.text = "Don't miss out — ${p['title']} from \$${((p['price'] ?? 0) as num).toStringAsFixed(2)}";
              _cta.text = 'Shop now';
              setState(() {});
            },
            icon: const Icon(LucideIcons.sparkles, size: 14),
            label: const Text('Prefill', style: TextStyle(fontSize: 12)),
          ),
        ]),
        const SizedBox(height: 10),
        _labeledInput('Headline (${_headline.text.length}/60)', _headline, maxLength: 60, hint: 'Punchy hook'),
        _labeledInput('Tagline (${_tagline.text.length}/120)', _tagline, maxLength: 120, hint: 'What the buyer gets'),
        _labeledInput('CTA', _cta, maxLength: 20, hint: 'Shop now'),
        if (_product != null) Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 56, height: 56,
                child: _product!['image'] == null || (_product!['image'] as String).isEmpty
                    ? const ColoredBox(color: AppColors.mutedSurface)
                    : Image.network(_product!['image'], fit: BoxFit.cover))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Preview', style: TextStyle(fontWeight: FontWeight.w800)),
                Text(_headline.text.isEmpty ? '—' : _headline.text, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                Text(_tagline.text.isEmpty ? '—' : _tagline.text, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
              ])),
            ]),
          ),
        ),
      ]);

  Widget _stepBudget() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('4. Budget & targeting', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
          child: Column(children: [
            Row(children: [
              Expanded(child: _modeBtn('Flat boost', 'flat_boost')),
              const SizedBox(width: 8),
              Expanded(child: _modeBtn('CPC auction', 'cpc')),
            ]),
            const SizedBox(height: 12),
            _numericField('Daily budget (\$)', _dailyBudget, (v) => setState(() => _dailyBudget = v), 'Charged from your wallet. Auto-pauses when exhausted.'),
            if (_pricingMode == 'cpc') Padding(
              padding: const EdgeInsets.only(top: 10),
              child: _numericField('Max bid per click (\$)', _maxBid, (v) => setState(() => _maxBid = v), 'Highest bidder wins the slot.'),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('TARGETING (OPTIONAL)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1)),
            const SizedBox(height: 8),
            _labeledInput('Categories', _categories, hint: 'electronics, fashion'),
            _labeledInput('Countries (ISO code)', _countries, hint: 'US, NG, ZA'),
            _labeledInput('Interests', _interests, hint: 'sneakers, gadgets'),
            const Text('Leave blank to target everyone.', style: TextStyle(fontSize: 10, color: AppColors.muted)),
          ]),
        ),
      ]);

  Widget _labeledInput(String label, TextEditingController c, {String? hint, int? maxLength}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted)),
          const SizedBox(height: 4),
          TextField(
            controller: c,
            maxLength: maxLength,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(hintText: hint, border: const OutlineInputBorder(), isDense: true, counterText: ''),
          ),
        ]),
      );

  Widget _modeBtn(String label, String mode) {
    final on = _pricingMode == mode;
    return InkWell(
      onTap: () => setState(() => _pricingMode = mode),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: on ? AppColors.primary : AppColors.card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: on ? AppColors.primary : AppColors.border),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: on ? Colors.white : AppColors.foreground)),
      ),
    );
  }

  Widget _numericField(String label, double value, ValueChanged<double> onChanged, String hint) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted)),
          const SizedBox(height: 4),
          TextFormField(
            initialValue: value.toString(),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, prefixText: '\$ '),
            onChanged: (v) => onChanged(double.tryParse(v) ?? value),
          ),
          const SizedBox(height: 4),
          Text(hint, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ],
      );
}
