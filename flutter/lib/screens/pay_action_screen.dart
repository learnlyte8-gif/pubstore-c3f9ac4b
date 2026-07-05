import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../services/wallet_service.dart';
import '../theme/palette.dart';
import 'wallet_screen.dart';

/// Mirrors `src/pages/PayAction.tsx` — pay a service action (stay booking,
/// car rental, property inquiry, finance app, vehicle inquiry, service /
/// logistics bid, shared trip seat) from the PUBSTORE wallet.
class PayActionScreen extends ConsumerStatefulWidget {
  const PayActionScreen({super.key, required this.kind, required this.id});
  final String kind;
  final String id;

  @override
  ConsumerState<PayActionScreen> createState() => _PayActionScreenState();
}

class _PayInfo {
  _PayInfo({
    required this.title,
    required this.amount,
    required this.status,
    required this.paid,
    this.supplier,
  });
  final String title;
  final double amount;
  final String status;
  final bool paid;
  final String? supplier;
}

const _kindLabels = <String, String>{
  'stay': 'Stay booking',
  'car-rental': 'Car rental',
  'property': 'Property inquiry',
  'finance': 'Finance application',
  'vehicle': 'Vehicle inquiry',
  'service-bid': 'Service bid',
  'logistics-bid': 'Courier bid',
  'shared-trip-seat': 'Ride-share seat',
};

const _unlockedStatuses = {
  'accepted',
  'approved',
  'confirmed',
  'awarded',
  'assigned',
};

class _PayActionScreenState extends ConsumerState<PayActionScreen> {
  _PayInfo? _info;
  bool _loading = true;
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<_PayInfo?> _loadInfo(String kind, String id) async {
    try {
      switch (kind) {
        case 'stay':
          final d = await supabase
              .from('stay_bookings')
              .select('total,status,paid,stays(title,suppliers(name))')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          final stay = (d['stays'] as Map?) ?? const {};
          final sup = (stay['suppliers'] as Map?) ?? const {};
          return _PayInfo(
            title: (stay['title'] ?? 'Stay') as String,
            amount: ((d['total'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
            supplier: sup['name'] as String?,
          );
        case 'car-rental':
          final d = await supabase
              .from('car_rental_bookings')
              .select('estimated_total,status,paid,car_rentals(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['car_rentals'] as Map?)?['title'] ?? 'Car rental') as String,
            amount: ((d['estimated_total'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'property':
          final d = await supabase
              .from('property_inquiries')
              .select('amount_due,status,paid,properties(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['properties'] as Map?)?['title'] ?? 'Property') as String,
            amount: ((d['amount_due'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'finance':
          final d = await supabase
              .from('finance_applications')
              .select('amount_due,status,paid,finance_products(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['finance_products'] as Map?)?['title'] ?? 'Finance product') as String,
            amount: ((d['amount_due'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'vehicle':
          final d = await supabase
              .from('vehicle_inquiries')
              .select('amount_due,status,paid,vehicles(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['vehicles'] as Map?)?['title'] ?? 'Vehicle') as String,
            amount: ((d['amount_due'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'service-bid':
          final d = await supabase
              .from('service_bids')
              .select('price,status,paid,service_requests(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['service_requests'] as Map?)?['title'] ?? 'Service') as String,
            amount: ((d['price'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'logistics-bid':
          final d = await supabase
              .from('logistics_bids')
              .select('fare,status,paid,logistics_requests(title)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          return _PayInfo(
            title: ((d['logistics_requests'] as Map?)?['title'] ?? 'Delivery') as String,
            amount: ((d['fare'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
        case 'shared-trip-seat':
          final d = await supabase
              .from('shared_trip_joins')
              .select('amount_due,status,paid,seats,shared_trips(dest_address,seat_price)')
              .eq('id', id)
              .maybeSingle();
          if (d == null) return null;
          final trip = (d['shared_trips'] as Map?) ?? const {};
          final seats = ((d['seats'] ?? 1) as num).toInt();
          return _PayInfo(
            title: '$seats seat${seats > 1 ? 's' : ''} → ${trip['dest_address'] ?? 'shared trip'}',
            amount: ((d['amount_due'] ?? 0) as num).toDouble(),
            status: (d['status'] ?? '') as String,
            paid: (d['paid'] ?? false) as bool,
          );
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final info = await _loadInfo(widget.kind, widget.id);
    if (!mounted) return;
    setState(() {
      _info = info;
      _loading = false;
    });
  }

  Future<void> _pay() async {
    final info = _info;
    if (info == null) return;
    final balance = ref.read(walletBalanceProvider);
    if (balance < info.amount) {
      _snack('Wallet balance is too low. Please top up first.');
      if (mounted) {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WalletScreen()));
      }
      return;
    }
    setState(() => _paying = true);
    try {
      await supabase.rpc('pay_service_action_with_wallet', params: {
        '_kind': widget.kind,
        '_record_id': widget.id,
      });
      _snack('Payment successful');
      await ref.read(walletBalanceProvider.notifier).refresh();
      await _load();
    } catch (e) {
      _snack(e.toString());
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final label = _kindLabels[widget.kind] ?? 'Service';
    final balance = ref.watch(walletBalanceProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Pay with PUBSTORE Pay')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: _loading
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Skeletons.list(count: 4),
                )
              : _info == null
                  ? const Text(
                      "Record not found or you don't have access.",
                      style: TextStyle(color: AppColors.muted),
                    )
                  : _buildBody(label, balance),
        ),
      ),
    );
  }

  Widget _buildBody(String label, double balance) {
    final info = _info!;
    final unlocked = _unlockedStatuses.contains(info.status);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          const Icon(LucideIcons.wallet, color: AppColors.primary),
          const SizedBox(width: 8),
          Text(label.toUpperCase(),
              style: const TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w800, letterSpacing: 1)),
        ]),
        const SizedBox(height: 8),
        Text(info.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        if (info.supplier != null) Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(info.supplier!, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            _row('Amount due', '\$${info.amount.toStringAsFixed(2)}'),
            const SizedBox(height: 6),
            _row('Your wallet', '\$${balance.toStringAsFixed(2)}',
                valueColor: balance < info.amount ? AppColors.danger : null),
          ]),
        ),
        const SizedBox(height: 16),
        if (info.paid)
          Row(children: const [
            Icon(LucideIcons.checkCircle2, color: AppColors.success, size: 18),
            SizedBox(width: 6),
            Text('Payment received. Thank you!', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.success)),
          ])
        else if (!unlocked)
          Text(
            'This ${label.toLowerCase()} is currently ${info.status}. Payment unlocks once the supplier accepts.',
            style: const TextStyle(color: AppColors.muted, fontSize: 13),
          )
        else if (balance < info.amount)
          FilledButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WalletScreen())),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: const Text('Top up wallet'),
          )
        else
          FilledButton(
            onPressed: _paying ? null : _pay,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppColors.orange),
            child: _paying
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Pay \$${info.amount.toStringAsFixed(2)} now',
                    style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
      ],
    );
  }

  Widget _row(String k, String v, {Color? valueColor}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          Text(v, style: TextStyle(fontWeight: FontWeight.w800, color: valueColor)),
        ],
      );
}
