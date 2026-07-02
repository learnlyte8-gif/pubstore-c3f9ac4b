import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

/// A single line in the local cart. Mirrors `src/store/useShop.ts` shape
/// (product snapshot + quantity) so we can hydrate a cart offline before the
/// user signs in.
class CartLine {
  CartLine({required this.product, required this.qty});

  final Product product;
  int qty;

  double get lineTotal => product.price * qty;

  Map<String, dynamic> toJson() => {
        'qty': qty,
        'product': {
          'id': product.id,
          'title': product.title,
          'price': product.price,
          'currency': product.currency,
          'image': product.image,
          'gallery': product.gallery,
          'original_price': product.originalPrice,
          'category_slug': product.category,
          'rating': product.rating,
          'review_count': product.reviews,
          'sold': product.sold,
          'badge': product.badge,
          'free_shipping': product.freeShipping,
          'supplier_id': product.supplierId,
          'moq': product.moq,
          'unit': product.unit,
          'lead_time': product.leadTime,
          'ship_from': product.shipFrom,
          'description': product.description,
        },
      };

  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        product: Product.fromRow(Map<String, dynamic>.from(j['product'] as Map)),
        qty: (j['qty'] as num).toInt(),
      );
}

class CartNotifier extends StateNotifier<List<CartLine>> {
  CartNotifier() : super(const []) {
    _hydrate();
  }

  static const _key = 'pubstore.cart.v1';

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return;
    try {
      final list = (jsonDecode(raw) as List)
          .map((e) => CartLine.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      state = list;
    } catch (_) {/* ignore corrupt cache */}
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(state.map((l) => l.toJson()).toList()),
    );
  }

  void add(Product p, {int qty = 1}) {
    final idx = state.indexWhere((l) => l.product.id == p.id);
    if (idx >= 0) {
      final next = [...state];
      next[idx] = CartLine(product: p, qty: next[idx].qty + qty);
      state = next;
    } else {
      state = [...state, CartLine(product: p, qty: qty)];
    }
    _persist();
  }

  void setQty(String productId, int qty) {
    if (qty <= 0) {
      remove(productId);
      return;
    }
    state = [
      for (final l in state)
        if (l.product.id == productId)
          CartLine(product: l.product, qty: qty)
        else
          l,
    ];
    _persist();
  }

  void remove(String productId) {
    state = state.where((l) => l.product.id != productId).toList();
    _persist();
  }

  void clear() {
    state = const [];
    _persist();
  }

  int get count => state.fold(0, (n, l) => n + l.qty);
  double get subtotal => state.fold(0, (n, l) => n + l.lineTotal);
}

final cartProvider =
    StateNotifierProvider<CartNotifier, List<CartLine>>((ref) => CartNotifier());

final cartCountProvider = Provider<int>(
  (ref) => ref.watch(cartProvider).fold<int>(0, (n, l) => n + l.qty),
);

final cartSubtotalProvider = Provider<double>(
  (ref) => ref.watch(cartProvider).fold<double>(0, (n, l) => n + l.lineTotal),
);
