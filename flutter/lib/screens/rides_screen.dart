import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/palette.dart';
import '../theme/theme.dart';

/// Mirrors the entry surface of `src/pages/Rides.tsx` — vehicle class picker
/// with fare estimate.  Full live-map + realtime bidding requires native
/// mapping plugins and is scaffolded here so the flow renders identically.
class RidesScreen extends StatefulWidget {
  const RidesScreen({super.key});
  @override
  State<RidesScreen> createState() => _RidesScreenState();
}

class _RidesScreenState extends State<RidesScreen> {
  int _tab = 0; // now / schedule / share / trips
  int _vClass = 1;
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();

  static const _classes = [
    ['Moto', LucideIcons.bike, '2 min', '1 seat', 0.55],
    ['Economy', LucideIcons.car, '4 min', '4 seats', 1.0],
    ['Comfort', LucideIcons.car, '5 min', '4 seats', 1.35],
    ['XL', LucideIcons.users, '6 min', '6 seats', 1.7],
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(children: [
              GestureDetector(
                onTap: () => Navigator.of(context).maybePop(),
                child: const Icon(LucideIcons.arrowLeft, size: 22),
              ),
              const SizedBox(width: 8),
              const Text('Rides',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.mutedSurface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(LucideIcons.wallet, size: 12),
                  SizedBox(width: 4),
                  Text('\$0.00',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                ]),
              ),
            ]),
          ),
          // Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.mutedSurface,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(children: List.generate(4, (i) {
                const labels = ['Now', 'Schedule', 'Share', 'Trips'];
                final active = _tab == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _tab = i),
                    child: Container(
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: active
                            ? AppColors.foreground
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(labels[i],
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: active
                                  ? Colors.white
                                  : AppColors.foreground)),
                    ),
                  ),
                );
              })),
            ),
          ),
          // Faux map
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            height: 220,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.md),
              gradient: const LinearGradient(
                colors: [Color(0xFFE0F2FE), Color(0xFFDCFCE7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            alignment: Alignment.center,
            child: const Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.mapPin, size: 32, color: AppColors.primary),
              SizedBox(height: 8),
              Text('Live map',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: AppColors.muted)),
              Text('drivers appear as you request a ride',
                  style: TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
          ),
          // Pickup / dropoff
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              TextField(
                controller: _pickup,
                decoration: InputDecoration(
                  hintText: 'Pickup',
                  prefixIcon: const Icon(LucideIcons.mapPin,
                      size: 16, color: AppColors.primary),
                  filled: true,
                  fillColor: AppColors.input,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _dropoff,
                decoration: InputDecoration(
                  hintText: 'Where to?',
                  prefixIcon: const Icon(LucideIcons.navigation,
                      size: 16, color: AppColors.orange),
                  filled: true,
                  fillColor: AppColors.input,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: BorderSide.none),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _classes.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final c = _classes[i];
                final active = _vClass == i;
                return GestureDetector(
                  onTap: () => setState(() => _vClass = i),
                  child: Container(
                    width: 120,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: active
                          ? AppColors.foreground
                          : AppColors.mutedSurface,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(c[1] as IconData,
                            size: 18,
                            color: active ? Colors.white : AppColors.foreground),
                        const Spacer(),
                        Text(c[0] as String,
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: active
                                    ? Colors.white
                                    : AppColors.foreground)),
                        Text('${c[2]} · ${c[3]}',
                            style: TextStyle(
                                fontSize: 10,
                                color: active
                                    ? Colors.white70
                                    : AppColors.muted)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: AppColors.foreground,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Ride matching — realtime edition next'))),
                icon: const Icon(LucideIcons.zap, size: 16),
                label: const Text('Request ride'),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
