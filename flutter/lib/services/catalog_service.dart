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
  }) async {
    final from = page * pageSize;
    final to = from + pageSize - 1;

    var query = supabase
        .from('products')
        .select('id, title, price, currency, images, category, rating, sold, supplier_id')
        .eq('status', 'active');

    if (category != null && category.isNotEmpty && category != 'all') {
      query = query.eq('category', category);
    }
    if (search != null && search.trim().isNotEmpty) {
      query = query.ilike('title', '%${search.trim()}%');
    }

    final rows = await query.order('created_at', ascending: false).range(from, to);
    return (rows as List)
        .map((r) => Product.fromRow(r as Map<String, dynamic>))
        .toList();
  }

  Future<List<Category>> fetchCategories() async {
    final rows = await supabase
        .from('categories')
        .select('id, name, slug, icon')
        .order('name');
    return (rows as List)
        .map((r) => Category.fromRow(r as Map<String, dynamic>))
        .toList();
  }
}

const catalog = CatalogService();
