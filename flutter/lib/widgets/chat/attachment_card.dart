import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../models/message_models.dart';
import '../../theme/palette.dart';

/// Renders the small preview cards attached to chat messages.
/// Mirrors `src/components/chat/AttachmentCard.tsx`.
class AttachmentCard extends StatelessWidget {
  const AttachmentCard({super.key, required this.attachment, required this.mine});
  final ChatAttachment attachment;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final d = attachment.data;
    switch (attachment.kind) {
      case 'product':
        return _card(
          title: (d['title'] ?? 'Product').toString(),
          subtitle: d['price'] != null ? '\$${d['price']}' : null,
          image: d['image']?.toString(),
          icon: LucideIcons.package,
        );
      case 'supplier':
        return _card(
          title: (d['name'] ?? 'Supplier').toString(),
          subtitle: d['location']?.toString(),
          image: d['logo']?.toString(),
          icon: LucideIcons.store,
        );
      case 'wishlist':
        return _card(
          title: 'Wishlist',
          subtitle: '${d['count'] ?? 0} items shared',
          icon: LucideIcons.heart,
        );
      case 'cart-unlock':
        return _card(
          title: 'Cart unlocked',
          subtitle: d['title']?.toString(),
          icon: LucideIcons.check,
        );
      case 'catalog':
        return _card(
          title: 'Catalog',
          subtitle: '${d['count'] ?? 0} items',
          icon: LucideIcons.grid,
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _card({
    required String title,
    String? subtitle,
    String? image,
    required IconData icon,
  }) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 260),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: mine ? const Color(0x1A3B82F6) : AppColors.mutedSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 44,
              height: 44,
              child: image != null
                  ? CachedNetworkImage(imageUrl: image, fit: BoxFit.cover)
                  : Container(
                      color: AppColors.background,
                      child: Icon(icon, size: 18, color: AppColors.muted),
                    ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.foreground)),
              if (subtitle != null)
                Text(subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
          ),
        ]),
      ),
    );
  }
}
