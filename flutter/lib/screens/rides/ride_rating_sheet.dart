import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

Future<void> showRideRatingSheet(
  BuildContext context, {
  required String rideId,
  required String raterId,
  required String rateeId,
  required String direction, // rider_to_driver | driver_to_rider
  required String rateeName,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _RatingSheet(
      rideId: rideId,
      raterId: raterId,
      rateeId: rateeId,
      direction: direction,
      rateeName: rateeName,
    ),
  );
}

class _RatingSheet extends StatefulWidget {
  const _RatingSheet({
    required this.rideId,
    required this.raterId,
    required this.rateeId,
    required this.direction,
    required this.rateeName,
  });
  final String rideId;
  final String raterId;
  final String rateeId;
  final String direction;
  final String rateeName;

  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  int _stars = 5;
  final _comment = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await supabase.from('ride_ratings').insert({
        'ride_id': widget.rideId,
        'rater_id': widget.raterId,
        'ratee_id': widget.rateeId,
        'direction': widget.direction,
        'stars': _stars,
        'comment': _comment.text.trim().isEmpty ? null : _comment.text.trim(),
      });
      if (!mounted) return;
      Navigator.of(context).maybePop();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thanks for the feedback!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('TRIP COMPLETE', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
        const SizedBox(height: 4),
        Text('How was your trip with ${widget.rateeName}?', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 1; i <= 5; i++)
            IconButton(
              onPressed: () => setState(() => _stars = i),
              icon: Icon(LucideIcons.star,
                  size: 34,
                  color: i <= _stars ? Colors.amber : AppColors.muted),
            ),
        ]),
        TextField(
          controller: _comment,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: 'Add a comment (optional)',
            filled: true, fillColor: AppColors.mutedSurface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy ? null : _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14)),
          child: Text(_busy ? 'Submitting…' : 'Submit rating', style: const TextStyle(fontWeight: FontWeight.w900)),
        ),
        TextButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Skip for now')),
      ]),
    );
  }
}
