import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/palette.dart';
import '../theme/theme.dart';
import 'admin_screen.dart';
import 'ads_dashboard_screen.dart';
import 'agro_screen.dart';
import 'auto_screen.dart';
import 'car_rentals_screen.dart';
import 'driver_screen.dart';
import 'finance_screen.dart';
import 'industrial_screen.dart';
import 'jobs_network_screen.dart';
import 'jobs_profile_screen.dart';
import 'jobs_screen.dart';
import 'live_screen.dart';
import 'logistics_screen.dart';
import 'my_store_screen.dart';
import 'news_screen.dart';
import 'notifications_screen.dart';
import 'orders_screen.dart';
import 'properties_screen.dart';
import 'restaurants_screen.dart';
import 'rfq_screen.dart';
import 'rides_screen.dart';
import 'search_screen.dart';
import 'services_screen.dart';
import 'settings_screen.dart';
import 'stays_screen.dart';
import 'wallet_screen.dart';
import 'wishlist_screen.dart';

/// Explore hub — mirrors the department drawer in `src/pages/Home.tsx`.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final depts = <_Dept>[
      _Dept('Market', LucideIcons.store, const Color(0xFF3B82F6),
          (c) => const MyStoreScreen()),
      _Dept('Jobs', LucideIcons.briefcase, const Color(0xFF4F46E5),
          (c) => const JobsScreen()),
      _Dept('Rides', LucideIcons.navigation, const Color(0xFF10B981),
          (c) => const RidesScreen()),
      _Dept('Services', LucideIcons.wrench, const Color(0xFF8B5CF6),
          (c) => const ServicesScreen()),
      _Dept('Property', LucideIcons.home, const Color(0xFF0284C7),
          (c) => const PropertiesScreen()),
      _Dept('Delivery', LucideIcons.truck, const Color(0xFFF97316),
          (c) => const LogisticsScreen()),
      _Dept('Finance', LucideIcons.banknote, const Color(0xFF059669),
          (c) => const FinanceScreen()),
      _Dept('News', LucideIcons.newspaper, const Color(0xFFEC4899),
          (c) => const NewsScreen()),
      _Dept('Stays', LucideIcons.bedDouble, const Color(0xFFF59E0B),
          (c) => const StaysScreen()),
      _Dept('Auto', LucideIcons.car, const Color(0xFF18181B),
          (c) => const AutoScreen()),
      _Dept('Industrial', LucideIcons.factory, const Color(0xFF0369A1),
          (c) => const IndustrialScreen()),
      _Dept('Agro', LucideIcons.sprout, const Color(0xFF16A34A),
          (c) => const AgroScreen()),
      _Dept('Food', LucideIcons.utensils, const Color(0xFFDC2626),
          (c) => const RestaurantsScreen()),
      _Dept('Rentals', LucideIcons.keyRound, const Color(0xFF7C3AED),
          (c) => const CarRentalsScreen()),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.search),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _SectionLabel('Directory'),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.85,
            ),
            itemCount: depts.length,
            itemBuilder: (context, i) {
              final d = depts[i];
              return InkWell(
                borderRadius: BorderRadius.circular(AppRadii.md),
                onTap: () {
                  if (d.build != null) {
                    Navigator.of(context).push(
                        MaterialPageRoute(builder: d.build!));
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('${d.label} — coming soon')));
                  }
                },
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: d.color,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(d.icon, color: Colors.white, size: 22),
                    ),
                    const SizedBox(height: 6),
                    Text(d.label,
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700)),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 24),
          const _SectionLabel('Quick actions'),
          const SizedBox(height: 8),
          _QuickRow(
              icon: LucideIcons.package,
              label: 'Track orders',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const OrdersScreen()))),
          _QuickRow(
              icon: LucideIcons.heart,
              label: 'Wishlist',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const WishlistScreen()))),
          _QuickRow(
              icon: LucideIcons.bell,
              label: 'Notifications',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const NotificationsScreen()))),
          _QuickRow(
              icon: LucideIcons.wallet,
              label: 'PUBSTORE Pay',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const WalletScreen()))),
          _QuickRow(
              icon: LucideIcons.fileText,
              label: 'Request for quote',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const RfqScreen()))),
          _QuickRow(
              icon: LucideIcons.video,
              label: 'Live now',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const LiveScreen()))),
          _QuickRow(
              icon: LucideIcons.userSquare,
              label: 'Career profile',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const JobsProfileScreen()))),
          _QuickRow(
              icon: LucideIcons.users,
              label: 'My network',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const JobsNetworkScreen()))),
          _QuickRow(
              icon: LucideIcons.megaphone,
              label: 'Ads dashboard',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const AdsDashboardScreen()))),
          _QuickRow(
              icon: LucideIcons.car,
              label: 'Driver hub',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const DriverScreen()))),
          _QuickRow(
              icon: LucideIcons.shield,
              label: 'Admin console',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const AdminScreen()))),
          _QuickRow(
              icon: LucideIcons.fileText,
              label: 'Terms of service',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const TermsScreen()))),
          _QuickRow(
              icon: LucideIcons.settings,
              label: 'Settings',
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const SettingsScreen()))),
        ],
      ),
    );
  }
}

class _Dept {
  const _Dept(this.label, this.icon, this.color, this.build);
  final String label;
  final IconData icon;
  final Color color;
  final WidgetBuilder? build;
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.4,
            color: AppColors.muted),
      );
}

class _QuickRow extends StatelessWidget {
  const _QuickRow(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Row(children: [
          Icon(icon, size: 18, color: AppColors.foreground),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(fontWeight: FontWeight.w700))),
          const Icon(LucideIcons.chevronRight,
              size: 16, color: AppColors.muted),
        ]),
      ),
    );
  }
}
