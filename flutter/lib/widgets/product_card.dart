import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/message_models.dart';
import '../models/models.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import 'chat/share_to_chat_sheet.dart';
import 'social/group_buy_start_sheet.dart';

/// Marketplace product card — mirror of `src/components/marketplace/ProductCard.tsx`.
class ProductCard extends StatefulWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.onAdd,
    this.onShare,
    this.onWishlist,
    this.onGroupBuy,
    this.variant = 'grid',
  });

  final Product product;
  final VoidCallback? onTap;
  final VoidCallback? onAdd;
  final VoidCallback? onShare;
  final VoidCallback? onWishlist;
  final VoidCallback? onGroupBuy;
  final String variant;

  @override
  State<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<ProductCard> {
  int _slide = 0;
  Timer? _timer;

  Product get product => widget.product;

  @override
  void initState() {
    super.initState();
    _startCarousel();
  }

  @override
  void didUpdateWidget(covariant ProductCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id ||
        oldWidget.product.gallery.length != widget.product.gallery.length) {
      _slide = 0;
      _startCarousel();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCarousel() {
    _timer?.cancel();
    final images = _images;
    if (images.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted) return;
      setState(() => _slide = (_slide + 1) % images.length);
    });
  }

  List<String> get _images => [
        ...product.gallery,
        if (product.gallery.isEmpty && product.image != null) product.image!,
      ].where((v) => v.isNotEmpty && v != '/placeholder.svg').toSet().toList();

  String _fmtPrice(num n) => '\$${n.toStringAsFixed(2)}';

  String _fmtSold(int n) => n >= 1000
      ? '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}k+ sold'
      : '$n sold';

  ({String range})? _estimateDeliveryDate(String? leadTime) {
    if (leadTime == null || leadTime == '—') return (range: _deliveryRange(1, 7));
    final s = leadTime.toLowerCase();
    final nums = RegExp(r'\d+').allMatches(s).map((m) => int.parse(m.group(0)!)).toList();
    var minDays = nums.isNotEmpty ? nums[0] : 3;
    var maxDays = nums.length > 1 ? nums[1] : minDays + 4;
    if (s.contains('week')) {
      minDays *= 7;
      maxDays *= 7;
    } else if (s.contains('month')) {
      minDays *= 30;
      maxDays *= 30;
    } else if (s.contains('hour') || s.contains('hr')) {
      minDays = 1;
      maxDays = 2;
    }
    return (range: _deliveryRange(minDays, maxDays));
  }

  String _deliveryRange(int minDays, int maxDays) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    String fmt(DateTime d) => '${months[d.month - 1]} ${d.day}';
    final now = DateTime.now();
    return '${fmt(now.add(Duration(days: minDays)))} – ${fmt(now.add(Duration(days: maxDays)))}';
  }

  Duration? get _remaining {
    final raw = product.dealEndsAt;
    if (raw == null) return null;
    final end = DateTime.tryParse(raw)?.toLocal();
    if (end == null) return null;
    final left = end.difference(DateTime.now());
    return left.isNegative ? null : left;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.variant == 'compact') return _compact(context);
    return _grid(context);
  }

  Widget _imageStack({required bool compact}) {
    final images = _images;
    final remaining = _remaining;
    return AspectRatio(
      aspectRatio: 1,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Container(color: AppColors.mutedSurface),
          if (images.isNotEmpty)
            for (var i = 0; i < images.length; i++)
              AnimatedOpacity(
                opacity: i == _slide ? 1 : 0,
                duration: const Duration(milliseconds: 700),
                child: CachedNetworkImage(
                  imageUrl: images[i],
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: AppColors.mutedSurface),
                  errorWidget: (_, __, ___) => Container(color: AppColors.mutedSurface),
                ),
              ),
          if (!compact && _displayBadge != null) Positioned(top: 8, left: 8, child: _badge(_displayBadge!)),
          if (product.adHasReel)
            Positioned(
              top: compact ? (product.discountPct > 0 ? 28 : 6) : (_displayBadge != null ? 36 : 8),
              left: compact ? 6 : 8,
              child: _reelBadge(compact),
            ),
          if (product.discountPct > 0)
            Positioned(
              top: compact ? 6 : 8,
              right: compact ? null : 42,
              left: compact ? 6 : null,
              child: _discountBadge(),
            ),
          if (product.moq > 1)
            Positioned(
              bottom: compact ? 6 : 8,
              left: compact ? 6 : 8,
              child: _moqBadge(compact),
            ),
          Positioned(
            top: compact ? 6 : 8,
            right: compact ? 6 : 8,
            child: Row(
              children: [
                _roundIcon(LucideIcons.send, widget.onShare),
                SizedBox(width: compact ? 4 : 6),
                _roundIcon(LucideIcons.heart, widget.onWishlist),
              ],
            ),
          ),
          if (remaining != null)
            Positioned(
              bottom: compact ? 6 : 8,
              left: compact ? 6 : 8,
              right: compact ? 6 : 8,
              child: _countdown(remaining, compact),
            ),
        ],
      ),
    );
  }

  String? get _displayBadge {
    final b = product.badge;
    if (b == null || b.toLowerCase().startsWith('imported')) return null;
    return b;
  }

  Widget _grid(BuildContext context) {
    final d = _estimateDeliveryDate(product.leadTime);
    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: widget.onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.md),
            boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 10, offset: Offset(0, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _imageStack(compact: false),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, height: 1.18)),
                    if (product.description.isNotEmpty && product.title.length < 45)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(product.description,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: AppColors.muted, height: 1.15)),
                      ),
                    const SizedBox(height: 6),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.end,
                      spacing: 6,
                      runSpacing: 2,
                      children: [
                        Text(_fmtPrice(product.price),
                            style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: AppColors.destructive,
                                height: 0.95)),
                        Text('/${product.unit}',
                            style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w700)),
                        if (product.originalPrice != null)
                          Text(_fmtPrice(product.originalPrice!),
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.muted,
                                  decoration: TextDecoration.lineThrough)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _tradeAssurance(),
                        _paymentChip('EC', const Color(0xFFE2231A), Colors.white),
                        _iconPaymentChip(LucideIcons.creditCard, AppColors.foreground, AppColors.background),
                        _paymentChip('PP', const Color(0xFF003087), Colors.white),
                        _iconPaymentChip(LucideIcons.smartphone, AppColors.primary.withOpacity(0.15), AppColors.primary),
                        _iconPaymentChip(LucideIcons.wallet, AppColors.warning.withOpacity(0.15), AppColors.warning),
                        _iconPaymentChip(LucideIcons.banknote, AppColors.mutedSurface, AppColors.foreground.withOpacity(0.7)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(LucideIcons.star, size: 12, color: AppColors.warning),
                        const SizedBox(width: 3),
                        Text(product.rating.toStringAsFixed(1),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        const Text(' · ', style: TextStyle(fontSize: 11, color: AppColors.muted)),
                        Flexible(
                          child: Text(_fmtSold(product.sold),
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                        ),
                      ],
                    ),
                    if (d != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            const Icon(LucideIcons.truck, size: 12, color: AppColors.primary),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text('Get it ${d.range}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                    if (product.supplierLocation != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          children: [
                            const Icon(LucideIcons.mapPin, size: 12, color: AppColors.primary),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(product.supplierLocation!,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                            ),
                            const Icon(LucideIcons.map, size: 12, color: AppColors.primary),
                            const SizedBox(width: 2),
                            const Text('Map', style: TextStyle(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    if (product.freeShipping || product.supplierVerified == true || product.supplierGold == true)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 2,
                          children: [
                            if (product.supplierVerified == true) _tinyMeta(LucideIcons.shieldCheck, 'Verified', AppColors.primary),
                            if (product.supplierGold == true) _tinyMeta(LucideIcons.award, 'Gold', AppColors.warning),
                            if (product.freeShipping) _tinyMeta(LucideIcons.truck, 'Free', AppColors.primary),
                          ],
                        ),
                      ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      height: 32,
                      child: FilledButton.icon(
                        onPressed: widget.onAdd,
                        icon: const Icon(LucideIcons.plus, size: 14),
                        label: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.foreground,
                          foregroundColor: AppColors.background,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.sm)),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _compact(BuildContext context) {
    final d = _estimateDeliveryDate(product.leadTime);
    return SizedBox(
      width: 144,
      child: InkWell(
        onTap: widget.onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(borderRadius: BorderRadius.circular(AppRadii.md), child: _imageStack(compact: true)),
            const SizedBox(height: 6),
            RichText(
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              text: TextSpan(
                text: _fmtPrice(product.price),
                style: const TextStyle(fontSize: 12, color: AppColors.destructive, fontWeight: FontWeight.w900),
                children: [
                  TextSpan(
                    text: '/${product.unit}',
                    style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            Text(product.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, height: 1.12)),
            if (d != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    const Icon(LucideIcons.truck, size: 10, color: AppColors.muted),
                    const SizedBox(width: 2),
                    Expanded(child: Text(d.range, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: AppColors.muted))),
                  ],
                ),
              ),
            if (product.supplierLocation != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 10, color: AppColors.muted),
                    const SizedBox(width: 2),
                    Expanded(child: Text(product.supplierLocation!, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, color: AppColors.muted))),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _roundIcon(IconData icon, VoidCallback? onPressed) => GestureDetector(
        onTap: onPressed,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.background.withOpacity(0.86),
            shape: BoxShape.circle,
            boxShadow: const [BoxShadow(color: Color(0x18000000), blurRadius: 8, offset: Offset(0, 2))],
          ),
          child: Icon(icon, size: 16, color: AppColors.foreground),
        ),
      );

  Widget _badge(String text) {
    final color = switch (text) {
      'Hot' => AppColors.destructive,
      'New' => AppColors.primary,
      'Deal' => AppColors.foreground,
      'Top' => AppColors.warning,
      _ => AppColors.foreground,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w900)),
    );
  }

  Widget _discountBadge() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(4)),
        child: Text('-${product.discountPct}%', style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w900)),
      );

  Widget _reelBadge(bool compact) => Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: 3),
        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.sparkles, size: compact ? 10 : 12, color: Colors.white),
          const SizedBox(width: 3),
          Text('Reel', style: TextStyle(fontSize: compact ? 9 : 10, color: Colors.white, fontWeight: FontWeight.w900)),
        ]),
      );

  Widget _moqBadge(bool compact) => Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.background.withOpacity(0.9),
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.package, size: compact ? 10 : 12),
          const SizedBox(width: 3),
          Text('MOQ ${product.moq}${compact ? '' : ' ${product.unit}'}',
              style: TextStyle(fontSize: compact ? 9 : 10, fontWeight: FontWeight.w900)),
        ]),
      );

  Widget _countdown(Duration remaining, bool compact) {
    final h = remaining.inHours;
    final m = remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = remaining.inSeconds.remainder(60).toString().padLeft(2, '0');
    final urgent = remaining.inMinutes < 60;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 6 : 8, vertical: compact ? 3 : 5),
      decoration: BoxDecoration(
        color: urgent ? AppColors.destructive : AppColors.foreground.withOpacity(0.86),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(LucideIcons.timer, size: compact ? 11 : 12, color: AppColors.background),
        const SizedBox(width: 4),
        Flexible(
          child: Text('${compact ? '' : 'Ends in '}${h > 0 ? '${h}h ' : ''}$m:$s',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: compact ? 10 : 10, color: AppColors.background, fontWeight: FontWeight.w900)),
        ),
      ]),
    );
  }

  Widget _tradeAssurance() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.success.withOpacity(0.1),
          border: Border.all(color: AppColors.success.withOpacity(0.2)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(LucideIcons.shieldCheck, size: 12, color: Color(0xFF047857)),
          SizedBox(width: 2),
          Text('Trade Assurance', style: TextStyle(fontSize: 9, color: Color(0xFF047857), fontWeight: FontWeight.w900)),
        ]),
      );

  Widget _paymentChip(String text, Color bg, Color fg) => Container(
        width: 20,
        height: 16,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(3)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 8, fontWeight: FontWeight.w900, height: 1)),
      );

  Widget _iconPaymentChip(IconData icon, Color bg, Color fg) => Container(
        width: 20,
        height: 16,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(3)),
        child: Icon(icon, size: 12, color: fg),
      );

  Widget _tinyMeta(IconData icon, String text, Color color) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 2),
        Text(text, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w700)),
      ]);
}
