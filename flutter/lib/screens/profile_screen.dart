import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../services/wallet_service.dart';
import '../services/cart_service.dart';
import '../services/wishlist_service.dart';
import '../theme/palette.dart';
import 'addresses_screen.dart';
import 'auth_screen.dart';
import 'become_supplier_screen.dart';
import 'cart_screen.dart';
import 'help_center_screen.dart';
import 'messages_screen.dart';
import 'my_store_screen.dart';
import 'notification_preferences_screen.dart';
import 'notifications_screen.dart';
import 'onboarding_screen.dart';
import 'orders_screen.dart';
import 'payment_methods_screen.dart';
import 'privacy_screen.dart';
import 'settings_screen.dart';
import 'verification_screen.dart';
import 'wallet_screen.dart';
import 'wishlist_screen.dart';

/// Profile tab — 1:1 mirror of `src/pages/Account.tsx`.
///
/// Layout order (top → bottom):
///   Guest ->  centered card w/ Sparkles icon, sign-in CTA, wishlist/cart stats,
///             help & settings rows.
///   Signed in ->
///     1. Gradient hero header (primary → primary/60) with soft blurred orbs
///     2. Avatar row + role/tier chips + edit-profile pencil
///     3. PUBSTORE Pay balance banner (glassmorphism inside the hero)
///     4. Stats card overlapping the hero (Orders / Wishlist / Cart)
///     5. Tier progress card (Buyer, and Supplier when role == supplier)
///     6. MyStore gradient CTA
///     7. Grouped sections: My Orders, Account, Support
///     8. Sign-out button + version line
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  Map<String, dynamic>? _profile;
  String _email = '';
  String _role = 'buyer';
  bool _loading = true;
  bool _isGuest = false;

  // Tier info (mirrors useMyTier)
  String _buyerTier = 'bronze';
  int _buyerPoints = 0;
  String _supplierTier = 'bronze';
  int _supplierPoints = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final session = supabase.auth.currentSession;
    if (session == null) {
      setState(() {
        _isGuest = true;
        _loading = false;
      });
      return;
    }
    _email = session.user.email ?? '';

    try {
      final profileFuture = supabase
          .from('profiles')
          .select('display_name, username, avatar_url, address, contact,'
              ' buyer_tier, buyer_points, supplier_tier, supplier_points')
          .eq('user_id', session.user.id)
          .maybeSingle();
      final roleFuture = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

      final results = await Future.wait([profileFuture, roleFuture]);
      final p = results[0] as Map<String, dynamic>?;
      final r = results[1] as Map<String, dynamic>?;

      if (!mounted) return;
      setState(() {
        _profile = p;
        _role = (r?['role'] as String?) ?? 'buyer';
        _buyerTier = (p?['buyer_tier'] as String?) ?? 'bronze';
        _buyerPoints = ((p?['buyer_points'] as num?) ?? 0).toInt();
        _supplierTier = (p?['supplier_tier'] as String?) ?? 'bronze';
        _supplierPoints = ((p?['supplier_points'] as num?) ?? 0).toInt();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  String get _initials {
    final source = (_profile?['display_name'] as String?) ??
        (_profile?['username'] as String?) ??
        (_email.isNotEmpty ? _email : 'U');
    final parts = source.trim().split(RegExp(r'\s+'));
    final letters = parts.take(2).map((s) => s.isEmpty ? '' : s[0]).join();
    return letters.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.background,
      body: _isGuest ? _buildGuest(context) : _buildSignedIn(context),
    );
  }

  // ─────────────────────────────── GUEST ─────────────────────────────────
  Widget _buildGuest(BuildContext context) {
    final wishlistCount = ref.watch(wishlistProvider).length;
    final cartCount = ref.watch(cartCountProvider);
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 32, 16, 48),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 16,
                        offset: Offset(0, 4),
                      )
                    ],
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: const Icon(LucideIcons.sparkles,
                            color: AppColors.primary, size: 28),
                      ),
                      const SizedBox(height: 16),
                      const Text("You're browsing as a guest",
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      const Text(
                        'Sign in to save your wishlist across devices, place orders, message suppliers and earn rewards.',
                        textAlign: TextAlign.center,
                        style:
                            TextStyle(color: AppColors.muted, fontSize: 13),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const AuthScreen()),
                          ),
                          child: const Text('Sign in or create account'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: _GuestStatCard(
                        value: wishlistCount,
                        label: 'Wishlist',
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const WishlistScreen())),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _GuestStatCard(
                        value: cartCount,
                        label: 'Cart',
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const CartScreen())),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _GuestLink(
                  icon: LucideIcons.helpCircle,
                  label: 'Help center',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const HelpCenterScreen())),
                ),
                _GuestLink(
                  icon: LucideIcons.settings,
                  label: 'Settings',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const SettingsScreen())),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ────────────────────────────── SIGNED IN ──────────────────────────────
  Widget _buildSignedIn(BuildContext context) {
    final balance = ref.watch(walletBalanceProvider);
    final wishlistCount = ref.watch(wishlistProvider).length;
    final cartCount = ref.watch(cartCountProvider);

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // 1. Hero header (gradient + wallet banner)
        _HeroHeader(
          profile: _profile,
          email: _email,
          role: _role,
          initials: _initials,
          balance: balance,
          buyerTier: _buyerTier,
          supplierTier: _supplierTier,
        ),

        // 2. Stats card overlapping hero
        Transform.translate(
          offset: const Offset(0, -20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.border),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x22000000),
                      blurRadius: 20,
                      offset: Offset(0, 8)),
                ],
              ),
              child: IntrinsicHeight(
                child: Row(
                  children: [
                    Expanded(
                      child: _StatCell(
                        label: 'Orders',
                        value: 0,
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const OrdersScreen())),
                      ),
                    ),
                    const VerticalDivider(
                        width: 1, color: AppColors.border),
                    Expanded(
                      child: _StatCell(
                        label: 'Wishlist',
                        value: wishlistCount,
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const WishlistScreen())),
                      ),
                    ),
                    const VerticalDivider(
                        width: 1, color: AppColors.border),
                    Expanded(
                      child: _StatCell(
                        label: 'Cart',
                        value: cartCount,
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const CartScreen())),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // 3. Tier progress
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: _TierCard(
            role: _role,
            buyerTier: _buyerTier,
            buyerPoints: _buyerPoints,
            supplierTier: _supplierTier,
            supplierPoints: _supplierPoints,
          ),
        ),

        // 4. MyStore CTA
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: _MyStoreCta(
            onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const MyStoreScreen())),
          ),
        ),

        // 5. Sections
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionTitle('My Orders'),
              _SectionCard(children: [
                _Row(
                  icon: LucideIcons.package,
                  label: 'All orders',
                  hint: 'Track and manage',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const OrdersScreen())),
                ),
                _Row(
                  icon: LucideIcons.heart,
                  label: 'Wishlist',
                  hint: '$wishlistCount saved',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const WishlistScreen())),
                ),
                _Row(
                  icon: LucideIcons.messageCircle,
                  label: 'Messages',
                  hint: 'Chat with suppliers',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const MessagesScreen())),
                ),
              ]),
              const SizedBox(height: 16),
              _SectionTitle('Account'),
              _SectionCard(children: [
                _Row(
                  icon: LucideIcons.wallet,
                  label: 'PUBSTORE Pay',
                  hint: '\$${balance.toStringAsFixed(2)} available',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const WalletScreen())),
                ),
                _Row(
                  icon: LucideIcons.mapPin,
                  label: 'Addresses',
                  hint: (_profile?['address'] as String?) ?? 'Add address',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const AddressesScreen())),
                ),
                _Row(
                  icon: LucideIcons.creditCard,
                  label: 'Payment methods',
                  hint: 'Cards, wallets',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const PaymentMethodsScreen())),
                ),
                _Row(
                  icon: LucideIcons.shieldCheck,
                  label: 'Identity verification',
                  hint: 'Required for Cash on delivery',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const VerificationScreen())),
                ),
                _Row(
                  icon: LucideIcons.store,
                  label: _role == 'supplier'
                      ? 'My store'
                      : 'Become a supplier',
                  hint: 'Sell on PUBSTORE',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => _role == 'supplier'
                          ? const MyStoreScreen()
                          : const BecomeSupplierScreen(),
                    ),
                  ),
                ),
                _Row(
                  icon: LucideIcons.bellRing,
                  label: 'Notification preferences',
                  hint: 'Emails, push',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) =>
                          const NotificationPreferencesScreen())),
                ),
                _Row(
                  icon: LucideIcons.bell,
                  label: 'Notifications',
                  hint: 'Recent activity',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const NotificationsScreen())),
                ),
              ]),
              const SizedBox(height: 16),
              _SectionTitle('Support'),
              _SectionCard(children: [
                _Row(
                  icon: LucideIcons.helpCircle,
                  label: 'Help center',
                  hint: 'FAQs, contact us',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const HelpCenterScreen())),
                ),
                _Row(
                  icon: LucideIcons.shield,
                  label: 'Privacy & security',
                  hint: 'Manage your data',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const PrivacyScreen())),
                ),
                _Row(
                  icon: LucideIcons.settings,
                  label: 'Settings',
                  hint: 'Notifications, language',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const SettingsScreen())),
                ),
              ]),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  icon: const Icon(LucideIcons.logOut, size: 16),
                  label: const Text('Sign out'),
                  onPressed: () async {
                    await authService.signOut();
                    if (!mounted) return;
                    setState(() {
                      _isGuest = true;
                      _profile = null;
                    });
                  },
                ),
              ),
              const SizedBox(height: 12),
              const Center(
                child: Text(
                  'PUBSTORE · v1.0',
                  style: TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════ HERO ═══════════════════════════════════
class _HeroHeader extends StatelessWidget {
  const _HeroHeader({
    required this.profile,
    required this.email,
    required this.role,
    required this.initials,
    required this.balance,
    required this.buyerTier,
    required this.supplierTier,
  });

  final Map<String, dynamic>? profile;
  final String email;
  final String role;
  final String initials;
  final double balance;
  final String buyerTier;
  final String supplierTier;

  @override
  Widget build(BuildContext context) {
    final displayName = (profile?['display_name'] as String?) ??
        (profile?['username'] as String?) ??
        'Welcome';
    final avatar = profile?['avatar_url'] as String?;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            Color(0xD9256EEB), // primary/85 approx
            Color(0x99256EEB), // primary/60 approx
          ],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Soft orbs
          Positioned(
            top: -80,
            right: -64,
            child: Container(
              width: 256,
              height: 256,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: -96,
            left: -40,
            child: Container(
              width: 288,
              height: 288,
              decoration: BoxDecoration(
                color: Colors.amberAccent.withOpacity(0.3),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Profile row
                  Row(
                    children: [
                      Stack(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                  color: Colors.white.withOpacity(0.4),
                                  width: 2),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: avatar != null
                                ? CachedNetworkImage(
                                    imageUrl: avatar,
                                    fit: BoxFit.cover,
                                  )
                                : Center(
                                    child: Text(
                                      initials,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                          ),
                          Positioned(
                            bottom: -2,
                            right: -2,
                            child: Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981),
                                shape: BoxShape.circle,
                                border: Border.all(
                                    color: AppColors.primary, width: 2),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    displayName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                if (role == 'supplier') ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFBBF24),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('PRO',
                                        style: TextStyle(
                                            color: Color(0xFF78350F),
                                            fontSize: 9,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 0.5)),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.8),
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                _HeroChip(text: role.toUpperCase()),
                                _HeroChip(
                                    text: '${buyerTier.toUpperCase()} · BUYER'),
                                if (role == 'supplier')
                                  _HeroChip(
                                      text:
                                          '${supplierTier.toUpperCase()} · SUPPLIER'),
                              ],
                            ),
                          ],
                        ),
                      ),
                      InkResponse(
                        onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const OnboardingScreen())),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(LucideIcons.pencil,
                              color: Colors.white, size: 16),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // PUBSTORE Pay banner
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                    ),
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(LucideIcons.wallet,
                                    color: Colors.white, size: 16),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'PUBSTORE PAY',
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.9),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ]),
                            InkWell(
                              onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          const WalletScreen())),
                              child: Row(children: [
                                Text('Activity',
                                    style: TextStyle(
                                        color:
                                            Colors.white.withOpacity(0.9),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800)),
                                const SizedBox(width: 2),
                                Icon(LucideIcons.arrowUpRight,
                                    color: Colors.white.withOpacity(0.9),
                                    size: 12),
                              ]),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('BALANCE',
                                    style: TextStyle(
                                        color:
                                            Colors.white.withOpacity(0.75),
                                        fontSize: 10,
                                        letterSpacing: 0.6)),
                                const SizedBox(height: 2),
                                Text(
                                  '\$${balance.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 30,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -1,
                                    height: 1,
                                  ),
                                ),
                              ],
                            ),
                            ElevatedButton.icon(
                              onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          const WalletScreen())),
                              icon: const Icon(LucideIcons.plus, size: 14),
                              label: const Text('Top up'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: AppColors.primary,
                                textStyle: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 8),
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(999)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withOpacity(0.28)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

