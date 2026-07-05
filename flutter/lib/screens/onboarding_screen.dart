import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Onboarding.tsx` — role → username → verticals → interests → address.
/// Guests get a shorter flow (verticals → interests) that saves to prefs on device.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Vertical {
  const _Vertical(this.slug, this.label, this.hint, this.icon, this.forSupplier);
  final String slug;
  final String label;
  final String hint;
  final IconData icon;
  final bool forSupplier;
}

const _verticals = <_Vertical>[
  _Vertical('shop', 'Marketplace', 'Products, deals, suppliers', LucideIcons.shoppingBag, true),
  _Vertical('restaurants', 'Food & dining', 'Restaurants, menus, delivery', LucideIcons.utensils, true),
  _Vertical('agro', 'Agro', 'Produce, machinery, livestock', LucideIcons.sprout, true),
  _Vertical('stays', 'Stays', 'Hotels, B&Bs, factory tours', Icons.hotel_outlined, true),
  _Vertical('vehicles', 'Vehicles', 'Cars, EVs, trucks, bikes', LucideIcons.car, true),
  _Vertical('car_rentals', 'Car rentals', 'Self-drive rentals', LucideIcons.car, true),
  _Vertical('properties', 'Real estate', 'Rent or sell apartments, land', Icons.apartment, true),
  _Vertical('services', 'Local services', 'Plumbing, tutoring, freelance', LucideIcons.wrench, true),
  _Vertical('industrial', 'Industrial', 'Machinery, materials, capacity', LucideIcons.factory, true),
  _Vertical('finance', 'Finance', 'Loans, insurance, financing', Icons.account_balance_outlined, true),
  _Vertical('rides', 'Rides', 'Book or drive passengers', LucideIcons.navigation, true),
  _Vertical('jobs', 'Jobs', 'Listings, applications, network', LucideIcons.briefcase, true),
  _Vertical('news', 'News', 'Editorial & community stories', LucideIcons.newspaper, false),
  _Vertical('live', 'Live streams', 'Shoppable live broadcasts', LucideIcons.radio, false),
];

const _interests = <String>[
  'Fashion', 'Electronics', 'Beauty', 'Home', 'Sports', 'Books',
  'Toys', 'Groceries', 'Art', 'Handmade', 'Jewelry', 'Footwear',
  'Health', 'Pets', 'Auto', 'Garden',
];

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  bool _authChecked = false;
  String? _userId;
  int _step = 0;
  bool _submitting = false;

  String? _role; // 'buyer' | 'supplier'
  final _usernameCtl = TextEditingController();
  final _addressCtl = TextEditingController();
  final _contactCtl = TextEditingController();
  final Set<String> _selVerticals = {};
  final Set<String> _selInterests = {};

  Timer? _debounce;
  bool _checking = false;
  bool? _usernameAvailable;
  String? _usernameError;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = supabase.auth.currentSession;
    _userId = session?.user.id;
    if (_userId != null) {
      final prof = await supabase
          .from('profiles')
          .select('profile_completed, interests, verticals')
          .eq('user_id', _userId!)
          .maybeSingle();
      if (!mounted) return;
      if (prof?['profile_completed'] == true) {
        Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
        return;
      }
      final ints = (prof?['interests'] as List?)?.cast<String>() ?? const [];
      final verts = (prof?['verticals'] as List?)?.cast<String>() ?? const [];
      _selInterests.addAll(ints);
      _selVerticals.addAll(verts);
    }
    if (mounted) setState(() => _authChecked = true);
  }

  bool get _guest => _userId == null;
  int get _totalSteps => _guest ? 2 : 5;

  bool _validUsername(String s) => RegExp(r'^[a-z0-9_.]{3,20}$').hasMatch(s);

  void _onUsernameChanged(String v) {
    _usernameCtl.value = _usernameCtl.value.copyWith(text: v.toLowerCase(), selection: TextSelection.collapsed(offset: v.length));
    setState(() {
      _usernameAvailable = null;
      _usernameError = null;
    });
    _debounce?.cancel();
    if (v.isEmpty) return;
    if (!_validUsername(v)) {
      setState(() => _usernameError = '3–20 chars · lowercase, numbers, _ or .');
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () async {
      if (!mounted) return;
      setState(() => _checking = true);
      final row = await supabase.from('profiles').select('username').eq('username', v).maybeSingle();
      if (!mounted) return;
      setState(() {
        _checking = false;
        _usernameAvailable = row == null;
      });
    });
  }

  bool get _canNext {
    if (_guest) {
      if (_step == 0) return _selVerticals.isNotEmpty;
      if (_step == 1) return _selInterests.isNotEmpty;
      return false;
    }
    if (_step == 0) return _role != null;
    if (_step == 1) return _usernameAvailable == true && !_checking && _usernameError == null;
    if (_step == 2) return _selVerticals.isNotEmpty;
    if (_step == 3) return _selInterests.isNotEmpty;
    if (_step == 4) {
      return _addressCtl.text.trim().length >= 5 &&
          _contactCtl.text.trim().length >= 7 &&
          RegExp(r'^[+0-9 ()\-]+$').hasMatch(_contactCtl.text.trim());
    }
    return false;
  }

  Future<void> _finish() async {
    if (_guest) {
      // Guests have no local storage wired yet — just proceed to /home.
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
      return;
    }
    if (_userId == null || _role == null) return;
    setState(() => _submitting = true);
    try {
      final update = {
        'username': _usernameCtl.text.trim(),
        'address': _addressCtl.text.trim(),
        'contact': _contactCtl.text.trim(),
        'interests': _selInterests.toList(),
        'verticals': _selVerticals.toList(),
        'profile_completed': true,
      };
      await supabase.from('profiles').update(update).eq('user_id', _userId!);
      await supabase.from('user_roles').delete().eq('user_id', _userId!);
      await supabase.from('user_roles').insert({'user_id': _userId!, 'role': _role});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile created 🎉')));
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save profile: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (_step < _totalSteps - 1) {
      setState(() => _step += 1);
    } else {
      _finish();
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step -= 1);
    } else {
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    }
  }

  @override
  void dispose() {
    _usernameCtl.dispose();
    _addressCtl.dispose();
    _contactCtl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_authChecked) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              IconButton(onPressed: _back, icon: const Icon(LucideIcons.arrowLeft, size: 20)),
              const Text('PUBSTORE', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
              Text('${_step + 1}/$_totalSteps', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: (_step + 1) / _totalSteps,
                minHeight: 4,
                backgroundColor: AppColors.mutedSurface,
                color: AppColors.foreground,
              ),
            ),
            const SizedBox(height: 24),
            Expanded(child: SingleChildScrollView(child: _buildStep())),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: (_canNext && !_submitting) ? _next : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.primaryForeground,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_step == _totalSteps - 1 ? (_guest ? 'Start exploring' : 'Finish') : 'Continue',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildStep() {
    if (_guest) {
      return _step == 0 ? _stepVerticals() : _stepInterests();
    }
    switch (_step) {
      case 0: return _stepRole();
      case 1: return _stepUsername();
      case 2: return _stepVerticals();
      case 3: return _stepInterests();
      case 4: return _stepAddress();
      default: return const SizedBox();
    }
  }

  Widget _stepRole() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Welcome 👋', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text('How will you use PUBSTORE?', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 20),
        _roleCard('buyer', LucideIcons.shoppingBag, "I'm a Buyer", 'Discover and shop unique products from creators.'),
        const SizedBox(height: 10),
        _roleCard('supplier', LucideIcons.store, "I'm a Supplier", 'Sell your products and grow your store.'),
      ]);

  Widget _roleCard(String value, IconData icon, String title, String desc) {
    final active = _role == value;
    return InkWell(
      onTap: () => setState(() => _role = value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: active ? AppColors.foreground : AppColors.border),
          color: active ? AppColors.foreground.withOpacity(.04) : null,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: active ? AppColors.foreground : AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: active ? AppColors.background : AppColors.foreground, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(desc, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          ])),
        ]),
      ),
    );
  }

  Widget _stepUsername() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Pick a username', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text('This is how people will find you.', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 20),
        TextField(
          controller: _usernameCtl,
          onChanged: _onUsernameChanged,
          maxLength: 20,
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[a-z0-9_.]'))],
          decoration: InputDecoration(
            prefixText: '@',
            hintText: 'yourname',
            counterText: '',
            filled: true,
            fillColor: AppColors.input,
            suffixIcon: _checking
                ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
                : _usernameAvailable == true
                    ? const Icon(Icons.check, color: AppColors.primary)
                    : _usernameAvailable == false
                        ? const Icon(Icons.close, color: AppColors.danger)
                        : null,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _usernameError ??
              (_usernameAvailable == false ? 'Username already taken' :
               _usernameAvailable == true ? '@${_usernameCtl.text} is available' :
               '3–20 chars · lowercase, numbers, _ or .'),
          style: TextStyle(fontSize: 11, color: _usernameError != null || _usernameAvailable == false ? AppColors.danger : _usernameAvailable == true ? AppColors.primary : AppColors.muted),
        ),
      ]);

  Widget _stepVerticals() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_role == 'supplier' ? 'What do you provide?' : 'What are you looking for?',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(_role == 'supplier'
                ? "Pick the services your store will offer — we'll unlock just those tools in MyStore."
                : 'Pick the services you want in your feed — marketplace, food, agro, stays, jobs and more.',
            style: const TextStyle(color: AppColors.muted, fontSize: 13)),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 2.6),
          itemCount: _verticals.length,
          itemBuilder: (_, i) {
            final v = _verticals[i];
            final active = _selVerticals.contains(v.slug);
            return InkWell(
              onTap: () => setState(() => active ? _selVerticals.remove(v.slug) : _selVerticals.add(v.slug)),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  border: Border.all(color: active ? AppColors.foreground : AppColors.border),
                  color: active ? AppColors.foreground.withOpacity(.04) : null,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(children: [
                  Container(width: 34, height: 34,
                    decoration: BoxDecoration(color: active ? AppColors.foreground : AppColors.mutedSurface, borderRadius: BorderRadius.circular(8)),
                    child: Icon(v.icon, size: 16, color: active ? AppColors.background : AppColors.foreground)),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(v.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    Text(v.hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                  ])),
                ]),
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        Text('${_selVerticals.length} selected · you can change this anytime in Settings',
            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);

  Widget _stepInterests() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('What are you into?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text("Pick up to 8 — we'll fine-tune the product feed.", style: TextStyle(color: AppColors.muted, fontSize: 13)),
        const SizedBox(height: 16),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final i in _interests)
            InkWell(
              onTap: () => setState(() {
                if (_selInterests.contains(i)) {
                  _selInterests.remove(i);
                } else if (_selInterests.length < 8) {
                  _selInterests.add(i);
                }
              }),
              borderRadius: BorderRadius.circular(99),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: _selInterests.contains(i) ? AppColors.foreground : null,
                  border: Border.all(color: _selInterests.contains(i) ? AppColors.foreground : AppColors.border),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(i, style: TextStyle(fontSize: 13, color: _selInterests.contains(i) ? AppColors.background : AppColors.foreground)),
              ),
            ),
        ]),
        const SizedBox(height: 10),
        Text('${_selInterests.length}/8 selected', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);

  Widget _stepAddress() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Almost done', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        const Text('Where can we reach and ship to you?', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 20),
        const Text('ADDRESS', style: TextStyle(fontSize: 10, letterSpacing: 1.5, color: AppColors.muted, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        TextField(
          controller: _addressCtl,
          maxLines: 3,
          maxLength: 200,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Street, city, country',
            counterText: '',
            filled: true, fillColor: AppColors.input,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
        const SizedBox(height: 16),
        const Text('CONTACT NUMBER', style: TextStyle(fontSize: 10, letterSpacing: 1.5, color: AppColors.muted, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        TextField(
          controller: _contactCtl,
          keyboardType: TextInputType.phone,
          maxLength: 30,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: '+1 555 123 4567',
            counterText: '',
            filled: true, fillColor: AppColors.input,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.border)),
          ),
        ),
      ]);
}
