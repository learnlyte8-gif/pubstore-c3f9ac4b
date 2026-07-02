/// Additional vertical models (vehicles / agro / industrial / wallet)
/// mirroring `src/data/verticals.ts` and `src/hooks/useWallet.ts`.
library vertical_models_ext;

double _d(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
int _i(dynamic v) => v == null ? 0 : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
List<String> _list(dynamic v) =>
    v is List ? v.map((e) => e.toString()).toList() : const [];

class Vehicle {
  Vehicle({
    required this.id,
    required this.title,
    required this.kind,
    this.make,
    this.model,
    this.year,
    this.price = 0,
    this.mileageKm,
    this.fuel,
    this.transmission,
    this.powerHp,
    this.bodyType,
    this.cover,
    this.city,
    this.country,
    this.features = const [],
  });
  final String id;
  final String title;
  final String kind;
  final String? make, model;
  final int? year;
  final double price;
  final int? mileageKm;
  final String? fuel, transmission;
  final int? powerHp;
  final String? bodyType, cover, city, country;
  final List<String> features;

  factory Vehicle.fromMap(Map<String, dynamic> m) => Vehicle(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        kind: (m['kind'] ?? 'car').toString(),
        make: m['make']?.toString(),
        model: m['model']?.toString(),
        year: m['year'] == null ? null : _i(m['year']),
        price: _d(m['price']),
        mileageKm: m['mileage_km'] == null ? null : _i(m['mileage_km']),
        fuel: m['fuel']?.toString(),
        transmission: m['transmission']?.toString(),
        powerHp: m['power_hp'] == null ? null : _i(m['power_hp']),
        bodyType: m['body_type']?.toString(),
        cover: m['cover']?.toString(),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        features: _list(m['features']),
      );
}

class AgroListing {
  AgroListing({
    required this.id,
    required this.title,
    required this.kind,
    this.subcategory,
    this.price,
    this.currency = 'USD',
    this.unit,
    this.moq,
    this.cover,
    this.region,
    this.country,
    this.organic = false,
    this.certifications = const [],
  });
  final String id;
  final String title;
  final String kind;
  final String? subcategory;
  final double? price;
  final String currency;
  final String? unit;
  final int? moq;
  final String? cover;
  final String? region, country;
  final bool organic;
  final List<String> certifications;

  factory AgroListing.fromMap(Map<String, dynamic> m) => AgroListing(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        kind: (m['kind'] ?? '').toString(),
        subcategory: m['subcategory']?.toString(),
        price: m['price'] == null ? null : _d(m['price']),
        currency: (m['currency'] ?? 'USD').toString(),
        unit: m['unit']?.toString(),
        moq: m['moq'] == null ? null : _i(m['moq']),
        cover: m['cover']?.toString(),
        region: m['region']?.toString(),
        country: m['country']?.toString(),
        organic: m['organic'] == true,
        certifications: _list(m['certifications']),
      );
}

class IndustrialListing {
  IndustrialListing({
    required this.id,
    required this.title,
    required this.category,
    this.subcategory,
    this.price,
    this.currency = 'USD',
    this.moq,
    this.cover,
    this.country,
    this.certifications = const [],
    this.leadTime,
    this.description,
  });
  final String id;
  final String title;
  final String category;
  final String? subcategory;
  final double? price;
  final String currency;
  final int? moq;
  final String? cover;
  final String? country;
  final List<String> certifications;
  final String? leadTime;
  final String? description;

  factory IndustrialListing.fromMap(Map<String, dynamic> m) => IndustrialListing(
        id: m['id'].toString(),
        title: (m['title'] ?? '').toString(),
        category: (m['category'] ?? '').toString(),
        subcategory: m['subcategory']?.toString(),
        price: m['price'] == null ? null : _d(m['price']),
        currency: (m['currency'] ?? 'USD').toString(),
        moq: m['moq'] == null ? null : _i(m['moq']),
        cover: m['cover']?.toString(),
        country: m['country']?.toString(),
        certifications: _list(m['certifications']),
        leadTime: m['lead_time']?.toString(),
        description: m['description']?.toString(),
      );
}

class WalletTx {
  WalletTx({
    required this.id,
    required this.amount,
    required this.type,
    required this.description,
    required this.createdAt,
    this.account = 'personal',
  });
  final String id;
  final double amount;
  final String type;
  final String description;
  final DateTime createdAt;
  final String account;

  factory WalletTx.fromMap(Map<String, dynamic> m) => WalletTx(
        id: m['id'].toString(),
        amount: _d(m['amount']),
        type: (m['type'] ?? '').toString(),
        description: (m['description'] ?? '').toString(),
        createdAt: DateTime.tryParse(m['created_at']?.toString() ?? '') ??
            DateTime.now(),
        account: (m['account'] ?? 'personal').toString(),
      );
}

class WalletSummary {
  WalletSummary({
    required this.balance,
    required this.personal,
    required this.sales,
    required this.transactions,
  });
  final double balance;
  final double personal;
  final double sales;
  final List<WalletTx> transactions;
}
