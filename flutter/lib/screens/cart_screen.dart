import '../widgets/skeletons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/cart_service.dart';
import '../services/supabase_client.dart';
import '../services/wallet_service.dart';
import '../theme/palette.dart';
import 'addresses_screen.dart';
import 'auth_screen.dart';
import 'orders_screen.dart';
import 'verification_screen.dart';

/// Mirrors `src/pages/Cart.tsx` — supplier-grouped cart with address picker,
/// coupons, per-supplier delivery options, payment picker and sticky checkout.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});
  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

enum _Pay { wallet, pesepay, paypal, cod }

class _AddrRow {
  _AddrRow(this.id, this.recipient, this.line1, this.city, this.country, this.isDefault);
  final String id;
  final String recipient;
  final String line1;
  final String? city;
  final String? country;
  final bool isDefault;
}

class _Coupon {
  _Coupon({required this.id, required this.code, required this.supplierId, required this.discount});
  final String id;
  final String code;
  final String supplierId;
  final double discount;
}

class _DeliveryOption {
  _DeliveryOption({
    required this.id,
    required this.supplierId,
    required this.courierUserId,
    required this.label,
    required this.sub,
    required this.courier,
    required this.isDefault,
    this.isSelf = false,
  });
  final String id;
  final String supplierId;
  final String? courierUserId;
  final String label;
  final String sub;
  final Map<String, dynamic>? courier;
  final bool isDefault;
  final bool isSelf;
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final _couponCtrl = TextEditingController();
  List<_AddrRow> _addresses = [];
  String? _addressId;
  bool _placing = false;
  bool _validating = false;
  final List<_Coupon> _coupons = [];
  _Pay _payMethod = _Pay.wallet;

  Map<String, List<_DeliveryOption>> _optsBySupplier = {};
  final Map<String, String> _deliveryPicks = {};

  // Verification (COD gate)
  bool _verificationLoading = true;
  String _verificationStatus = 'none';
  bool get _isVerified => _verificationStatus == 'approved';

