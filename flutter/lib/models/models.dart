/// Data models mirroring `src/data/products.ts`.
library models;

class Product {
  Product({
    required this.id,
    required this.title,
    required this.price,
    required this.currency,
    required this.image,
    this.gallery = const [],
    this.originalPrice,
    this.category,
    this.rating = 0,
    this.reviews = 0,
    this.sold = 0,
    this.badge,
    this.freeShipping = false,
    required this.supplierId,
    this.supplierVerified,
    this.supplierGold,
    this.supplierName,
    this.supplierLocation,
    this.supplierLat,
    this.supplierLng,
    this.moq = 1,
    this.unit = 'piece',
    this.tradeType = 'retail',
    this.supplierTradeType = 'both',
    this.leadTime = '—',
    this.shipFrom = '—',
    this.description = '',
    this.dealEndsAt,
    this.adHasReel = false,
    this.adHeadline,
    this.adTagline,
  });

  final String id;
  final String title;
  final double price;
  final String currency;
  final String? image;
  final List<String> gallery;
  final double? originalPrice;
  final String? category;
  final double rating;
  final int reviews;
  final int sold;
  final String? badge;
  final bool freeShipping;
  final String? supplierId;
  final bool? supplierVerified;
  final bool? supplierGold;
  final String? supplierName;
  final String? supplierLocation;
  final double? supplierLat;
  final double? supplierLng;
  final int moq;
  final String unit;
  final String tradeType;
  final String supplierTradeType;
  final String leadTime;
  final String shipFrom;
  final String description;
  final String? dealEndsAt;
  final bool adHasReel;
  final String? adHeadline;
  final String? adTagline;

  int get discountPct => originalPrice != null && originalPrice! > price
      ? (((originalPrice! - price) / originalPrice!) * 100).round()
      : 0;

  factory Product.fromRow(Map<String, dynamic> row) {
    final images = <String>[
      ...((row['gallery'] as List?) ?? const []).whereType<String>(),
      ...((row['images'] as List?) ?? const []).whereType<String>(),
    ];
    final primary = row['image'] as String? ?? (images.isNotEmpty ? images.first : null);
    final supplier = row['suppliers'] is Map
        ? Map<String, dynamic>.from(row['suppliers'] as Map)
        : <String, dynamic>{};
    double? numOrNull(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }
    return Product(
      id: row['id'] as String,
      title: (row['title'] ?? row['name'] ?? '') as String,
      price: ((row['price'] ?? 0) as num).toDouble(),
      currency: (row['currency'] ?? 'USD') as String,
      image: primary,
      gallery: images.isNotEmpty ? images : [if (primary != null) primary],
      originalPrice: numOrNull(row['original_price']),
      category: row['category_slug'] as String? ?? row['category'] as String?,
      rating: ((row['rating'] ?? 0) as num).toDouble(),
      reviews: ((row['review_count'] ?? row['reviews'] ?? 0) as num).toInt(),
      sold: ((row['sold'] ?? 0) as num).toInt(),
      badge: row['badge'] as String?,
      freeShipping: row['free_shipping'] == true,
      supplierId: row['supplier_id'] as String?,
      supplierVerified: supplier['verified'] as bool?,
      supplierGold: supplier['gold'] as bool?,
      supplierName: supplier['name'] as String?,
      supplierLocation:
          supplier['location_address'] as String? ?? supplier['country'] as String?,
      supplierLat: numOrNull(supplier['latitude']),
      supplierLng: numOrNull(supplier['longitude']),
      moq: ((row['moq'] ?? 1) as num).toInt(),
      unit: (row['unit'] ?? 'piece') as String,
      tradeType: ((row['moq'] ?? 1) as num) > 1 ? 'wholesale' : 'retail',
      supplierTradeType: (supplier['trade_type'] ?? 'both') as String,
      leadTime: (row['lead_time'] ?? '—') as String,
      shipFrom: (row['ship_from'] ?? '—') as String,
      description: (row['description'] ?? '') as String,
      dealEndsAt: row['deal_ends_at'] as String?,
      adHasReel: row['ad_has_reel'] == true,
      adHeadline: row['ad_headline'] as String?,
      adTagline: row['ad_tagline'] as String?,
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
