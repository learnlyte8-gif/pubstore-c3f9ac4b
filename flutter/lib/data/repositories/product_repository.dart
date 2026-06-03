import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../domain/models/product_model.dart';
import '../../config/app_config.dart';

final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return ProductRepository();
});

class ProductRepository {
  final supabase = Supabase.instance.client;

  Future<List<ProductModel>> getProducts({
    int page = 1,
    String? category,
    String? searchQuery,
  }) async {
    try {
      var query = supabase.from('products').select();

      if (category != null && category.isNotEmpty) {
        query = query.eq('category', category);
      }

      if (searchQuery != null && searchQuery.isNotEmpty) {
        query = query.ilike('title', '%$searchQuery%');
      }

      final offset = (page - 1) * AppConfig.defaultPageSize;
      final response =
          await query.range(offset, offset + AppConfig.defaultPageSize - 1);

      return (response as List)
          .map((item) => ProductModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error getting products: $e');
      rethrow;
    }
  }

  Future<ProductModel> getProductDetail(String productId) async {
    try {
      final response = await supabase
          .from('products')
          .select()
          .eq('id', productId)
          .single();

      return ProductModel.fromJson(response as Map<String, dynamic>);
    } catch (e) {
      print('Error getting product detail: $e');
      rethrow;
    }
  }

  Future<List<ProductModel>> getFeaturedProducts() async {
    try {
      final response = await supabase
          .from('products')
          .select()
          .eq('is_featured', true)
          .limit(10);

      return (response as List)
          .map((item) => ProductModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error getting featured products: $e');
      rethrow;
    }
  }

  Future<List<ProductModel>> getRelatedProducts(String productId) async {
    try {
      final product = await getProductDetail(productId);
      final response = await supabase
          .from('products')
          .select()
          .eq('category', product.category)
          .neq('id', productId)
          .limit(8);

      return (response as List)
          .map((item) => ProductModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error getting related products: $e');
      rethrow;
    }
  }

  Future<void> addToWishlist(String productId) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('User not logged in');

      await supabase.from('wishlist').insert({
        'user_id': user.id,
        'product_id': productId,
      });
    } catch (e) {
      print('Error adding to wishlist: $e');
      rethrow;
    }
  }

  Future<void> removeFromWishlist(String productId) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) throw Exception('User not logged in');

      await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
    } catch (e) {
      print('Error removing from wishlist: $e');
      rethrow;
    }
  }
}