  @override
  void initState() {
    super.initState();
    _loadAddresses();
    _loadVerification();
    // wait one frame for cart to hydrate then fetch options
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadDeliveryOptions());
  }

  @override
  void dispose() {
    _couponCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final rows = await supabase
        .from('addresses')
        .select('id,recipient,line1,city,country,is_default')
        .eq('user_id', uid)
        .order('is_default', ascending: false);
    final list = (rows as List)
        .map((r) => _AddrRow(
              r['id'].toString(),
              (r['recipient'] ?? '').toString(),
              (r['line1'] ?? '').toString(),
              r['city']?.toString(),
              r['country']?.toString(),
              r['is_default'] == true,
            ))
        .toList();
    if (!mounted) return;
    setState(() {
      _addresses = list;
      _addressId ??= (list.where((a) => a.isDefault).isNotEmpty
              ? list.firstWhere((a) => a.isDefault)
              : (list.isNotEmpty ? list.first : null))
          ?.id;
    });
  }

  Future<void> _loadVerification() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      if (mounted) setState(() => _verificationLoading = false);
      return;
    }
    try {
      final row = await supabase
          .from('user_verifications')
          .select('status')
          .eq('user_id', uid)
          .maybeSingle();
      _verificationStatus = (row?['status'] ?? 'none').toString();
    } catch (_) {}
    if (mounted) setState(() => _verificationLoading = false);
  }

  Future<void> _loadDeliveryOptions() async {
    final lines = ref.read(cartProvider);
    final supplierIds =
        lines.map((l) => l.product.supplierId).where((s) => s.isNotEmpty).toSet().toList();
    if (supplierIds.isEmpty) return;
    try {
      final suppliers = await supabase
          .from('suppliers')
          .select('id, owner_id, name, logo')
          .inFilter('id', supplierIds);
      final ownerIds = (suppliers as List)
          .map((s) => s['owner_id']?.toString())
          .whereType<String>()
          .toList();
      final ownerCouriers = ownerIds.isEmpty
          ? <dynamic>[]
          : await supabase.from('courier_profiles').select('*').inFilter('user_id', ownerIds);
      final ownerMap = {
        for (final c in (ownerCouriers as List)) c['user_id'].toString(): Map<String, dynamic>.from(c as Map)
      };
      final parts = await supabase
          .from('supplier_courier_partnerships')
          .select('*')
          .inFilter('supplier_id', supplierIds)
          .eq('status', 'active');
      final partList = (parts as List).cast<Map>();
      final partCourierIds = partList.map((p) => p['courier_user_id']?.toString()).whereType<String>().toList();
      final partCouriers = partCourierIds.isEmpty
          ? <dynamic>[]
          : await supabase.from('courier_profiles').select('*').inFilter('user_id', partCourierIds);
      final partMap = {
        for (final c in (partCouriers as List)) c['user_id'].toString(): Map<String, dynamic>.from(c as Map)
      };

      final Map<String, List<_DeliveryOption>> result = {};
      for (final s in suppliers.cast<Map>()) {
        final sid = s['id'].toString();
        final opts = <_DeliveryOption>[];
        final selfCourier = ownerMap[s['owner_id']?.toString()];
        if (selfCourier != null) {
          opts.add(_DeliveryOption(
            id: 'self-$sid',
            supplierId: sid,
            courierUserId: selfCourier['user_id']?.toString(),
            label: '${s['name']} (self-delivery)',
            sub: _summarizeRate(selfCourier),
            courier: selfCourier,
            isDefault: true,
            isSelf: true,
          ));
        }
        for (final p in partList.where((p) => p['supplier_id']?.toString() == sid)) {
          final c = partMap[p['courier_user_id']?.toString()];
          if (c == null) continue;
          opts.add(_DeliveryOption(
            id: p['id'].toString(),
            supplierId: sid,
            courierUserId: p['courier_user_id']?.toString(),
            label: (c['company_name'] ?? c['display_name'] ?? 'Courier').toString(),
            sub: _summarizeRate(c),
            courier: c,
            isDefault: selfCourier == null && p['is_default'] == true,
          ));
        }
        if (opts.isEmpty) {
          opts.add(_DeliveryOption(
            id: 'flat-$sid',
            supplierId: sid,
            courierUserId: null,
            label: 'Standard shipping',
            sub: 'Flat \$4.99 · free over \$25',
            courier: null,
            isDefault: true,
          ));
        }
        result[sid] = opts;
      }
      if (!mounted) return;
      setState(() {
        _optsBySupplier = result;
        for (final sid in result.keys) {
          if (!_deliveryPicks.containsKey(sid)) {
            final defOpt = result[sid]!.firstWhere((o) => o.isDefault, orElse: () => result[sid]!.first);
            _deliveryPicks[sid] = defOpt.id;
          }
        }
      });
    } catch (_) {/* ignore */}
  }

  String _summarizeRate(Map<String, dynamic> c) {
    final base = (c['base_fee'] as num?)?.toDouble() ?? 4.99;
    final perKm = (c['per_km_fee'] as num?)?.toDouble() ?? 0;
    return 'Base \$${base.toStringAsFixed(2)} · \$${perKm.toStringAsFixed(2)}/km';
  }

  double _quoteShipping(_DeliveryOption? opt, double subtotal, int totalUnits) {
    if (opt == null || opt.courier == null) {
      return subtotal > 25 || subtotal == 0 ? 0 : 4.99;
    }
    final c = opt.courier!;
    final base = (c['base_fee'] as num?)?.toDouble() ?? 4.99;
    final perKm = (c['per_km_fee'] as num?)?.toDouble() ?? 0;
    final perKg = (c['per_kg_fee'] as num?)?.toDouble() ?? 0;
    const km = 5.0;
    final kg = totalUnits.clamp(1, 999).toDouble();
    return base + perKm * km + perKg * kg;
  }

  Map<String, ({double subtotal, List<CartLine> items})> _groupBySupplier(List<CartLine> lines) {
    final m = <String, ({double subtotal, List<CartLine> items})>{};
    for (final l in lines) {
      final sid = l.product.supplierId;
      final g = m[sid] ?? (subtotal: 0.0, items: <CartLine>[]);
      m[sid] = (subtotal: g.subtotal + l.product.price * l.qty, items: [...g.items, l]);
    }
    return m;
  }

  Future<void> _applyCoupon() async {
    final code = _couponCtrl.text.trim().toUpperCase();
    if (code.isEmpty) return;
    if (_coupons.any((c) => c.code == code)) {
      _toast('Coupon already applied');
      return;
    }
    setState(() => _validating = true);
    try {
      final list = await supabase.from('coupons').select('*').ilike('code', code);
      final now = DateTime.now();
      final groups = _groupBySupplier(ref.read(cartProvider));
      final valid = (list as List).cast<Map>().where((c) {
        if (c['active'] != true) return false;
        final exp = DateTime.tryParse(c['expires_at']?.toString() ?? '');
        if (exp != null && exp.isBefore(now)) return false;
        final maxUses = c['max_uses'];
        if (maxUses != null && (c['uses_count'] ?? 0) >= maxUses) return false;
        final g = groups[c['supplier_id']?.toString()];
        if (g == null) return false;
        if (g.subtotal < ((c['min_subtotal'] ?? 0) as num).toDouble()) return false;
        return true;
      }).firstOrNull;
      if (valid == null) {
        _toast('Invalid or inapplicable coupon');
        return;
      }
      final g = groups[valid['supplier_id'].toString()]!;
      final dv = (valid['discount_value'] as num).toDouble();
      final discount = valid['discount_type'] == 'percent'
          ? (g.subtotal * dv / 100).clamp(0, g.subtotal).toDouble()
          : dv.clamp(0, g.subtotal).toDouble();
      setState(() {
        _coupons.add(_Coupon(
          id: valid['id'].toString(),
          code: valid['code'].toString(),
          supplierId: valid['supplier_id'].toString(),
          discount: discount,
        ));
        _couponCtrl.clear();
      });
      _toast('Coupon ${valid['code']} applied · -\$${discount.toStringAsFixed(2)}');
    } catch (e) {
      _toast('Could not apply coupon');
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<List<Map<String, dynamic>>> _createOrders(String userId, String status) async {
    final addr = _addresses.firstWhere((a) => a.id == _addressId, orElse: () => _addresses.first);
    final shipTo = '${addr.recipient}, ${addr.line1}, ${addr.city ?? ''}, ${addr.country ?? ''}';
    final groups = _groupBySupplier(ref.read(cartProvider));
    final created = <Map<String, dynamic>>[];
    for (final entry in groups.entries) {
      final sid = entry.key;
      final g = entry.value;
      final coupon = _coupons.firstWhereOrNull((c) => c.supplierId == sid);
      final discount = coupon?.discount ?? 0;
      final afterDiscount = (g.subtotal - discount).clamp(0, double.infinity).toDouble();
      final opts = _optsBySupplier[sid] ?? [];
      final opt = opts.firstWhereOrNull((o) => o.id == _deliveryPicks[sid]);
      final units = g.items.fold<int>(0, (a, b) => a + b.qty);
      final ship = _quoteShipping(opt, afterDiscount, units);
      final total = afterDiscount + ship;
      final order = await supabase
          .from('orders')
          .insert({
            'buyer_id': userId,
            'supplier_id': sid,
            'address_id': _addressId,
            'ship_to': shipTo,
            'subtotal': g.subtotal,
            'shipping': ship,
            'discount': discount,
            'coupon_code': coupon?.code,
            'total': total,
            'status': status,
            'payment_method': _payMethod.name,
            'payment_status': _payMethod == _Pay.cod ? 'cod' : 'pending',
            'delivery_courier_user_id': opt?.courierUserId,
            'delivery_option_label': opt?.label,
          })
          .select('id,ref_code')
          .single();
      final itemRows = g.items
          .map((it) => {
                'order_id': order['id'],
                'product_id': it.product.id,
                'qty': it.qty,
                'unit_price': it.product.price,
                'title': it.product.title,
                'image': it.product.image,
              })
          .toList();
      await supabase.from('order_items').insert(itemRows);
      if (coupon != null) {
        await supabase.from('coupon_redemptions').insert({
          'coupon_id': coupon.id,
          'order_id': order['id'],
          'buyer_id': userId,
          'amount': coupon.discount,
        });
      }
      created.add({'id': order['id'], 'ref': order['ref_code'], 'total': total});
    }
    return created;
  }

  Future<void> _placeOrder(double total) async {
    final lines = ref.read(cartProvider);
    if (lines.isEmpty) return;
    final user = supabase.auth.currentUser;
    if (user == null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const AuthScreen()));
      return;
    }
    if (_addressId == null) {
      _toast('Add a shipping address first');
      Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesScreen()));
      return;
    }
    final wallet = ref.read(walletBalanceProvider);
    if (_payMethod == _Pay.wallet && wallet < total) {
      _toast('Insufficient PUBSTORE Pay balance');
      return;
    }
    if (_payMethod == _Pay.cod && !_isVerified) {
      _toast('Verification required for Cash on delivery');
      Navigator.push(context, MaterialPageRoute(builder: (_) => const VerificationScreen()));
      return;
    }
    setState(() => _placing = true);
    try {
      if (_payMethod == _Pay.wallet || _payMethod == _Pay.cod) {
        final created = await _createOrders(user.id, 'placed');
        if (_payMethod == _Pay.wallet) {
          for (final o in created) {
            await supabase.rpc('pay_order_with_wallet', params: {'_order_id': o['id']});
          }
          await ref.read(walletBalanceProvider.notifier).refresh();
        }
        await ref.read(cartProvider.notifier).clear();
        _toast(_payMethod == _Pay.cod ? 'Order placed · Pay on delivery' : 'Order placed');
        if (!mounted) return;
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const OrdersScreen()));
        return;
      }
      final created = await _createOrders(user.id, 'awaiting_payment');
      final orderIds = created.map((o) => o['id']).toList();
      final fn = _payMethod == _Pay.paypal ? 'paypal-create-order' : 'pesepay-create-payment';
      final res = await supabase.functions.invoke(fn, body: {
        'purpose': 'order',
        'orderIds': orderIds,
        'returnUrl': 'https://pubstore.app/orders',
      });
      final data = (res.data as Map?) ?? {};
      final url = (data['approveUrl'] ?? data['redirectUrl'])?.toString();
      if (url == null) throw Exception('No payment URL');
      await ref.read(cartProvider.notifier).clear();
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (mounted) Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const OrdersScreen()));
    } catch (e) {
      _toast('Could not start payment');
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  String _fmt(double n) => '\$${n.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    final lines = ref.watch(cartProvider);
    ref.listen(cartProvider, (_, __) => _loadDeliveryOptions());
    final groups = _groupBySupplier(lines);
    final totalDiscount = _coupons.fold<double>(0, (s, c) => s + c.discount);
    final cartTotal = lines.fold<double>(0, (s, l) => s + l.product.price * l.qty);
    final discountedSubtotal = (cartTotal - totalDiscount).clamp(0, double.infinity).toDouble();
    final Map<String, double> shipBySupplier = {};
    for (final e in groups.entries) {
      final opts = _optsBySupplier[e.key] ?? [];
      final opt = opts.firstWhereOrNull((o) => o.id == _deliveryPicks[e.key]);
      final coupon = _coupons.firstWhereOrNull((c) => c.supplierId == e.key);
      final afterDisc = (e.value.subtotal - (coupon?.discount ?? 0)).clamp(0, double.infinity).toDouble();
      final units = e.value.items.fold<int>(0, (a, b) => a + b.qty);
      shipBySupplier[e.key] = _quoteShipping(opt, afterDisc, units);
    }
    final shipping = shipBySupplier.values.fold<double>(0, (s, v) => s + v);
    final total = discountedSubtotal + shipping;
    final walletBalance = ref.watch(walletBalanceProvider);
    final selectedAddr = _addresses.firstWhereOrNull((a) => a.id == _addressId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(color: AppColors.foreground),
        iconTheme: const IconThemeData(color: AppColors.foreground),
        title: Text(
          'Cart (${lines.length})',
          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.foreground),
        ),
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        actions: [
          if (lines.isNotEmpty)
            TextButton(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              child: const Text('Clear all', style: TextStyle(color: AppColors.muted)),
            ),
        ],
      ),
      body: DefaultTextStyle.merge(
        style: const TextStyle(color: AppColors.foreground),
        child: lines.isEmpty
            ? _empty()
            : ListView(
                padding: const EdgeInsets.only(top: 8, bottom: 140),
                children: [
                  _addressCard(selectedAddr),
                  ...lines.map((l) => _lineTile(l)),
                  _couponCard(),
                  _deliveryCard(groups, shipBySupplier),
                  _paymentCard(walletBalance, total),
                  const SizedBox(height: 16),
                ],
              ),
      ),
      bottomNavigationBar: lines.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: const BoxDecoration(
                  color: AppColors.background,
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${totalDiscount > 0 ? 'Saved ${_fmt(totalDiscount)} · ' : ''}'
                          '${shipping == 0 ? 'Free shipping' : '+ ${_fmt(shipping)} ship'}',
                          style: const TextStyle(fontSize: 11, color: AppColors.muted),
                        ),
                        Text(_fmt(total),
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: _placing ? null : () => _placeOrder(total),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.primaryForeground,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: _placing
                        ? const SizedBox(
                            width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('Pay ${_fmt(total)}', style: const TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ]),
              ),
            ),
    );
  }

  Widget _empty() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 64),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(color: AppColors.mutedSurface, shape: BoxShape.circle),
            child: const Icon(LucideIcons.shoppingBag, color: AppColors.muted, size: 32),
          ),
          const SizedBox(height: 16),
          const Text('Your cart is empty',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Browse the marketplace and add items you love.',
              textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.primaryForeground,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
            ),
            child: const Text('Start shopping'),
          ),
        ],
      ),
    );
  }

  Widget _addressCard(_AddrRow? addr) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(LucideIcons.mapPin, size: 16, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: addr == null
              ? const Text('No shipping address set.',
                  style: TextStyle(fontSize: 12, color: AppColors.muted))
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(addr.recipient,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  Text('${addr.line1}, ${addr.city ?? ''}, ${addr.country ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
        ),
        TextButton(
          onPressed: () async {
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddressesScreen()));
            _loadAddresses();
          },
          child: Text(addr == null ? 'Add' : 'Change',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary)),
        ),
      ]),
    );
  }

  Widget _lineTile(CartLine l) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 72,
            height: 72,
            child: l.product.image != null
                ? CachedNetworkImage(imageUrl: l.product.image!, fit: BoxFit.cover)
                : Container(color: AppColors.mutedSurface),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.product.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Row(children: [
              Text(_fmt(l.product.price),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
              const Spacer(),
              _step(LucideIcons.minus, () => ref.read(cartProvider.notifier).setQty(l.product.id, l.qty - 1)),
              SizedBox(
                width: 28,
                child: Text('${l.qty}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              _step(LucideIcons.plus, () => ref.read(cartProvider.notifier).setQty(l.product.id, l.qty + 1)),
              IconButton(
                icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.muted),
                onPressed: () => ref.read(cartProvider.notifier).remove(l.product.id),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }

  Widget _step(IconData icon, VoidCallback onTap) {
    return InkResponse(
      onTap: onTap,
      radius: 20,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14),
      ),
    );
  }

  Widget _couponCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [
          Icon(LucideIcons.tag, size: 14, color: AppColors.primary),
          SizedBox(width: 6),
          Text('Discount code', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _couponCtrl,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'\s'))],
              decoration: InputDecoration(
                hintText: 'Enter code',
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onSubmitted: (_) => _applyCoupon(),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _validating ? null : _applyCoupon,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.foreground,
              foregroundColor: AppColors.background,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            child: Text(_validating ? '…' : 'Apply'),
          ),
        ]),
        if (_coupons.isNotEmpty) ...[
          const SizedBox(height: 8),
          ..._coupons.map((c) => Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0x1A10B981),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(children: [
                  const Icon(LucideIcons.checkCircle2, size: 14, color: Color(0xFF059669)),
                  const SizedBox(width: 6),
                  Text(c.code, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                  const Spacer(),
                  Text('-${_fmt(c.discount)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: const Icon(LucideIcons.x, size: 14),
                    onPressed: () => setState(() => _coupons.removeWhere((k) => k.id == c.id)),
                  ),
                ]),
              )),
        ],
      ]),
    );
  }

  Widget _deliveryCard(Map<String, ({double subtotal, List<CartLine> items})> groups, Map<String, double> ship) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [
          Icon(LucideIcons.truck, size: 14, color: AppColors.primary),
          SizedBox(width: 6),
          Text('Delivery options', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 8),
        ...groups.entries.map((e) {
          final sid = e.key;
          final supplierName = e.value.items.first.product.supplierName ?? 'Supplier';
          final fee = ship[sid] ?? 0;
          final opts = _optsBySupplier[sid] ?? [];
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text(supplierName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.muted)),
                ),
                Text(fee == 0 ? 'FREE' : _fmt(fee),
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.priceRed)),
              ]),
              const SizedBox(height: 6),
              ...opts.map((opt) {
                final active = _deliveryPicks[sid] == opt.id;
                return GestureDetector(
                  onTap: () => setState(() => _deliveryPicks[sid] = opt.id),
                  child: Container(
                    margin: const EdgeInsets.only(top: 6),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: active ? const Color(0x143B82F6) : AppColors.background,
                      border: Border.all(color: active ? AppColors.primary : AppColors.border, width: active ? 2 : 1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 16,
                        height: 16,
                        margin: const EdgeInsets.only(top: 2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: active ? AppColors.primary : Colors.transparent,
                          border: Border.all(color: active ? AppColors.primary : AppColors.muted, width: 2),
                        ),
                        child: active
                            ? const Center(
                                child: SizedBox(
                                    width: 6,
                                    height: 6,
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                                    )))
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Flexible(
                              child: Text(opt.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                            ),
                            if (opt.isSelf) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                    color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                                child: const Text('SELF',
                                    style: TextStyle(
                                        fontSize: 8, color: Colors.white, fontWeight: FontWeight.w900)),
                              ),
                            ] else if (opt.isDefault) ...[
                              const SizedBox(width: 4),
                              const Icon(LucideIcons.badgeCheck, size: 12, color: AppColors.primary),
                            ],
                          ]),
                          Text(opt.sub,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                        ]),
                      ),
                    ]),
                  ),
                );
              }),
            ]),
          );
        }),
      ]),
    );
  }

  Widget _paymentCard(double walletBalance, double total) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Payment method', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 2.6,
          children: [
            _payOption(_Pay.wallet, LucideIcons.wallet, 'PUBSTORE Pay',
                'Balance ${_fmt(walletBalance)}', insufficient: walletBalance < total),
            _payOption(_Pay.pesepay, LucideIcons.smartphone, 'Pesepay', 'EcoCash · OneMoney · Visa'),
            _payOption(_Pay.paypal, LucideIcons.creditCard, 'PayPal', 'Cards & PayPal'),
            _payOption(
              _Pay.cod,
              LucideIcons.banknote,
              'Cash on delivery',
              _verificationLoading
                  ? 'Checking eligibility…'
                  : _isVerified
                      ? 'Pay supplier on receipt'
                      : _verificationStatus == 'pending'
                          ? 'Verification pending'
                          : _verificationStatus == 'rejected'
                              ? 'Verification rejected'
                              : 'Verify ID to unlock',
              insufficient: !_verificationLoading && !_isVerified,
            ),
          ],
        ),
        if (_payMethod == _Pay.cod && !_verificationLoading && !_isVerified) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0x1AF59E0B),
              border: Border.all(color: const Color(0x4DF59E0B)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(LucideIcons.shieldCheck, size: 14, color: Color(0xFFD97706)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Verification required',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  const Text(
                      'Upload your government ID and proof of residency. A supplier will review and approve before you can pay on delivery.',
                      style: TextStyle(fontSize: 10, color: AppColors.muted)),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const VerificationScreen())),
                    child: Text(
                      _verificationStatus == 'pending'
                          ? 'View status'
                          : _verificationStatus == 'rejected'
                              ? 'Re-submit documents'
                              : 'Verify now →',
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                          decoration: TextDecoration.underline),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
        ],
        if (_payMethod == _Pay.pesepay) ...[
          const SizedBox(height: 8),
          const Text(
              "You'll be redirected to Pesepay to complete payment with EcoCash, OneMoney, ZIPIT or your Visa card.",
              style: TextStyle(fontSize: 10, color: AppColors.muted)),
        ],
      ]),
    );
  }

  Widget _payOption(_Pay method, IconData icon, String label, String sub, {bool insufficient = false}) {
    final active = _payMethod == method;
    return GestureDetector(
      onTap: () => setState(() => _payMethod = method),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: active ? const Color(0x143B82F6) : AppColors.background,
          border: Border.all(color: active ? AppColors.primary : AppColors.border, width: active ? 2 : 1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: active ? AppColors.primary : AppColors.mutedSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: active ? Colors.white : AppColors.foreground),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
              Text(insufficient ? 'Not enough balance' : sub,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 9,
                      color: insufficient ? AppColors.destructive : AppColors.muted,
                      fontWeight: insufficient ? FontWeight.w700 : FontWeight.w500)),
            ]),
          ),
        ]),
      ),
    );
  }
}

extension _FirstWhereOrNull<E> on Iterable<E> {
  E? firstWhereOrNull(bool Function(E) test) {
    for (final e in this) {
      if (test(e)) return e;
    }
    return null;
  }
}
