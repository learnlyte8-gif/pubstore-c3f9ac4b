import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../screens/home_screen.dart';
import '../screens/categories_screen.dart';
import '../screens/messages_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/wishlist_screen.dart';
import '../screens/search_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/cart_screen.dart';
import '../services/auth_service.dart';
import '../services/cart_service.dart';
import '../services/catalog_service.dart';
import '../theme/palette.dart';
import '../widgets/tapson_sheet.dart';

/// Bottom-tab shell — mirrors `src/components/AppShell.tsx` on web and
/// `navigation/RootTabs.tsx` in the React Native app.
class RootShell extends ConsumerStatefulWidget {
  const RootShell({super.key});

  @override
  ConsumerState<RootShell> createState() => _RootShellState();
}

class _RootShellState extends ConsumerState<RootShell> {
  int _index = 0;
  String _feed = 'home';
  Category? _activeCategory;
  late Future<List<Category>> _categories;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _categories = catalog.fetchCategories();
  }

  void _selectFeed(String feed) {
    setState(() {
      _index = 0;
      _feed = feed;
      _activeCategory = null;
    });
  }

  void _selectCategory(Category category) {
    setState(() {
      _index = 0;
      _feed = 'home';
      _activeCategory = category;
    });
  }

  @override
  Widget build(BuildContext context) {
    final body = [
      HomeScreen(
        feed: _feed,
        categoryId: _activeCategory?.slug,
        categoryName: _activeCategory?.name,
      ),
      CategoriesScreen(onCategorySelected: _selectCategory),
      const MessagesScreen(),
      const WishlistScreen(),
      const ProfileScreen(),
    ];

    final screenWidth = MediaQuery.sizeOf(context).width;
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: Drawer(
        backgroundColor: AppColors.background,
        width: screenWidth * .88 > 420 ? 420 : screenWidth * .88,
        child: _RailDrawerContent(onClose: () => Navigator.of(context).pop()),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _ShellHeader(
              currentIndex: _index,
              feed: _feed,
              activeCategory: _activeCategory,
              categoriesFuture: _categories,
              onMenu: () => _scaffoldKey.currentState?.openDrawer(),
              onFeed: _selectFeed,
              onCategory: _selectCategory,
            ),
            Expanded(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1600),
                  child: IndexedStack(index: _index, children: body),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _BottomNav(
        index: _index,
        onChanged: (i) => setState(() => _index = i),
      ),
    );
  }
}

class _ShellHeader extends ConsumerWidget {
  const _ShellHeader({
    required this.currentIndex,
    required this.feed,
    required this.activeCategory,
    required this.categoriesFuture,
    required this.onMenu,
    required this.onFeed,
    required this.onCategory,
  });

