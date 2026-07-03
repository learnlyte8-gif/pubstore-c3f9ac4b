import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/palette.dart';

/// Reusable shimmer skeletons that mimic real content layouts.
/// Use these instead of `CircularProgressIndicator` for a native feel.
class Skeletons {
  Skeletons._();

  static Widget wrap({required Widget child}) => Shimmer.fromColors(
        baseColor: const Color(0xFFE9EDF2),
        highlightColor: const Color(0xFFF7F8FA),
        period: const Duration(milliseconds: 1200),
        child: child,
      );

  static Widget box({double? w, double? h, double r = 8}) => Container(
        width: w,
        height: h,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(r),
        ),
      );

  static Widget line({double w = 120, double h = 10, double r = 6}) =>
      box(w: w, h: h, r: r);

  /// A staggered product card placeholder used inside masonry grids.
  static Widget productCard({double aspect = 0.75}) => Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AspectRatio(
            aspectRatio: aspect,
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              child: box(r: 0),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              line(w: double.infinity, h: 10),
              const SizedBox(height: 6),
              line(w: 100, h: 10),
              const SizedBox(height: 10),
              line(w: 70, h: 14),
              const SizedBox(height: 6),
              Row(children: [line(w: 30, h: 8), const SizedBox(width: 6), line(w: 50, h: 8)]),
            ]),
          ),
        ]),
      );

  /// Grid of product-card skeletons. Wrap externally in [wrap].
  static Widget productGrid({int count = 6, int columns = 2}) => wrap(
        child: GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.62,
          ),
          itemCount: count,
          itemBuilder: (_, i) => productCard(aspect: i.isEven ? 0.75 : 0.9),
        ),
      );

  /// Horizontal strip of product cards (e.g. New arrivals).
  static Widget productStrip({int count = 6, double height = 200, double width = 140}) => wrap(
        child: SizedBox(
          height: height,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: count,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, __) => SizedBox(width: width, child: productCard(aspect: 1)),
          ),
        ),
      );

  /// Category chip row.
  static Widget chipRow({int count = 6}) => wrap(
        child: SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: count,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, __) => box(w: 88, h: 32, r: 20),
          ),
        ),
      );

  /// Generic list of rows (avatar + two lines).
  static Widget list({int count = 8, double avatarSize = 44, EdgeInsets padding = const EdgeInsets.all(12)}) =>
      wrap(
        child: ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: padding,
          itemCount: count,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (_, __) => Row(children: [
            box(w: avatarSize, h: avatarSize, r: avatarSize / 2),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                line(w: double.infinity, h: 10),
                const SizedBox(height: 8),
                line(w: 160, h: 8),
              ]),
            ),
            const SizedBox(width: 12),
            box(w: 40, h: 14, r: 6),
          ]),
        ),
      );

  /// Message thread bubbles.
  static Widget chatBubbles({int count = 6}) => wrap(
        child: ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(12),
          itemCount: count,
          itemBuilder: (_, i) {
            final me = i.isOdd;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                mainAxisAlignment: me ? MainAxisAlignment.end : MainAxisAlignment.start,
                children: [box(w: 180 + (i * 12) % 90, h: 44, r: 16)],
              ),
            );
          },
        ),
      );

  /// Product detail hero + info skeleton.
  static Widget productDetail() => wrap(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(aspectRatio: 1, child: box(r: 0)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              line(w: 220, h: 18),
              const SizedBox(height: 10),
              line(w: double.infinity, h: 12),
              const SizedBox(height: 6),
              line(w: 260, h: 12),
              const SizedBox(height: 18),
              line(w: 140, h: 26),
              const SizedBox(height: 18),
              Row(children: [
                box(w: 56, h: 56, r: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    line(w: 160, h: 12),
                    const SizedBox(height: 8),
                    line(w: 100, h: 10),
                  ]),
                ),
              ]),
              const SizedBox(height: 20),
              Row(children: [
                Expanded(child: box(h: 44, r: 12)),
                const SizedBox(width: 10),
                Expanded(child: box(h: 44, r: 12)),
              ]),
            ]),
          ),
        ]),
      );

  /// KPI stat row + generic tiles.
  static Widget kpiRow({int count = 3}) => wrap(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: List.generate(
              count,
              (i) => Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i == count - 1 ? 0 : 10),
                  child: box(h: 84, r: 14),
                ),
              ),
            ),
          ),
        ),
      );

  /// Full-screen scaffold body — pick a preset that matches the destination.
  static Widget screen(SkeletonPreset preset) {
    switch (preset) {
      case SkeletonPreset.grid:
        return productGrid();
      case SkeletonPreset.feed:
        return ListView(children: [
          const SizedBox(height: 12),
          chipRow(),
          const SizedBox(height: 12),
          productStrip(),
          const SizedBox(height: 12),
          productGrid(count: 6),
        ]);
      case SkeletonPreset.list:
        return list();
      case SkeletonPreset.chat:
        return chatBubbles();
      case SkeletonPreset.detail:
        return SingleChildScrollView(child: productDetail());
      case SkeletonPreset.dashboard:
        return ListView(children: [kpiRow(), const SizedBox(height: 8), list(count: 6)]);
    }
  }
}

enum SkeletonPreset { grid, feed, list, chat, detail, dashboard }
