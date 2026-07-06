/// Environment configuration. Values are injected at build time via
/// `--dart-define`, e.g.:
///
///   flutter run \
///     --dart-define=SUPABASE_URL=https://ccprnnqxpnrkdrfsudjc.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=eyJhbGci...
///
/// The defaults below match the Lovable Cloud project this app is wired to
/// (same values as the web + React Native clients) so `flutter run` works
/// out of the box during development. Override in CI for hardened builds.
class Env {
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://ccprnnqxpnrkdrfsudjc.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJubnF4cG5ya2RyZnN1ZGpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzY5MzEsImV4cCI6MjA5MjI1MjkzMX0.9Qs_3Bg62d9WIR-29TKXZnQxOkJLEX4YDV72oZZNdGo',
  );

  static const String projectId = String.fromEnvironment(
    'SUPABASE_PROJECT_ID',
    defaultValue: 'ccprnnqxpnrkdrfsudjc',
  );

  static const String appId = 'app.lovable.14b25a14b8c040f29b8231f038ad2828';
  static const String appName = 'PUBSTORE';
  static const String webBaseUrl = 'https://pubstore.app';

  /// Google OAuth client IDs. On iOS the app uses the iOS client to obtain an
  /// idToken; on Android the serverClientId is the Web client the Supabase
  /// project trusts. Override with `--dart-define` for release builds.
  static const String googleIosClientId = String.fromEnvironment(
    'GOOGLE_IOS_CLIENT_ID',
    defaultValue: '',
  );
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue: '',
  );
}
