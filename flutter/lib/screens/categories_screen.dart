import 'package:flutter/material.dart';
import '../widgets/screen_placeholder.dart';

class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenPlaceholder(
      title: 'Categories',
      subtitle: 'Wiring this screen to Lovable Cloud next — same queries as the web build.',
    );
  }
}