  final int currentIndex;
  final String feed;
  final Category? activeCategory;
  final Future<List<Category>> categoriesFuture;
  final VoidCallback onMenu;
  final void Function(String feed) onFeed;
  final void Function(Category category) onCategory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final cartCount = ref.watch(cartCountProvider);
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFE7F0FF), AppColors.background, Color(0xFFFFF2C2)],
          stops: [0, .55, 1],
        ),
        boxShadow: [BoxShadow(color: Color(0x24000000), blurRadius: 22, offset: Offset(0, 8))],
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1600),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
            child: Column(
              children: [
                SizedBox(
                  height: 40,
                  child: Row(children: [
                    IconButton(
                      onPressed: onMenu,
                      icon: const Icon(LucideIcons.menu, size: 18),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints.tightFor(width: 32, height: 32),
                      style: IconButton.styleFrom(shape: const CircleBorder()),
                    ),
                    GestureDetector(
                      onTap: () => onFeed('home'),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                        const Text('ZW', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF16A34A), height: 1)),
                        const SizedBox(width: 3),
                        const Text('PUBSTORE', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, height: 1)),
                        if (user != null) const Padding(
                          padding: EdgeInsets.only(left: 3),
                          child: Text('bronze', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                        ),
                      ]),
                    ),
                    const Spacer(),
                    if (user != null)
                      GestureDetector(
                        onTap: () {},
                        child: const Row(children: [
                          Icon(LucideIcons.wallet, size: 16),
                          SizedBox(width: 4),
                          Text('\$0.00', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
                        ]),
                      ),
                    _HeaderIcon(icon: LucideIcons.bell, badge: 0, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
                    _HeaderIcon(icon: LucideIcons.shoppingCart, badge: cartCount, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CartScreen()))),
                  ]),
                ),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
                      child: Container(
                        height: 36,
                        padding: const EdgeInsets.only(left: 8, right: 4),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.orange, width: 2),
                        ),
                        child: Row(children: [
                          const Icon(LucideIcons.search, size: 16, color: AppColors.orange),
                          const SizedBox(width: 6),
                          const Expanded(child: Text('Search products, suppliers…', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w700))),
                          Container(width: 1, height: 20, color: AppColors.border),
                          const SizedBox(width: 4),
                          const Icon(LucideIcons.camera, size: 18, color: AppColors.muted),
                          const SizedBox(width: 4),
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => TapsonSheet.show(context),
                            child: Container(
                              height: 28,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(.35),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: Colors.white.withOpacity(.7)),
                              ),
                              child: const Row(children: [
                                Icon(LucideIcons.sparkles, size: 14),
                                SizedBox(width: 4),
                                Text('Tapson', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                              ]),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ),
                ]),
                if (currentIndex == 0) ...[
                  const SizedBox(height: 8),
                  FutureBuilder<List<Category>>(
                    future: categoriesFuture,
                    builder: (context, snap) => _HomeFeedTabs(
                      categories: snap.data ?? const [],
                      activeFeed: feed,
                      activeCategory: activeCategory,
                      onFeed: onFeed,
                      onCategory: onCategory,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({required this.icon, required this.badge, required this.onTap});
  final IconData icon;
  final int badge;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Stack(alignment: Alignment.center, children: [
            Icon(icon, size: 22),
            if (badge > 0)
              Positioned(
                top: 5,
                right: 4,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16),
                  height: 16,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(99), border: Border.all(color: AppColors.background, width: 2)),
                  alignment: Alignment.center,
                  child: Text(badge > 99 ? '99+' : '$badge', style: const TextStyle(fontSize: 9, color: AppColors.destructiveForeground, fontWeight: FontWeight.w900, height: 1)),
                ),
              ),
          ]),
        ),
      );
}

class _HomeFeedTabs extends StatelessWidget {
  const _HomeFeedTabs({required this.categories, required this.activeFeed, required this.activeCategory, required this.onFeed, required this.onCategory});
  final List<Category> categories;
  final String activeFeed;
  final Category? activeCategory;
  final void Function(String feed) onFeed;
  final void Function(Category category) onCategory;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 28,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            _tab('Home', activeCategory == null && activeFeed == 'home', () => onFeed('home')),
            _tab('For you', activeCategory == null && activeFeed == 'fyp', () => onFeed('fyp')),
            _tab('Following', activeCategory == null && activeFeed == 'following', () => onFeed('following')),
            for (final c in categories) _tab(c.name, activeCategory?.slug == c.slug, () => onCategory(c)),
          ],
        ),
      );
  Widget _tab(String label, bool active, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 16),
        child: GestureDetector(
          onTap: onTap,
          child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: active ? AppColors.foreground : AppColors.muted)),
            const SizedBox(height: 5),
            AnimatedContainer(duration: const Duration(milliseconds: 250), height: 3, width: active ? label.length * 7.0 : 0, decoration: BoxDecoration(color: AppColors.orange, borderRadius: BorderRadius.circular(99))),
          ]),
        ),
      );
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.index, required this.onChanged});
  final int index;
  final void Function(int) onChanged;
  static const items = [
    ('Home', LucideIcons.home),
    ('Shop', Icons.shopping_bag_outlined),
    ('Chats', LucideIcons.messageCircle),
    ('Saved', LucideIcons.heart),
    ('You', LucideIcons.user),
  ];
  @override
  Widget build(BuildContext context) => Container(
        height: 56 + MediaQuery.paddingOf(context).bottom,
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom, left: 4, right: 4),
        decoration: const BoxDecoration(color: AppColors.background, border: Border(top: BorderSide(color: AppColors.border))),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1600),
            child: Row(children: [
              for (var i = 0; i < items.length; i++) Expanded(child: _bottomItem(i, items[i].$1, items[i].$2)),
            ]),
          ),
        ),
      );
  Widget _bottomItem(int i, String label, IconData icon) {
    final active = index == i;
    return GestureDetector(
      onTap: () => onChanged(i),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, size: 26, color: active ? AppColors.orange : AppColors.foreground.withOpacity(.55)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, height: 1, fontWeight: active ? FontWeight.w700 : FontWeight.w600, color: active ? AppColors.orange : AppColors.foreground.withOpacity(.55))),
      ]),
    );
  }
}

