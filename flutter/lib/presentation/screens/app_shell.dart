import 'package:flutter/material.dart';

class AppShell extends StatefulWidget {
  final Widget child;

  const AppShell({
    Key? key,
    required this.child,
  }) : super(key: key);

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _selectedIndex = 0;

  final List<_NavItem> _navItems = [
    _NavItem(
      label: 'Home',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home,
      route: '/home',
    ),
    _NavItem(
      label: 'Search',
      icon: Icons.search_outlined,
      selectedIcon: Icons.search,
      route: '/search',
    ),
    _NavItem(
      label: 'Cart',
      icon: Icons.shopping_cart_outlined,
      selectedIcon: Icons.shopping_cart,
      route: '/cart',
    ),
    _NavItem(
      label: 'Wishlist',
      icon: Icons.favorite_border,
      selectedIcon: Icons.favorite,
      route: '/wishlist',
    ),
    _NavItem(
      label: 'Account',
      icon: Icons.person_outline,
      selectedIcon: Icons.person,
      route: '/profile',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
          Navigator.of(context).pushNamed(_navItems[index].route);
        },
        items: _navItems.asMap().entries.map((entry) {
          final item = entry.value;
          final isSelected = entry.key == _selectedIndex;
          return BottomNavigationBarItem(
            icon: Icon(isSelected ? item.selectedIcon : item.icon),
            label: item.label,
          );
        }).toList(),
      ),
    );
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String route;

  _NavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.route,
  });
}
