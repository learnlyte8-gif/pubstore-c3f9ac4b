import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/product_repository.dart';
import '../../domain/models/product_model.dart';

final productsProvider = FutureProvider.family<List<ProductModel>, int>((ref, page) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getProducts(page: page);
});

final searchProductsProvider =
    FutureProvider.family<List<ProductModel>, String>((ref, query) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getProducts(searchQuery: query);
});

final categoryProductsProvider =
    FutureProvider.family<List<ProductModel>, String>((ref, category) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getProducts(category: category);
});

final productDetailProvider =
    FutureProvider.family<ProductModel, String>((ref, productId) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getProductDetail(productId);
});

final featuredProductsProvider =
    FutureProvider<List<ProductModel>>((ref) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getFeaturedProducts();
});

final relatedProductsProvider =
    FutureProvider.family<List<ProductModel>, String>((ref, productId) async {
  final repository = ref.watch(productRepositoryProvider);
  return repository.getRelatedProducts(productId);
});

final wishlistProvider =
    StateNotifierProvider<WishlistNotifier, List<String>>((ref) {
  return WishlistNotifier();
});

class WishlistNotifier extends StateNotifier<List<String>> {
  WishlistNotifier() : super([]);

  void addToWishlist(String productId) {
    if (!state.contains(productId)) {
      state = [...state, productId];
    }
  }

  void removeFromWishlist(String productId) {
    state = state.where((id) => id != productId).toList();
  }

  bool isInWishlist(String productId) {
    return state.contains(productId);
  }
}
