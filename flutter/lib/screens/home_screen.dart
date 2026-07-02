import 'package:flutter/material.dart';
import '../widgets/screen_placeholder.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenPlaceholder(
      title: 'Home',
      subtitle: 'Wiring this screen to Lovable Cloud next — same queries as the web build.',
    );
  }
}
