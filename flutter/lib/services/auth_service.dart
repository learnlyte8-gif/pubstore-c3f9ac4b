import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';
import 'supabase_client.dart';

/// Auth + profile providers — mirrors `src/pages/Auth.tsx` on web.
/// The web app uses passwordless email OTP (8-digit code), with optional
/// display_name + phone captured on the same screen and persisted to
/// `public.profiles` after verification.

final authStateProvider = StreamProvider<AuthState>((ref) {
  return supabase.auth.onAuthStateChange;
});

final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return supabase.auth.currentUser;
});

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

  /// Send an 8-digit login code to [email]. Optional [displayName], [phoneE164]
  /// and [phoneCountry] are attached as auth metadata (used by the
  /// `handle_new_user` trigger on first sign-up).
  Future<void> sendEmailOtp({
    required String email,
    String? displayName,
    String? phoneE164,
    String? phoneCountry,
  }) async {
    final data = <String, dynamic>{};
    if (displayName != null && displayName.isNotEmpty) {
      data['display_name'] = displayName;
    }
    if (phoneE164 != null && phoneE164.isNotEmpty) {
      data['phone'] = phoneE164;
      if (phoneCountry != null) data['phone_country'] = phoneCountry;
    }
    await supabase.auth.signInWithOtp(
      email: email,
      shouldCreateUser: true,
      data: data.isEmpty ? null : data,
    );
  }

  /// Verify the 8-digit code sent to [email]. Returns the signed-in user.
  Future<User?> verifyEmailOtp({
    required String email,
    required String token,
  }) async {
    final res = await supabase.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
    return res.user;
  }

  /// Persist phone on `profiles` (handle_new_user only fires on create,
  /// so returning users need an explicit upsert — matches web behaviour).
  Future<void> upsertPhone({
    required String userId,
    required String phoneE164,
  }) async {
    await supabase
        .from('profiles')
        .upsert({'user_id': userId, 'phone': phoneE164},
            onConflict: 'user_id');
  }

  Future<void> signOut() async {
    await supabase.auth.signOut();
  }
}

const authService = AuthService();
