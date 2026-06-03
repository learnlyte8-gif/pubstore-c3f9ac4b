class SupplierModel {
  final String id;
  final String name;
  final String description;
  final String logoUrl;
  final String email;
  final String? phone;
  final String? website;
  final String location;
  final double rating;
  final int reviewCount;
  final bool isVerified;
  final int totalProducts;
  final DateTime createdAt;

  SupplierModel({
    required this.id,
    required this.name,
    required this.description,
    required this.logoUrl,
    required this.email,
    this.phone,
    this.website,
    required this.location,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.isVerified = false,
    this.totalProducts = 0,
    required this.createdAt,
  });

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    return SupplierModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      logoUrl: json['logo_url'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      website: json['website'] as String?,
      location: json['location'] as String,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: json['review_count'] as int? ?? 0,
      isVerified: json['is_verified'] as bool? ?? false,
      totalProducts: json['total_products'] as int? ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'logo_url': logoUrl,
      'email': email,
      'phone': phone,
      'website': website,
      'location': location,
      'rating': rating,
      'review_count': reviewCount,
      'is_verified': isVerified,
      'total_products': totalProducts,
      'created_at': createdAt.toIso8601String(),
    };
  }

  SupplierModel copyWith({
    String? id,
    String? name,
    String? description,
    String? logoUrl,
    String? email,
    String? phone,
    String? website,
    String? location,
    double? rating,
    int? reviewCount,
    bool? isVerified,
    int? totalProducts,
    DateTime? createdAt,
  }) {
    return SupplierModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      logoUrl: logoUrl ?? this.logoUrl,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      website: website ?? this.website,
      location: location ?? this.location,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      isVerified: isVerified ?? this.isVerified,
      totalProducts: totalProducts ?? this.totalProducts,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
