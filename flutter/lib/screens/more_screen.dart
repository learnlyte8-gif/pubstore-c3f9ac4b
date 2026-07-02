import 'package:flutter/material.dart';
import '../widgets/screen_placeholder.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenPlaceholder(
      title: 'More',
      subtitle: 'Wiring this screen to Lovable Cloud next — same queries as the web build.',
    );
  }
}
