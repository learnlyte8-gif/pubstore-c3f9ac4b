import 'package:flutter/material.dart';
import '../widgets/screen_placeholder.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenPlaceholder(
      title: 'Messages',
      subtitle: 'Wiring this screen to Lovable Cloud next — same queries as the web build.',
    );
  }
}
