import '../models/models.dart';
import 'supabase_client.dart';

/// Catalog reads. Mirrors `src/data/products.ts` + `src/hooks/useInfiniteProducts.ts`.
class CatalogService {
  const CatalogService();

  Future<List<Product>> fetchProducts({
    int page = 0,
    int pageSize = 30,
    String? category,
    String? search,
    String sortBy = 'newest',
    String tradeMode = 'all',
    String? supplierId,
  }) async {
    final from = page * pageSize;
    final to = from + pageSize - 1;

    var query = supabase
        .from('products')
        .select('id, supplier_id, title, image, gallery, price, original_price, '
            'category_slug, badge, free_shipping, moq, unit, lead_time, ship_from, '
            'rating, review_count, sold, deal_ends_at, ad_has_reel, ad_headline, '
            'ad_tagline, suppliers!inner(name, verified, gold, country, '
            'location_address, latitude, longitude, trade_type)')
        .eq('active', true);

    if (category != null && category.isNotEmpty && category != 'all') {
      query = query.eq('category_slug', category);
    }
    if (supplierId != null && supplierId.isNotEmpty) {
      query = query.eq('supplier_id', supplierId);
    }
    if (tradeMode == 'wholesale') {
      query = query.gt('moq', 1);
    } else if (tradeMode == 'retail') {
      query = query.lte('moq', 1);
    }
    if (search != null && search.trim().isNotEmpty) {
      final term = search.replaceAll(RegExp(r'[% ,]+'), ' ').trim();
      if (term.isNotEmpty) {
        final like = '%$term%';
        query = query.or('title.ilike.$like,category_slug.ilike.$like,badge.ilike.$like');
      }
    }

    switch (sortBy) {
      case 'sold':
        query = query.order('sold', ascending: false);
        break;
      case 'price_asc':
        query = query.order('price', ascending: true);
        break;
      case 'price_desc':
        query = query.order('price', ascending: false);
        break;
      case 'rating':
        query = query.order('rating', ascending: false);
        break;
      default:
        query = query.order('created_at', ascending: false);
    }

    final rows = await query.range(from, to);
    return (rows as List)
        .map((r) => Product.fromRow(r as Map<String, dynamic>))
        .toList();
  }

  Future<List<Category>> fetchCategories() async {
    final rows = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .order('sort_order');
    final data = (rows as List)
        .map((r) => Category.fromRow(r as Map<String, dynamic>))
        .toList();
    return data.isEmpty ? fallbackCategories : data;
  }
}

const catalog = CatalogService();

