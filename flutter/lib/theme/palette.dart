import 'package:flutter/material.dart';

/// Semantic color tokens mirroring `src/index.css` (Cloud-White palette).
///
/// Hex values are HSL → hex conversions of the CSS custom properties used by
/// the web build, so every screen renders with the same palette across web,
/// React Native, and Flutter.
class AppColors {
  const AppColors._();

  static const Color background = Color(0xFFFFFFFF);
  static const Color foreground = Color(0xFF0F172A);
  static const Color muted = Color(0xFF64748B);
  static const Color mutedSurface = Color(0xFFF1F5F9);
  static const Color border = Color(0xFFE2E8F0);

  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color accent = Color(0xFF0EA5E9);

  static const Color ridesMint = Color(0xFF10B981);
  static const Color ridesCta = Color(0xFF0F172A);

  static const Color danger = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color success = Color(0xFF22C55E);

  // Card price accent (matches the marketplace cards on web).
  static const Color priceRed = Color(0xFFDC2626);
}
