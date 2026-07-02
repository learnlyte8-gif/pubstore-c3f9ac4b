import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'supabase_client.dart';

/// Wallet balance provider — mirrors `useWallet` in the web app.
/// Reads `wallets.balance` for the current user; 0 when signed-out.
class WalletBalanceNotifier extends StateNotifier<double> {
  WalletBalanceNotifier() : super(0) {
    _load();
    supabase.auth.onAuthStateChange.listen((_) => _load());
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      state = 0;
      return;
    }
    try {
      final row = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', uid)
          .maybeSingle();
      state = ((row?['balance'] as num?) ?? 0).toDouble();
    } catch (_) {
      state = 0;
    }
  }

  Future<void> refresh() => _load();
}

final walletBalanceProvider =
    StateNotifierProvider<WalletBalanceNotifier, double>(
        (ref) => WalletBalanceNotifier());