// ═════════════════════════ STATS OVERLAY CARD ═══════════════════════════
class _StatCell extends StatelessWidget {
  const _StatCell(
      {required this.label, required this.value, required this.onTap});
  final String label;
  final int value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: [
            Text('$value',
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5)),
            const SizedBox(height: 2),
            Text(label.toUpperCase(),
                style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    letterSpacing: 0.6)),
          ],
        ),
      ),
    );
  }
}

// ═════════════════════════════ TIER CARD ════════════════════════════════
class _TierCard extends StatelessWidget {
  const _TierCard({
    required this.role,
    required this.buyerTier,
    required this.buyerPoints,
    required this.supplierTier,
    required this.supplierPoints,
  });
  final String role;
  final String buyerTier;
  final int buyerPoints;
  final String supplierTier;
  final int supplierPoints;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('YOUR LEVELS',
              style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6)),
          const SizedBox(height: 2),
          const Text(
              'Earned from activity, verification, purchases & sales',
              style: TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 12),
          _TierProgressRow(
              label: 'Buyer', tier: buyerTier, points: buyerPoints),
          if (role == 'supplier') ...[
            const SizedBox(height: 12),
            _TierProgressRow(
                label: 'Supplier',
                tier: supplierTier,
                points: supplierPoints),
          ],
        ],
      ),
    );
  }
}

