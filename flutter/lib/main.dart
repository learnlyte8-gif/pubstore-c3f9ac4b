import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'navigation/root_shell.dart';
import 'screens/splash_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/auth_screen.dart';
import 'services/supabase_client.dart';
import 'services/push_service.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  await PushService.ensureInitialized();
  // Fire-and-forget push registration for any already-signed-in user.
  // ignore: unawaited_futures
  pushService.registerForCurrentUser();
  runApp(const ProviderScope(child: PubstoreApp()));
}

class PubstoreApp extends StatelessWidget {
  const PubstoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PUBSTORE',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      initialRoute: '/',
      routes: {
        '/': (_) => const SplashScreen(),
        '/home': (_) => const RootShell(),
        '/auth': (_) => const AuthScreen(),
        '/onboarding': (_) => const OnboardingScreen(),
      },
    );
  }
}
