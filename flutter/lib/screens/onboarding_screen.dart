import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../navigation/root_shell.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Onboarding.tsx` — 3-step feature intro before entering the shell.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pc = PageController();
  int _page = 0;

  static const _slides = <(IconData, String, String, Color)>[
    (LucideIcons.shoppingBag, 'One app, everything', 'Shop products, book rides, order food, and rent stays — all in one place.', Color(0xFF3B82F6)),
    (LucideIcons.wallet, 'PUBSTORE Pay', 'Instant wallet, mobile-money top-ups, and secure payouts to sellers you can trust.', Color(0xFF10B981)),
    (LucideIcons.sparkles, 'Meet Tapson AI', 'Search visually, get personalised deals, and message any supplier in seconds.', Color(0xFFF59E0B)),
  ];

  void _next() {
    if (_page < _slides.length - 1) {
      _pc.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    } else {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const RootShell()));
    }
  }

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const RootShell())),
              child: const Text('Skip'),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _pc,
              onPageChanged: (i) => setState(() => _page = i),
              itemCount: _slides.length,
              itemBuilder: (_, i) {
                final s = _slides[i];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(color: s.$4.withOpacity(.12), borderRadius: BorderRadius.circular(28)),
                      child: Icon(s.$1, size: 44, color: s.$4),
                    ),
                    const SizedBox(height: 32),
                    Text(s.$2, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, height: 1.15)),
                    const SizedBox(height: 14),
                    Text(s.$3, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.muted, height: 1.4)),
                  ]),
                );
              },
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < _slides.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                height: 6,
                width: _page == i ? 24 : 6,
                decoration: BoxDecoration(color: _page == i ? AppColors.orange : AppColors.border, borderRadius: BorderRadius.circular(99)),
              ),
          ]),
          Padding(
            padding: const EdgeInsets.all(24),
            child: FilledButton(
              onPressed: _next,
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: AppColors.orange),
              child: Text(_page == _slides.length - 1 ? 'Get started' : 'Continue', style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ]),
      ),
    );
  }
}
