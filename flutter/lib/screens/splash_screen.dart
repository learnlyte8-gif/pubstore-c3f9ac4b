import 'dart:async';
import 'package:flutter/material.dart';

import '../navigation/root_shell.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Splash.tsx` — brief animated logo before the shell.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();
    Timer(const Duration(milliseconds: 1400), () {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const RootShell()));
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFE7F0FF), AppColors.background, Color(0xFFFFF2C2)],
          ),
        ),
        child: Center(
          child: FadeTransition(
            opacity: _c,
            child: ScaleTransition(
              scale: Tween(begin: 0.88, end: 1.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutBack)),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 88,
                  height: 88,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(24), boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 22, offset: Offset(0, 10))]),
                  child: Image.asset('assets/pubstore-logo.png'),
                ),
                const SizedBox(height: 20),
                const Text.rich(TextSpan(children: [
                  TextSpan(text: 'ZW', style: TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w900, fontSize: 26)),
                  TextSpan(text: 'PUBSTORE', style: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w900, fontSize: 26)),
                ])),
                const SizedBox(height: 6),
                const Text('The everything marketplace', style: TextStyle(color: AppColors.muted, fontSize: 12)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
