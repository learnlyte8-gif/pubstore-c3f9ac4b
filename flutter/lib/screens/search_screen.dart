import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';
import 'product_detail_screen.dart';

/// Universal search — mirrors `src/pages/Search.tsx` (product search shard).
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Product> _results = [];
  bool _loading = false;
  Object? _error;

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _run(q));
  }

  Future<void> _run(String q) async {
    if (q.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await catalog.fetchProducts(search: q, pageSize: 40);
      if (!mounted) return;
      setState(() {
        _results = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          autofocus: true,
          onChanged: _onChanged,
          decoration: const InputDecoration(
            hintText: 'Search products, suppliers…',
            prefixIcon: Icon(LucideIcons.search, size: 18),
            contentPadding: EdgeInsets.symmetric(vertical: 10),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Text('$_error',
                      style: const TextStyle(color: AppColors.muted)))
              : _results.isEmpty
                  ? const Center(
                      child: Text('Type to search',
                          style: TextStyle(color: AppColors.muted)))
                  : SingleChildScrollView(
                      child: MasonryProductGrid(
                        products: _results,
                        onTap: (p) => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ProductDetailScreen(product: p),
                          ),
                        ),
                      ),
                    ),
    );
  }
}
