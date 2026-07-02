import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../screens/home_screen.dart';
import '../screens/categories_screen.dart';
import '../screens/more_screen.dart';
import '../screens/messages_screen.dart';
import '../screens/profile_screen.dart';
import '../theme/palette.dart';

/// Bottom-tab shell — mirrors `src/components/AppShell.tsx` on web and
/// `navigation/RootTabs.tsx` in the React Native app.
class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  static const _tabs = <Widget>[
    HomeScreen(),
    CategoriesScreen(),
    MoreScreen(),
    MessagesScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: AppColors.background,
        indicatorColor: AppColors.mutedSurface,
        destinations: const [
          NavigationDestination(icon: Icon(LucideIcons.home), label: 'Home'),
          NavigationDestination(icon: Icon(LucideIcons.layoutGrid), label: 'Categories'),
          NavigationDestination(icon: Icon(LucideIcons.compass), label: 'Explore'),
          NavigationDestination(icon: Icon(LucideIcons.messageCircle), label: 'Messages'),
          NavigationDestination(icon: Icon(LucideIcons.user), label: 'Profile'),
        ],
      ),
    );
  }
}
