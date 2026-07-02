import '../models/vertical_models.dart';
import '../models/vertical_models_ext.dart';
import 'supabase_client.dart';

/// Mirrors `src/data/newVerticals.ts` and `src/data/verticals.ts`.
class VerticalsService {
  const VerticalsService();

  Future<List<ServiceProvider>> fetchServiceProviders({
    String? category,
    int limit = 60,
  }) async {
    dynamic q = supabase
        .from('service_providers')
        .select('*')
        .eq('active', true)
        .order('rating', ascending: false);
    if (category != null && category.isNotEmpty) {
      q = q.eq('category', category);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => ServiceProvider.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<Stay>> fetchStays({String? kind, int limit = 60}) async {
    dynamic q = supabase
        .from('stays')
        .select('*')
        .eq('active', true)
        .order('rating', ascending: false);
    if (kind != null && kind.isNotEmpty && kind != 'all') {
      q = q.eq('kind', kind);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => Stay.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Stay?> fetchStay(String id) async {
    final data = await supabase
        .from('stays')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (data == null) return null;
    return Stay.fromMap(Map<String, dynamic>.from(data));
  }

  Future<List<Property>> fetchProperties({
    String? listingType,
    String? propertyKind,
    int limit = 60,
  }) async {
    dynamic q = supabase
        .from('properties')
        .select('*')
        .eq('active', true)
        .order('featured', ascending: false)
        .order('created_at', ascending: false);
    if (listingType != null && listingType.isNotEmpty) {
      q = q.eq('listing_type', listingType);
    }
    if (propertyKind != null && propertyKind.isNotEmpty) {
      q = q.eq('property_kind', propertyKind);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => Property.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<FinanceProduct>> fetchFinanceProducts({
    String? kind,
    int limit = 60,
  }) async {
    dynamic q = supabase
        .from('finance_products')
        .select('*')
        .eq('active', true)
        .order('featured', ascending: false)
        .order('created_at', ascending: false);
    if (kind != null && kind.isNotEmpty) {
      q = q.eq('kind', kind);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => FinanceProduct.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<NewsArticle>> fetchNews({
    String? category,
    int limit = 40,
  }) async {
    dynamic q = supabase
        .from('news_articles')
        .select('*')
        .order('published_at', ascending: false);
    if (category != null && category.isNotEmpty) {
      q = q.eq('category', category);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => NewsArticle.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<NewsArticle?> fetchNewsArticle(String slug) async {
    final data = await supabase
        .from('news_articles')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
    if (data == null) return null;
    return NewsArticle.fromMap(Map<String, dynamic>.from(data));
  }

  Future<List<Vehicle>> fetchVehicles({String? kind, int limit = 60}) async {
    dynamic q = supabase
        .from('vehicles')
        .select('*')
        .eq('active', true)
        .order('created_at', ascending: false);
    if (kind != null && kind.isNotEmpty && kind != 'all') {
      q = q.eq('kind', kind);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => Vehicle.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<AgroListing>> fetchAgro({String? kind, int limit = 60}) async {
    dynamic q = supabase
        .from('agro_listings')
        .select('*')
        .eq('active', true)
        .order('created_at', ascending: false);
    if (kind != null && kind.isNotEmpty && kind != 'all') {
      q = q.eq('kind', kind);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => AgroListing.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<IndustrialListing>> fetchIndustrial(
      {String? category, int limit = 60}) async {
    dynamic q = supabase
        .from('industrial_listings')
        .select('*')
        .eq('active', true)
        .order('created_at', ascending: false);
    if (category != null && category.isNotEmpty && category != 'all') {
      q = q.eq('category', category);
    }
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => IndustrialListing.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<WalletSummary> fetchWallet(String userId) async {
    final w = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    final txs = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .limit(40);
    final m = w == null ? const {} : Map<String, dynamic>.from(w);
    double d(dynamic v) => v == null
        ? 0
        : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
    return WalletSummary(
      balance: d(m['balance']),
      personal: d(m['personal_balance'] ?? m['balance']),
      sales: d(m['sales_balance']),
      transactions: (txs as List)
          .map((e) => WalletTx.fromMap(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

const verticals = VerticalsService();
