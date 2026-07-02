import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'supabase_client.dart';

/// Lightweight wishlist state for header/profile counters.
/// Fetches wishlist_items for the current user on demand.
class WishlistNotifier extends StateNotifier<List<String>> {
  WishlistNotifier() : super(const []) {
    _load();
    supabase.auth.onAuthStateChange.listen((_) => _load());
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      state = const [];
      return;
    }
    try {
      final rows = await supabase
          .from('wishlist_items')
          .select('product_id')
          .eq('user_id', uid);
      state = (rows as List)
          .map((r) => (r as Map)['product_id'].toString())
          .toList(growable: false);
    } catch (_) {
      state = const [];
    }
  }

  Future<void> refresh() => _load();
}

final wishlistProvider =
    StateNotifierProvider<WishlistNotifier, List<String>>(
        (ref) => WishlistNotifier());
