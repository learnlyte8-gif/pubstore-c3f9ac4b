import 'package:flutter/material.dart';
import '../widgets/screen_placeholder.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenPlaceholder(
      title: 'Profile',
      subtitle: 'Wiring this screen to Lovable Cloud next — same queries as the web build.',
    );
  }
}
