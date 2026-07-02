import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_client.dart';

/// Auth + profile providers — mirrors `src/pages/Auth.tsx` +
/// `src/hooks/useRequireAuth.ts` on web. All screens should read
/// [authStateProvider] for the live session and [profileProvider] for
/// the current user's profile row.

/// Streams every auth event (sign-in, sign-out, token refresh).
final authStateProvider = StreamProvider<AuthState>((ref) {
  return supabase.auth.onAuthStateChange;
});

/// Current [User] or null. Rebuilds whenever auth state changes.
final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return supabase.auth.currentUser;
});

/// The signed-in user's `public.profiles` row, or null when signed out.
final profileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  final row = await supabase
      .from('profiles')
      .select()
      .eq('user_id', user.id)
      .maybeSingle();
  return row;
});

class AuthService {
  const AuthService();

  Future<void> signInWithPassword(String email, String password) async {
    await supabase.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signUp(String email, String password,
      {String? displayName}) async {
    await supabase.auth.signUp(
      email: email,
      password: password,
      data: displayName == null ? null : {'display_name': displayName},
      emailRedirectTo: null,
    );
  }

  Future<void> sendPasswordReset(String email) async {
    await supabase.auth.resetPasswordForEmail(email);
  }

  Future<void> signOut() async {
    await supabase.auth.signOut();
  }
}

const authService = AuthService();
