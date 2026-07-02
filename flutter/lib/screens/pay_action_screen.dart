import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/palette.dart';

/// Mirrors `src/pages/PayAction.tsx` — final confirmation step before
/// executing a wallet transfer / top-up / withdraw.
class PayActionScreen extends StatefulWidget {
  const PayActionScreen({super.key, required this.action, required this.amount, this.recipient, this.reference});
  final String action; // 'topup' | 'send' | 'withdraw' | 'pay'
  final double amount;
  final String? recipient;
  final String? reference;

  @override
  State<PayActionScreen> createState() => _PayActionScreenState();
}

class _PayActionScreenState extends State<PayActionScreen> {
  bool _processing = false;
  bool _done = false;

  Future<void> _confirm() async {
    setState(() => _processing = true);
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() { _processing = false; _done = true; });
  }

  String get _title => switch (widget.action) {
        'topup' => 'Top up wallet',
        'send' => 'Send money',
        'withdraw' => 'Withdraw funds',
        _ => 'Confirm payment',
      };

  IconData get _icon => switch (widget.action) {
        'topup' => LucideIcons.plusCircle,
        'send' => LucideIcons.send,
        'withdraw' => LucideIcons.arrowDownToLine,
        _ => LucideIcons.creditCard,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _done ? _Success(title: _title) : _Form(icon: _icon, action: widget.action, amount: widget.amount, recipient: widget.recipient, reference: widget.reference, processing: _processing, onConfirm: _confirm),
      ),
    );
  }
}

class _Form extends StatelessWidget {
  const _Form({required this.icon, required this.action, required this.amount, required this.recipient, required this.reference, required this.processing, required this.onConfirm});
  final IconData icon;
  final String action;
  final double amount;
  final String? recipient;
  final String? reference;
  final bool processing;
  final VoidCallback onConfirm;
  @override
  Widget build(BuildContext context) => Column(children: [
        Container(width: 88, height: 88, decoration: BoxDecoration(color: AppColors.primary.withOpacity(.1), borderRadius: BorderRadius.circular(24)), child: Icon(icon, color: AppColors.primary, size: 40)),
        const SizedBox(height: 20),
        Text('\$${amount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900)),
        if (recipient != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('to $recipient', style: const TextStyle(color: AppColors.muted))),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            _row('Amount', '\$${amount.toStringAsFixed(2)}'),
            _row('Fee', '\$0.00'),
            const Divider(),
            _row('Total', '\$${amount.toStringAsFixed(2)}', bold: true),
            if (reference != null) _row('Reference', reference!),
          ]),
        ),
        const Spacer(),
        FilledButton(
          onPressed: processing ? null : onConfirm,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: AppColors.orange),
          child: processing ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Confirm', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ),
      ]);

  Widget _row(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(k, style: TextStyle(color: bold ? AppColors.foreground : AppColors.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w700)),
        ]),
      );
}

class _Success extends StatelessWidget {
  const _Success({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(width: 108, height: 108, decoration: BoxDecoration(color: AppColors.success.withOpacity(.15), borderRadius: BorderRadius.circular(28)), child: const Icon(LucideIcons.check, color: AppColors.success, size: 56)),
        const SizedBox(height: 20),
        Text('$title successful', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        const Text('A receipt will appear in your wallet history.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 32),
        FilledButton(onPressed: () => Navigator.of(context).pop(), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)), child: const Text('Done')),
      ]);
}
