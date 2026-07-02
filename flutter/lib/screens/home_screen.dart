import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';

/// Home feed — infinite-scrolling staggered grid backed by
/// `products` on Lovable Cloud. Same shape as `src/pages/Home.tsx`.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scroll = ScrollController();
  final List<Product> _products = [];
  int _page = 0;
  bool _loading = false;
  bool _done = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _loadMore();
    _scroll.addListener(() {
      if (_scroll.position.pixels >=
          _scroll.position.maxScrollExtent - 400) {
        _loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadMore() async {
    if (_loading || _done) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final batch = await catalog.fetchProducts(page: _page, pageSize: 30);
      setState(() {
        _products.addAll(batch);
        _page += 1;
        _done = batch.length < 30;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _products.clear();
      _page = 0;
      _done = false;
    });
    await _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'PUBSTORE',
          style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: _products.isEmpty && _loading
            ? const Center(child: CircularProgressIndicator())
            : _products.isEmpty && _error != null
                ? _ErrorRetry(error: _error!, onRetry: _loadMore)
                : CustomScrollView(
                    controller: _scroll,
                    slivers: [
                      SliverToBoxAdapter(
                        child: MasonryProductGrid(products: _products),
                      ),
                      if (_loading)
                        const SliverPadding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          sliver: SliverToBoxAdapter(
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        ),
                      if (_done && _products.isNotEmpty)
                        const SliverPadding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          sliver: SliverToBoxAdapter(
                            child: Center(
                              child: Text('You\'re all caught up',
                                  style: TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 40, color: AppColors.muted),
            const SizedBox(height: 12),
            Text('Couldn\'t load products',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('$error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
