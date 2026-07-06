import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  // Edge-to-edge: let every screen's app bar / header paint behind the
  // status bar so it takes on the screen's own colour instead of a
  // system-drawn opaque strip.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  await initSupabase();
  await PushService.ensureInitialized();
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
