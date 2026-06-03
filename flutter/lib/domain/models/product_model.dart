class ProductModel {
  final String id;
  final String title;
  final String description;
  final double price;
  final double? originalPrice;
  final double rating;
  final int reviewCount;
  final int inStock;
  final String imageUrl;
  final List<String> images;
  final String category;
  final String supplierId;
  final String supplierName;
  final DateTime createdAt;
  final bool isFavorite;
  final Map<String, dynamic>? specifications;

  ProductModel({
    required this.id,
    required this.title,
    required this.description,
    required this.price,
    this.originalPrice,
    this.rating = 0.0,
    this.reviewCount = 0,
    required this.inStock,
    required this.imageUrl,
    this.images = const [],
    required this.category,
    required this.supplierId,
    required this.supplierName,
    required this.createdAt,
    this.isFavorite = false,
    this.specifications,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      price: (json['price'] as num).toDouble(),
      originalPrice: json['original_price'] != null
          ? (json['original_price'] as num).toDouble()
          : null,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: json['review_count'] as int? ?? 0,
      inStock: json['in_stock'] as int,
      imageUrl: json['image_url'] as String,
      images: List<String>.from(json['images'] as List? ?? []),
      category: json['category'] as String,
      supplierId: json['supplier_id'] as String,
      supplierName: json['supplier_name'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      isFavorite: json['is_favorite'] as bool? ?? false,
      specifications: json['specifications'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'price': price,
      'original_price': originalPrice,
      'rating': rating,
      'review_count': reviewCount,
      'in_stock': inStock,
      'image_url': imageUrl,
      'images': images,
      'category': category,
      'supplier_id': supplierId,
      'supplier_name': supplierName,
      'created_at': createdAt.toIso8601String(),
      'is_favorite': isFavorite,
      'specifications': specifications,
    };
  }

  ProductModel copyWith({
    String? id,
    String? title,
    String? description,
    double? price,
    double? originalPrice,
    double? rating,
    int? reviewCount,
    int? inStock,
    String? imageUrl,
    List<String>? images,
    String? category,
    String? supplierId,
    String? supplierName,
    DateTime? createdAt,
    bool? isFavorite,
    Map<String, dynamic>? specifications,
  }) {
    return ProductModel(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      price: price ?? this.price,
      originalPrice: originalPrice ?? this.originalPrice,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      inStock: inStock ?? this.inStock,
      imageUrl: imageUrl ?? this.imageUrl,
      images: images ?? this.images,
      category: category ?? this.category,
      supplierId: supplierId ?? this.supplierId,
      supplierName: supplierName ?? this.supplierName,
      createdAt: createdAt ?? this.createdAt,
      isFavorite: isFavorite ?? this.isFavorite,
      specifications: specifications ?? this.specifications,
    );
  }

  double get discount {
    if (originalPrice == null) return 0;
    return ((originalPrice! - price) / originalPrice! * 100);
  }
}