class _TierProgressRow extends StatelessWidget {
  const _TierProgressRow(
      {required this.label, required this.tier, required this.points});
  final String label;
  final String tier;
  final int points;

  @override
  Widget build(BuildContext context) {
    final int? next = tier == 'gold' ? null : (tier == 'silver' ? 300 : 100);
    final int base = tier == 'silver' ? 100 : 0;
    final double pct = next == null
        ? 1
        : ((points - base) / (next - base)).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(tier.toUpperCase(),
                    style: const TextStyle(
                        color: Color(0xFF78350F),
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5)),
              ),
            ]),
            Text(
              next == null ? '$points pts · max' : '$points / $next pts',
              style:
                  const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 8,
            backgroundColor: AppColors.mutedSurface,
            valueColor:
                const AlwaysStoppedAnimation(Color(0xFFF59E0B)),
          ),
        ),
      ],
    );
  }
}

// ═════════════════════════════ MYSTORE CTA ══════════════════════════════
class _MyStoreCta extends StatelessWidget {
  const _MyStoreCta({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withOpacity(0.1),
              AppColors.card,
              const Color(0xFFFEF3C7).withOpacity(0.6),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.store,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Open MyStore',
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w900)),
                  Text('Manage products, orders & analytics',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: AppColors.muted, fontSize: 11)),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                color: AppColors.muted, size: 16),
          ],
        ),
      ),
    );
  }
}

// ═════════════════════════════ SECTIONS ═════════════════════════════════
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
            color: AppColors.muted,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final withDividers = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      withDividers.add(children[i]);
      if (i != children.length - 1) {
        withDividers.add(
            const Divider(height: 1, color: AppColors.border, indent: 56));
      }
    }
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: withDividers),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.onTap,
    this.hint,
  });
  final IconData icon;
  final String label;
  final String? hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  if (hint != null && hint!.isNotEmpty)
                    Text(hint!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 11)),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                color: AppColors.muted, size: 16),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════ GUEST HELPERS ══════════════════════════════════
class _GuestStatCard extends StatelessWidget {
  const _GuestStatCard(
      {required this.value, required this.label, required this.onTap});
  final int value;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text('$value',
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(label.toUpperCase(),
                style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    letterSpacing: 0.6)),
          ],
        ),
      ),
    );
  }
}

class _GuestLink extends StatelessWidget {
  const _GuestLink(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(children: [
          Icon(icon, color: AppColors.muted, size: 18),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700))),
          const Icon(LucideIcons.chevronRight,
              color: AppColors.muted, size: 16),
        ]),
      ),
    );
  }
}
