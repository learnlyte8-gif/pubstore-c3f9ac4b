/// Vertical data models mirroring `src/data/newVerticals.ts` and
/// `src/data/verticals.ts`.
library vertical_models;

double _d(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
int _i(dynamic v) => v == null ? 0 : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
List<String> _list(dynamic v) =>
    v is List ? v.map((e) => e.toString()).toList() : const [];

class ServiceProvider {
  ServiceProvider({
    required this.id,
    required this.displayName,
    required this.category,
    this.subcategory,
    this.cover,
    this.rating = 0,
    this.city,
    this.country,
    this.hourlyRate,
    this.phone,
    this.whatsapp,
  });
  final String id;
  final String displayName;
  final String category;
  final String? subcategory;
  final String? cover;
  final double rating;
  final String? city;
  final String? country;
  final double? hourlyRate;
  final String? phone;
  final String? whatsapp;

  factory ServiceProvider.fromMap(Map<String, dynamic> m) => ServiceProvider(
        id: m['id'].toString(),
        displayName: (m['display_name'] ?? '').toString(),
        category: (m['category'] ?? '').toString(),
        subcategory: m['subcategory']?.toString(),
        cover: m['cover']?.toString(),
        rating: _d(m['rating']),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        hourlyRate: m['hourly_rate'] == null ? null : _d(m['hourly_rate']),
        phone: m['phone']?.toString(),
        whatsapp: m['whatsapp']?.toString(),
      );
}

class Stay {
  Stay({
    required this.id,
    required this.title,
    required this.kind,
    this.cover,
    this.city,
    this.country,
    this.pricePerNight = 0,
    this.rating = 0,
    this.reviewCount = 0,
    this.superhost = false,
    this.amenities = const [],
    this.guests = 0,
    this.bedrooms = 0,
    this.beds = 0,
    this.baths = 0,
    this.description,
    this.gallery = const [],
  });
  final String id;
  final String title;
  final String kind;
  final String? cover;
  final String? city;
  final String? country;
  final double pricePerNight;
  final double rating;
  final int reviewCount;
  final bool superhost;
  final List<String> amenities;
  final int guests, bedrooms, beds, baths;
  final String? description;
  final List<String> gallery;

  factory Stay.fromMap(Map<String, dynamic> m) => Stay(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        kind: (m['kind'] ?? '').toString(),
        cover: m['cover']?.toString(),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        pricePerNight: _d(m['price_per_night']),
        rating: _d(m['rating']),
        reviewCount: _i(m['review_count']),
        superhost: m['superhost'] == true,
        amenities: _list(m['amenities']),
        guests: _i(m['guests']),
        bedrooms: _i(m['bedrooms']),
        beds: _i(m['beds']),
        baths: _i(m['baths']),
        description: m['description']?.toString(),
        gallery: _list(m['gallery']),
      );
}

class Property {
  Property({
    required this.id,
    required this.title,
    required this.listingType,
    required this.propertyKind,
    this.cover,
    this.city,
    this.country,
    this.price = 0,
    this.pricePeriod = 'mo',
    this.bedrooms,
    this.baths,
    this.areaSqm,
    this.featured = false,
    this.contactWhatsapp,
  });
  final String id;
  final String title;
  final String listingType;
  final String propertyKind;
  final String? cover;
  final String? city;
  final String? country;
  final double price;
  final String pricePeriod;
  final int? bedrooms;
  final int? baths;
  final int? areaSqm;
  final bool featured;
  final String? contactWhatsapp;

  factory Property.fromMap(Map<String, dynamic> m) => Property(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        listingType: (m['listing_type'] ?? '').toString(),
        propertyKind: (m['property_kind'] ?? '').toString(),
        cover: m['cover']?.toString(),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        price: _d(m['price']),
        pricePeriod: (m['price_period'] ?? 'mo').toString(),
        bedrooms: m['bedrooms'] == null ? null : _i(m['bedrooms']),
        baths: m['baths'] == null ? null : _i(m['baths']),
        areaSqm: m['area_sqm'] == null ? null : _i(m['area_sqm']),
        featured: m['featured'] == true,
        contactWhatsapp: m['contact_whatsapp']?.toString(),
      );
}

class FinanceProduct {
  FinanceProduct({
    required this.id,
    required this.title,
    required this.kind,
    this.providerName,
    this.cover,
    this.interestRate,
    this.termMonths,
    this.minAmount,
    this.maxAmount,
    this.features = const [],
    this.featured = false,
    this.contactWhatsapp,
  });
  final String id;
  final String title;
  final String kind;
  final String? providerName;
  final String? cover;
  final double? interestRate;
  final int? termMonths;
  final double? minAmount;
  final double? maxAmount;
  final List<String> features;
  final bool featured;
  final String? contactWhatsapp;

  factory FinanceProduct.fromMap(Map<String, dynamic> m) => FinanceProduct(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        kind: (m['kind'] ?? '').toString(),
        providerName: m['provider_name']?.toString(),
        cover: m['cover']?.toString(),
        interestRate:
            m['interest_rate'] == null ? null : _d(m['interest_rate']),
        termMonths: m['term_months'] == null ? null : _i(m['term_months']),
        minAmount: m['min_amount'] == null ? null : _d(m['min_amount']),
        maxAmount: m['max_amount'] == null ? null : _d(m['max_amount']),
        features: _list(m['features']),
        featured: m['featured'] == true,
        contactWhatsapp: m['contact_whatsapp']?.toString(),
      );
}

class NewsArticle {
  NewsArticle({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.cover,
    this.category,
    this.author,
    this.publishedAt,
    this.body,
  });
  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? cover;
  final String? category;
  final String? author;
  final DateTime? publishedAt;
  final String? body;

  factory NewsArticle.fromMap(Map<String, dynamic> m) => NewsArticle(
        id: m['id'].toString(),
        slug: (m['slug'] ?? '').toString(),
        title: (m['title'] ?? '').toString(),
        excerpt: m['excerpt']?.toString(),
        cover: m['cover']?.toString(),
        category: m['category']?.toString(),
        author: m['author']?.toString(),
        publishedAt: m['published_at'] == null
            ? null
            : DateTime.tryParse(m['published_at'].toString()),
        body: m['body']?.toString(),
      );
}

/// Static category lists mirroring the web `SERVICE_CATEGORIES`,
/// `PROPERTY_KINDS`, `FINANCE_KINDS`, and stay kinds.
class VerticalTaxonomy {
  static const services = [
    ('plumber', 'Plumber'),
    ('electrician', 'Electrician'),
    ('cleaner', 'Cleaner'),
    ('mover', 'Mover'),
    ('tutor', 'Tutor'),
    ('freelancer', 'Freelancer'),
    ('handyman', 'Handyman'),
    ('beauty', 'Beauty'),
    ('mechanic', 'Mechanic'),
  ];
  static const propertyKinds = [
    ('apartment', 'Apartment'),
    ('house', 'House'),
    ('room', 'Room'),
    ('land', 'Land'),
    ('commercial', 'Commercial'),
    ('office', 'Office'),
  ];
  static const financeKinds = [
    ('personal_loan', 'Personal loan'),
    ('business_loan', 'Business loan'),
    ('vehicle_finance', 'Vehicle finance'),
    ('insurance', 'Insurance'),
    ('savings', 'Savings'),
  ];
  static const stayKinds = [
    ('all', 'All stays'),
    ('b&b', 'B&B'),
    ('hotel', 'Hotels'),
    ('apartment', 'Apartments'),
    ('factory_tour', 'Factory tours'),
    ('retreat', 'Retreats'),
  ];
}
