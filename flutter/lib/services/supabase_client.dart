import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';

/// Shared Supabase client. Call [initSupabase] once from `main()` before
/// touching [supabase].
Future<void> initSupabase() async {
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
    realtimeClientOptions: const RealtimeClientOptions(
      logLevel: RealtimeLogLevel.info,
    ),
  );
}

SupabaseClient get supabase => Supabase.instance.client;
