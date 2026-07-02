import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../theme/palette.dart';
import 'addresses_screen.dart';
import 'auth_screen.dart';
import 'cart_screen.dart';
import 'help_center_screen.dart';
import 'messages_screen.dart';
import 'my_store_screen.dart';
import 'notifications_screen.dart';
import 'orders_screen.dart';
import 'payment_methods_screen.dart';
import 'privacy_screen.dart';
import 'settings_screen.dart';
import 'verification_screen.dart';
import 'wallet_screen.dart';
import 'wishlist_screen.dart';

/// Profile tab — mirrors `src/pages/Account.tsx`. Signed-out users see a
/// sign-in CTA; signed-in users see their profile summary + shortcuts to
/// orders, cart, wishlist, and settings.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile',
            style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: user == null
          ? _SignedOut()
          : profileAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => _SignedIn(
                user: user,
                profile: const {},
              ),
              data: (profile) => _SignedIn(user: user, profile: profile ?? const {}),
            ),
    );
  }
}

class _SignedOut extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: AppColors.mutedSurface,
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.user,
                  size: 40, color: AppColors.muted),
            ),
            const SizedBox(height: 16),
            const Text('Sign in to PUBSTORE',
                style:
                    TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            const SizedBox(height: 4),
            const Text(
              'Save orders, message suppliers, and sync your cart across devices.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AuthScreen()),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.foreground,
                  foregroundColor: AppColors.background,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Sign in'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignedIn extends ConsumerWidget {
  const _SignedIn({required this.user, required this.profile});
  final dynamic user;
  final Map<String, dynamic> profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayName = (profile['display_name'] as String?) ??
        (profile['username'] as String?) ??
        (user.email as String? ?? 'Buyer');
    final avatar = profile['avatar_url'] as String?;
    final tier = profile['buyer_tier'] as String? ?? 'standard';
    final points = (profile['buyer_points'] as num?)?.toInt() ?? 0;

    return ListView(
      padding: const EdgeInsets.only(top: 8, bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: AppColors.mutedSurface,
                backgroundImage: avatar != null
                    ? CachedNetworkImageProvider(avatar)
                    : null,
                child: avatar == null
                    ? const Icon(LucideIcons.user,
                        color: AppColors.muted, size: 28)
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 17)),
                    const SizedBox(height: 2),
                    Text(user.email as String? ?? '',
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 6),
                    Row(children: [
                      _Chip(
                        label: tier.toUpperCase(),
                        color: AppColors.foreground,
                      ),
                      const SizedBox(width: 6),
                      _Chip(
                        label: '$points pts',
                        color: AppColors.primary,
                      ),
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1, color: AppColors.border),
        _Row(
          icon: LucideIcons.shoppingCart,
          label: 'Cart',
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CartScreen()),
          ),
        ),
        _Row(
          icon: LucideIcons.package,
          label: 'Orders',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const OrdersScreen())),
        ),
        _Row(
          icon: LucideIcons.heart,
          label: 'Wishlist',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WishlistScreen())),
        ),
        _Row(
          icon: LucideIcons.messageCircle,
          label: 'Messages',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MessagesScreen())),
        ),
        _Row(
          icon: LucideIcons.bell,
          label: 'Notifications',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const NotificationsScreen())),
        ),
        _Row(
          icon: LucideIcons.wallet,
          label: 'PUBSTORE Pay',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WalletScreen())),
        ),
        _Row(
          icon: LucideIcons.store,
          label: 'My store',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MyStoreScreen())),
        ),
        _Row(
          icon: LucideIcons.mapPin,
          label: 'Addresses',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AddressesScreen())),
        ),
        _Row(
          icon: LucideIcons.creditCard,
          label: 'Payment methods',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const PaymentMethodsScreen())),
        ),
        _Row(
          icon: LucideIcons.badgeCheck,
          label: 'Identity verification',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const VerificationScreen())),
        ),
        _Row(
          icon: LucideIcons.helpCircle,
          label: 'Help center',
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const HelpCenterScreen())),
        ),
        _Row(
          icon: LucideIcons.shield,
          label: 'Privacy',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PrivacyScreen())),
        ),
        _Row(
          icon: LucideIcons.settings,
          label: 'Settings',
          onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen())),
        ),
        const Divider(height: 1, color: AppColors.border),
        _Row(
          icon: LucideIcons.logOut,
          label: 'Sign out',
          destructive: true,
          onTap: () async {
            await authService.signOut();
            ref.invalidate(profileProvider);
          },
        ),
      ],
    );
  }

  void _todo(BuildContext context, String label) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label — coming in the next slice.')),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label,
          style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3)),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.danger : AppColors.foreground;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: color)),
            ),
            if (!destructive)
              const Icon(LucideIcons.chevronRight,
                  size: 16, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}