class _RailDrawerContent extends StatelessWidget {
  const _RailDrawerContent({required this.onClose});
  final VoidCallback onClose;
  static const sections = [
    ('Commerce', [('Marketplace', 'Shop everything', LucideIcons.store), ('Industrial', 'B2B & wholesale', LucideIcons.factory), ('Logistics', 'Ship & deliver', LucideIcons.truck)]),
    ('Mobility', [('Rides', 'Book a trip', LucideIcons.navigation), ('Auto', 'Buy vehicles', LucideIcons.car), ('Car Rentals', 'Rent by the day', LucideIcons.car)]),
    ('Living', [('Properties', 'Buy & let', Icons.apartment), ('Stays', 'Hotels & rentals', Icons.hotel_outlined), ('Services', 'Hire a pro', LucideIcons.wrench)]),
    ('Work & Money', [('Jobs', 'Find work', LucideIcons.briefcase), ('Finance', 'Loans & wallet', Icons.account_balance_outlined), ('News', 'Today’s stories', LucideIcons.newspaper)]),
  ];
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Column(children: [
          Container(
            padding: const EdgeInsets.fromLTRB(24, 28, 12, 24),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border)), gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [AppColors.mutedSurface, AppColors.background])),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 44, height: 44, padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)), child: Image.asset('assets/pubstore-logo.png')),
                const SizedBox(width: 14),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('PUBSTORE', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, height: 1)),
                  SizedBox(height: 6),
                  Text('The everything marketplace', style: TextStyle(fontSize: 11, color: AppColors.muted)),
                ])),
                IconButton(onPressed: onClose, icon: const Icon(LucideIcons.x, size: 18)),
              ]),
              const SizedBox(height: 20),
              const Text('DIRECTORY', style: TextStyle(fontSize: 10, letterSpacing: 2.2, color: AppColors.muted, fontWeight: FontWeight.w700)),
            ]),
          ),
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(8, 12, 8, 12), children: [
              for (final section in sections) ...[
                Padding(padding: const EdgeInsets.fromLTRB(20, 12, 20, 6), child: Text(section.$1.toUpperCase(), style: const TextStyle(fontSize: 10, letterSpacing: 1.8, color: AppColors.muted, fontWeight: FontWeight.w900))),
                for (final item in section.$2) ListTile(
                  leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)), child: Icon(item.$3, size: 18)),
                  title: Text(item.$1, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                  subtitle: Text(item.$2, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                  trailing: const Text('›', style: TextStyle(fontSize: 18, color: AppColors.muted)),
                  onTap: onClose,
                ),
              ],
            ]),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            decoration: const BoxDecoration(color: AppColors.mutedSurface, border: Border(top: BorderSide(color: AppColors.border))),
            child: const Column(children: [
              Text('A SIGNATURE CREATION BY', style: TextStyle(fontSize: 9, letterSpacing: 2.4, color: AppColors.muted)),
              SizedBox(height: 6),
              Text('KUKISTACKSGROUP', style: TextStyle(fontSize: 15, letterSpacing: 2, fontWeight: FontWeight.w900, color: AppColors.primary)),
            ]),
          ),
        ]),
      );
}