final fallbackCategories = <Category>[
  Category(id: 'electronics', name: 'Electronics', slug: 'electronics', icon: 'Smartphone'),
  Category(id: 'fashion', name: 'Fashion', slug: 'fashion', icon: 'Shirt'),
  Category(id: 'home', name: 'Home & Garden', slug: 'home', icon: 'Home'),
  Category(id: 'beauty', name: 'Beauty', slug: 'beauty', icon: 'Sparkles'),
  Category(id: 'sports', name: 'Sports & Outdoors', slug: 'sports', icon: 'Dumbbell'),
  Category(id: 'toys', name: 'Toys & Games', slug: 'toys', icon: 'ToyBrick'),
  Category(id: 'automotive', name: 'Automotive', slug: 'automotive', icon: 'Car'),
  Category(id: 'industrial', name: 'Industrial', slug: 'industrial', icon: 'Factory'),
  Category(id: 'agriculture', name: 'Agriculture', slug: 'agriculture', icon: 'Sprout'),
  Category(id: 'packaging', name: 'Packaging', slug: 'packaging', icon: 'Package'),
  Category(id: 'office', name: 'Office', slug: 'office', icon: 'Briefcase'),
  Category(id: 'health', name: 'Health & Wellness', slug: 'health', icon: 'HeartPulse'),
  Category(id: 'hardware', name: 'Hardware & Tools', slug: 'hardware', icon: 'Wrench'),
  Category(id: 'construction', name: 'Construction', slug: 'construction', icon: 'Hammer'),
  Category(id: 'power-tools', name: 'Power Tools', slug: 'power-tools', icon: 'Drill'),
  Category(id: 'paint', name: 'Paint & Décor', slug: 'paint', icon: 'PaintBucket'),
  Category(id: 'lighting', name: 'Lighting', slug: 'lighting', icon: 'Lightbulb'),
  Category(id: 'electrical', name: 'Electrical', slug: 'electrical', icon: 'Plug'),
  Category(id: 'plumbing', name: 'Plumbing', slug: 'plumbing', icon: 'Bath'),
  Category(id: 'furniture', name: 'Furniture', slug: 'furniture', icon: 'Sofa'),
  Category(id: 'appliances', name: 'Appliances', slug: 'appliances', icon: 'Refrigerator'),
  Category(id: 'kitchen', name: 'Kitchen', slug: 'kitchen', icon: 'ChefHat'),
  Category(id: 'food-beverage', name: 'Food & Beverage', slug: 'food-beverage', icon: 'UtensilsCrossed'),
  Category(id: 'groceries', name: 'Groceries', slug: 'groceries', icon: 'Cookie'),
  Category(id: 'drinks', name: 'Drinks & Wine', slug: 'drinks', icon: 'Wine'),
  Category(id: 'baby', name: 'Baby & Kids', slug: 'baby', icon: 'Baby'),
  Category(id: 'pets', name: 'Pet Supplies', slug: 'pets', icon: 'PawPrint'),
  Category(id: 'books', name: 'Books & Media', slug: 'books', icon: 'BookOpen'),
  Category(id: 'music', name: 'Musical Instruments', slug: 'music', icon: 'Music'),
  Category(id: 'camera', name: 'Cameras & Photo', slug: 'camera', icon: 'Camera'),
  Category(id: 'gaming', name: 'Gaming', slug: 'gaming', icon: 'Gamepad2'),
  Category(id: 'jewelry', name: 'Jewelry', slug: 'jewelry', icon: 'Gem'),
  Category(id: 'watches', name: 'Watches', slug: 'watches', icon: 'Watch'),
  Category(id: 'eyewear', name: 'Eyewear', slug: 'eyewear', icon: 'Glasses'),
  Category(id: 'bags', name: 'Bags & Luggage', slug: 'bags', icon: 'Wallet'),
  Category(id: 'stationery', name: 'Stationery', slug: 'stationery', icon: 'Scissors'),
  Category(id: 'garden', name: 'Garden & Plants', slug: 'garden', icon: 'Flower2'),
  Category(id: 'outdoor', name: 'Outdoor & Camping', slug: 'outdoor', icon: 'Tent'),
  Category(id: 'bikes', name: 'Bikes & Scooters', slug: 'bikes', icon: 'Bike'),
  Category(id: 'tv-audio', name: 'TV & Audio', slug: 'tv-audio', icon: 'Tv'),
  Category(id: 'computers', name: 'Computers', slug: 'computers', icon: 'Laptop'),
  Category(id: 'audio', name: 'Audio & Headphones', slug: 'audio', icon: 'Headphones'),
  Category(id: 'printers', name: 'Printers & Ink', slug: 'printers', icon: 'Printer'),
  Category(id: 'batteries', name: 'Batteries & Power', slug: 'batteries', icon: 'BatteryCharging'),
  Category(id: 'auto-parts', name: 'Auto Parts', slug: 'auto-parts', icon: 'Cog'),
  Category(id: 'fuel-energy', name: 'Fuel & Energy', slug: 'fuel-energy', icon: 'Fuel'),
  Category(id: 'logistics', name: 'Logistics', slug: 'logistics', icon: 'Truck'),
  Category(id: 'pharmacy', name: 'Pharmacy', slug: 'pharmacy', icon: 'Pill'),
  Category(id: 'measuring', name: 'Measuring & Layout', slug: 'measuring', icon: 'Ruler'),
  Category(id: 'landscaping', name: 'Landscaping', slug: 'landscaping', icon: 'Shovel'),
];
