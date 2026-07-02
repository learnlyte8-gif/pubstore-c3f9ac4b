/// Data models mirroring the shapes we consume from Lovable Cloud (Supabase).
/// Kept intentionally minimal — every screen only reads the columns it needs.
library models;

class Product {
  Product({
    required this.id,
    required this.title,
    required this.price,
    required this.currency,
    required this.image,
    this.category,
    this.rating,
    this.sold,
    this.supplierId,
  });

  final String id;
  final String title;
  final double price;
  final String currency;
  final String? image;
  final String? category;
  final double? rating;
  final int? sold;
  final String? supplierId;

  factory Product.fromRow(Map<String, dynamic> row) {
    final images = (row['images'] as List?)?.cast<dynamic>() ?? const [];
    return Product(
      id: row['id'] as String,
      title: (row['title'] ?? row['name'] ?? '') as String,
      price: ((row['price'] ?? 0) as num).toDouble(),
      currency: (row['currency'] ?? 'USD') as String,
      image: images.isNotEmpty ? images.first as String? : row['image'] as String?,
      category: row['category'] as String?,
      rating: (row['rating'] as num?)?.toDouble(),
      sold: (row['sold'] as num?)?.toInt(),
      supplierId: row['supplier_id'] as String?,
    );
  }
}

class Category {
  Category({required this.id, required this.name, required this.slug, this.icon});

  final String id;
  final String name;
  final String slug;
  final String? icon;

  factory Category.fromRow(Map<String, dynamic> row) => Category(
        id: row['id'] as String,
        name: (row['name'] ?? '') as String,
        slug: (row['slug'] ?? row['name'] ?? '') as String,
        icon: row['icon'] as String?,
      );
}
