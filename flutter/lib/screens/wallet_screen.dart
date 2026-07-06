import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/vertical_models_ext.dart';
import '../services/supabase_client.dart';
import '../services/verticals_service.dart';
import '../services/wallet_service.dart';
import '../theme/palette.dart';
import 'auth_screen.dart';

/// Mirrors `src/pages/Wallet.tsx` — hero balances, top-up (Pesepay/PayPal),
/// manual EcoCash card, withdrawals list, move funds, transactions with tabs.
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});
  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

enum _Provider { ecocash, onemoney, visa, mastercard, paypal }

class _WalletScreenState extends ConsumerState<WalletScreen> {
  Future<WalletSummary>? _future;
  String _tab = 'all';
  _Provider _provider = _Provider.ecocash;
  final _customCtrl = TextEditingController();
  final _moveCtrl = TextEditingController();
  bool _redirecting = false;
  bool _moving = false;
  List<Map<String, dynamic>> _withdrawals = [];

  // Manual top-up
  Map<String, dynamic>? _manualCfg;
  final _amountCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  bool _submittingManual = false;
  List<Map<String, dynamic>> _myTopups = [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadWithdrawals();
    _loadManualCfg();
    _loadMyTopups();
  }

  @override
  void dispose() {
    _customCtrl.dispose();
    _moveCtrl.dispose();
    _amountCtrl.dispose();
    _refCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  void _load() {
    final uid = supabase.auth.currentUser?.id;
    if (uid != null) _future = verticals.fetchWallet(uid);
  }

  Future<void> _loadWithdrawals() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final rows = await supabase
          .from('withdrawal_requests')
          .select('*')
          .order('created_at', ascending: false)
          .limit(10);
      if (!mounted) return;
      setState(() => _withdrawals = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _loadManualCfg() async {
    try {
      final row = await supabase.from('platform_settings').select('value').eq('key', 'manual_topup').maybeSingle();
      final v = (row?['value'] as Map?) ?? {};
      if (!mounted) return;
      setState(() => _manualCfg = {
            'enabled': v['enabled'] != false,
            'number': (v['number'] ?? '').toString(),
            'name': (v['name'] ?? 'PUBSTORE').toString(),
            'instructions': (v['instructions'] ?? '').toString(),
          });
    } catch (_) {}
  }

  Future<void> _loadMyTopups() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    try {
      final rows = await supabase
          .from('manual_topups')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', ascending: false)
          .limit(5);
      if (!mounted) return;
      setState(() => _myTopups = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  String _fmt(num n) => '\$${n.toStringAsFixed(2)}';

  void _toast(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  void _openSendMoney() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _SendMoneySheet(onSent: () {
        setState(() {});
      }),
    );
  }

  Future<void> _startCheckout(double amount) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      _toast('Sign in first');
      return;
    }
    setState(() => _redirecting = true);
    try {
      final fn = _provider == _Provider.paypal ? 'paypal-create-order' : 'pesepay-create-payment';
      final res = await supabase.functions.invoke(fn, body: {
        'purpose': 'wallet_topup',
        'amount': amount,
        'returnUrl': 'https://pubstore.app/wallet',
        'cancelUrl': 'https://pubstore.app/wallet?cancelled=1',
      });
      final data = (res.data as Map?) ?? {};
      final url = (data['approveUrl'] ?? data['redirectUrl'])?.toString();
      if (url == null) throw Exception('No payment URL');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      _toast('Could not start checkout');
    } finally {
      if (mounted) setState(() => _redirecting = false);
    }
  }

  Future<void> _cancelWithdrawal(String id) async {
    try {
      await supabase.rpc('cancel_withdrawal_request', params: {'_id': id});
      _toast('Withdrawal cancelled — funds refunded');
      setState(_load);
      _loadWithdrawals();
      ref.read(walletBalanceProvider.notifier).refresh();
    } catch (e) {
      _toast('Could not cancel');
    }
  }

  Future<void> _moveFunds(double sales) async {
    final amt = double.tryParse(_moveCtrl.text) ?? 0;
    if (amt <= 0) {
      _toast('Enter an amount');
      return;
    }
    if (amt > sales) {
      _toast('Exceeds sales balance');
      return;
    }
    setState(() => _moving = true);
    try {
      await supabase.rpc('move_sales_to_personal', params: {'_amount': amt});
      _toast('Moved ${_fmt(amt)} to personal balance');
      _moveCtrl.clear();
      setState(_load);
      ref.read(walletBalanceProvider.notifier).refresh();
    } catch (e) {
      _toast('Could not move funds');
    } finally {
      if (mounted) setState(() => _moving = false);
    }
  }

  Future<void> _submitManual() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      _toast('Sign in first');
      return;
    }
    final amt = double.tryParse(_amountCtrl.text) ?? 0;
    if (amt < 1) {
      _toast('Enter the amount you sent');
      return;
    }
    if (_refCtrl.text.trim().isEmpty) {
      _toast('Enter the EcoCash confirmation reference');
      return;
    }
    setState(() => _submittingManual = true);
    try {
      await supabase.from('manual_topups').insert({
        'user_id': uid,
        'amount': amt,
        'reference': _refCtrl.text.trim(),
        'note': _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
        'platform_number': _manualCfg?['number'],
      });
      _toast("Submitted — we'll credit your balance once verified");
      _amountCtrl.clear();
      _refCtrl.clear();
      _noteCtrl.clear();
      _loadMyTopups();
    } catch (e) {
      _toast('Submission failed');
    } finally {
      if (mounted) setState(() => _submittingManual = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = supabase.auth.currentUser != null;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('PUBSTORE Pay', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: !signedIn
          ? _signedOut()
          : FutureBuilder<WalletSummary>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return Skeletons.list(count: 4);
                }
                final s = snap.data ??
                    WalletSummary(balance: 0, personal: 0, sales: 0, transactions: []);
                final txs = _tab == 'all'
                    ? s.transactions
                    : s.transactions.where((t) => t.account == _tab).toList();
                return RefreshIndicator(
                  onRefresh: () async {
                    setState(_load);
                    await _future;
                    await _loadWithdrawals();
                    await _loadMyTopups();
                    await ref.read(walletBalanceProvider.notifier).refresh();
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 40),
                    children: [
                      _hero(s),
                      if (_withdrawals.isNotEmpty) _withdrawalsCard(),
                      _addMoneyCard(),
                      if (_manualCfg != null && _manualCfg!['enabled'] == true) _manualCard(),
                      _perks(),
                      _moveFundsCard(s.sales),
                      _txHeader(),
                      if (txs.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: Text('No transactions yet', style: TextStyle(color: AppColors.muted))),
                        )
                      else
                        for (final t in txs) _txTile(t),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _signedOut() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.wallet, size: 40, color: AppColors.muted),
            const SizedBox(height: 12),
            const Text('Sign in to view your wallet.',
                style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AuthScreen())),
              child: const Text('Sign in'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero(WalletSummary s) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF3B82F6), Color(0xFF2563EB), Color(0xFF1E40AF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _glassCard(
          icon: LucideIcons.wallet,
          title: 'PERSONAL BALANCE',
          amount: s.personal,
          subtitle: 'Top-ups & transfers. Use at checkout on any product.',
          large: true,
        ),
        const SizedBox(height: 8),
        _glassCard(
          icon: LucideIcons.store,
          title: 'SALES BALANCE',
          amount: s.sales,
          subtitle: 'Earnings from sales. Withdraw or move to personal.',
        ),
        const SizedBox(height: 12),
        Row(children: [
          _heroBtn(LucideIcons.send, 'Send', filled: true, onTap: _openSendMoney),
          const SizedBox(width: 6),
          _heroBtn(LucideIcons.plus, 'Add', onTap: () {}),
          const SizedBox(width: 6),
          _heroBtn(LucideIcons.banknote, 'Withdraw', onTap: () => _toast('Withdraw — open dialog')),
          const SizedBox(width: 6),
          _heroBtn(LucideIcons.arrowRightLeft, 'Move', onTap: () {}),
        ]),
      ]),
    );
  }

  Widget _glassCard({
    required IconData icon,
    required String title,
    required double amount,
    required String subtitle,
    bool large = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.10),
        border: Border.all(color: Colors.white.withOpacity(0.20)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, size: 14, color: Colors.white.withOpacity(0.9)),
          const SizedBox(width: 6),
          Text(title,
              style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: Colors.white.withOpacity(0.9),
                  fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 6),
        Text(_fmt(amount),
            style: TextStyle(
                fontSize: large ? 36 : 28,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: -1)),
        const SizedBox(height: 6),
        Text(subtitle, style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.75))),
      ]),
    );
  }

  Widget _heroBtn(IconData icon, String label, {bool filled = false, required VoidCallback onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: filled ? Colors.white : Colors.white.withOpacity(0.15),
            border: filled ? null : Border.all(color: Colors.white.withOpacity(0.3)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 14, color: filled ? AppColors.primary : Colors.white),
            const SizedBox(width: 4),
            Text(label,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: filled ? AppColors.primary : Colors.white)),
          ]),
        ),
      ),
    );
  }

  Widget _withdrawalsCard() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 6),
          child: Text('WITHDRAWALS',
              style: TextStyle(
                  fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.muted)),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: _withdrawals.map((w) {
              final pending = w['status'] == 'pending';
              final paid = w['status'] == 'paid';
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5))),
                child: Row(children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: pending
                          ? const Color(0x1AF59E0B)
                          : paid
                              ? const Color(0x1A10B981)
                              : AppColors.mutedSurface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(pending ? LucideIcons.clock : LucideIcons.banknote,
                        size: 16,
                        color: pending
                            ? const Color(0xFFD97706)
                            : paid
                                ? const Color(0xFF059669)
                                : AppColors.muted),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${w['method'] ?? ''} · ${w['destination'] ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      Text('${w['account'] ?? 'personal'} · ${w['status']}',
                          style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                    ]),
                  ),
                  Text(_fmt(((w['amount'] ?? 0) as num).toDouble()),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  if (pending)
                    IconButton(
                      icon: const Icon(LucideIcons.xCircle, size: 16),
                      onPressed: () => _cancelWithdrawal(w['id'].toString()),
                    ),
                ]),
              );
            }).toList(),
          ),
        ),
      ]),
    );
  }

  Widget _addMoneyCard() {
    final brands = [
      (_Provider.ecocash, 'EcoCash', const Color(0xFFE30613)),
      (_Provider.onemoney, 'OneMoney', const Color(0xFFFFCB05)),
      (_Provider.visa, 'Visa', const Color(0xFF1A1F71)),
      (_Provider.mastercard, 'Mastercard', const Color(0xFF0A0A0A)),
      (_Provider.paypal, 'PayPal', const Color(0xFF003087)),
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [
          Icon(LucideIcons.plus, size: 16, color: AppColors.primary),
          SizedBox(width: 6),
          Text('Add money', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        ]),
        const SizedBox(height: 12),
        Row(
          children: brands.map((b) {
            final active = _provider == b.$1;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: GestureDetector(
                  onTap: () => setState(() => _provider = b.$1),
                  child: Container(
                    height: 60,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? const Color(0x143B82F6) : AppColors.card,
                      border: Border.all(
                          color: active ? AppColors.primary : AppColors.border,
                          width: active ? 2 : 1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(color: b.$3, borderRadius: BorderRadius.circular(6)),
                      ),
                      const SizedBox(height: 4),
                      Text(b.$2,
                          style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900),
                          overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 12),
        const Text('ENTER AMOUNT',
            style: TextStyle(
                fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.muted)),
        const SizedBox(height: 4),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _customCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
              decoration: const InputDecoration(
                prefixText: '\$ ',
                hintText: 'Min \$10.00',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _redirecting
                ? null
                : () {
                    final amt = double.tryParse(_customCtrl.text) ?? 0;
                    if (amt < 10) {
                      _toast('Minimum top-up is \$10.00');
                      return;
                    }
                    _startCheckout(amt);
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            ),
            child: _redirecting
                ? const SizedBox(
                    width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Add'),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: const [
          Icon(LucideIcons.shieldCheck, size: 12, color: AppColors.muted),
          SizedBox(width: 4),
          Text('Secure payments · instant balance update once cleared',
              style: TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
      ]),
    );
  }

  Widget _manualCard() {
    final cfg = _manualCfg!;
    final number = (cfg['number'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [
          Icon(LucideIcons.smartphone, size: 16, color: AppColors.primary),
          SizedBox(width: 6),
          Text('Manual EcoCash top-up', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        ]),
        const SizedBox(height: 6),
        const Text(
            'Send EcoCash to the platform number, then paste the confirmation reference here. Your PUBSTORE Pay balance will be credited once verified.',
            style: TextStyle(fontSize: 11, color: AppColors.muted)),
        const SizedBox(height: 10),
        if (number.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0x143B82F6),
              border: Border.all(color: const Color(0x4D3B82F6)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Send to ${cfg['name']}',
                      style: const TextStyle(
                          fontSize: 10,
                          letterSpacing: 1.1,
                          color: AppColors.muted,
                          fontWeight: FontWeight.w800)),
                  Text(number, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  if ((cfg['instructions'] ?? '').toString().isNotEmpty)
                    Text(cfg['instructions'].toString(),
                        style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
              ),
              TextButton(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: number));
                  _toast('Number copied');
                },
                child: const Text('Copy'),
              ),
            ]),
          )
        else
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0x1AF59E0B),
              border: Border.all(color: const Color(0x4DF59E0B)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text("Manual top-up isn't fully configured yet. Please try again later.",
                style: TextStyle(fontSize: 11)),
          ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount (USD)',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _refCtrl,
              decoration: const InputDecoration(
                labelText: 'Reference *',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        TextField(
          controller: _noteCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Note (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _submittingManual || number.isEmpty ? null : _submitManual,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.foreground,
              foregroundColor: AppColors.background,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            child: Text(_submittingManual ? 'Submitting…' : 'Submit for verification'),
          ),
        ),
        if (_myTopups.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Text('RECENT SUBMISSIONS',
              style: TextStyle(
                  fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.muted)),
          const SizedBox(height: 6),
          ..._myTopups.map((t) {
            final st = (t['status'] ?? '').toString();
            final Color color = st == 'approved'
                ? const Color(0xFF059669)
                : st == 'declined'
                    ? AppColors.destructive
                    : const Color(0xFFD97706);
            return Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Text(_fmt(((t['amount'] ?? 0) as num).toDouble()),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text('Ref ${t['reference']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                  child: Text(st, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w800)),
                ),
              ]),
            );
          }),
        ],
      ]),
    );
  }

  Widget _perks() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(children: [
        Expanded(child: _perk(LucideIcons.zap, 'One-tap checkout', 'Skip cards. Pay with balance.')),
        const SizedBox(width: 8),
        Expanded(child: _perk(LucideIcons.sparkles, 'No hidden fees', 'Every cent goes to your order.')),
      ]),
    );
  }

  Widget _perk(IconData icon, String title, String desc) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0x143B82F6),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(LucideIcons.zap, size: 16, color: AppColors.primary),
        ),
        const SizedBox(height: 6),
        Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        Text(desc, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      ]),
    );
  }

  Widget _moveFundsCard(double sales) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: const [
          Icon(LucideIcons.arrowRightLeft, size: 16, color: AppColors.primary),
          SizedBox(width: 6),
          Text('Move sales → personal', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        ]),
        const SizedBox(height: 4),
        Text('Sales balance: ${_fmt(sales)}',
            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _moveCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                prefixText: '\$ ',
                hintText: '0.00',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: sales <= 0 ? null : () => setState(() => _moveCtrl.text = sales.toStringAsFixed(2)),
            child: const Text('All'),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _moving || sales <= 0 ? null : () => _moveFunds(sales),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            child: _moving
                ? const SizedBox(
                    width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Move'),
          ),
        ]),
      ]),
    );
  }

  Widget _txHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Row(children: [
        const Text('ACTIVITY',
            style: TextStyle(
                fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.muted)),
        const Spacer(),
        Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(999)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: ['all', 'personal', 'sales'].map((t) {
              final active = _tab == t;
              return GestureDetector(
                onTap: () => setState(() => _tab = t),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: active ? AppColors.card : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(t,
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: active ? AppColors.foreground : AppColors.muted)),
                ),
              );
            }).toList(),
          ),
        ),
      ]),
    );
  }

  Widget _txTile(WalletTx t) {
    final positive = t.amount >= 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: positive ? const Color(0x1A10B981) : const Color(0x1AEF4444),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(positive ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight,
              size: 16, color: positive ? const Color(0xFF059669) : const Color(0xFFDC2626)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t.description.isEmpty ? t.type : t.description,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(
                '${t.account} · ${t.createdAt.year}-${t.createdAt.month.toString().padLeft(2, '0')}-${t.createdAt.day.toString().padLeft(2, '0')}',
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ),
        Text('${positive ? '+' : ''}${_fmt(t.amount)}',
            style: TextStyle(
                fontWeight: FontWeight.w900,
                color: positive ? const Color(0xFF059669) : const Color(0xFFDC2626))),
      ]),
    );
  }
}

class _SendMoneySheet extends StatefulWidget {
  const _SendMoneySheet({required this.onSent});
  final VoidCallback onSent;
  @override
  State<_SendMoneySheet> createState() => _SendMoneySheetState();
}

class _SendMoneySheetState extends State<_SendMoneySheet> {
  final _query = TextEditingController();
  final _amount = TextEditingController();
  final _note = TextEditingController();
  List<Map<String, dynamic>> _results = const [];
  Map<String, dynamic>? _selected;
  bool _busy = false;

  Future<void> _search() async {
    final q = _query.text.trim();
    if (q.length < 2) return;
    try {
      final rows = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .or('display_name.ilike.%$q%,username.ilike.%$q%')
          .limit(10);
      if (!mounted) return;
      setState(() => _results = (rows as List).cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _send() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final peer = _selected;
    if (peer == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick a recipient')));
      return;
    }
    final amt = double.tryParse(_amount.text.trim());
    if (amt == null || amt <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid amount')));
      return;
    }
    setState(() => _busy = true);
    try {
      // Best-effort RPC. Falls back to a paired wallet_transactions pair.
      try {
        await supabase.rpc('wallet_send_p2p', params: {
          'p_to_user': peer['user_id'],
          'p_amount': amt,
          'p_note': _note.text.trim(),
        });
      } catch (_) {
        await supabase.from('wallet_transactions').insert([
          {
            'user_id': uid,
            'account': 'personal',
            'type': 'send',
            'amount': -amt,
            'ref_user_id': peer['user_id'],
            'note': _note.text.trim(),
          },
          {
            'user_id': peer['user_id'],
            'account': 'personal',
            'type': 'receive',
            'amount': amt,
            'ref_user_id': uid,
            'note': _note.text.trim(),
          },
        ]);
      }
      await supabase.from('notifications').insert({
        'user_id': peer['user_id'],
        'type': 'wallet_p2p',
        'title': 'Money received',
        'body': 'You received \$${amt.toStringAsFixed(2)}',
        'link': '/wallet',
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onSent();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sent \$${amt.toStringAsFixed(2)}')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Send failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Send money', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          TextField(
            controller: _query,
            onChanged: (_) => _search(),
            decoration: const InputDecoration(
              labelText: 'Search username or name',
              prefixIcon: Icon(LucideIcons.search, size: 16),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          if (_results.isNotEmpty && _selected == null)
            Container(
              constraints: const BoxConstraints(maxHeight: 200),
              decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(8)),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _results.length,
                itemBuilder: (_, i) {
                  final r = _results[i];
                  return ListTile(
                    dense: true,
                    title: Text(r['display_name']?.toString() ?? 'User'),
                    subtitle: Text('@${r['username'] ?? '—'}'),
                    onTap: () => setState(() => _selected = r),
                  );
                },
              ),
            ),
          if (_selected != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(10)),
              child: Row(children: [
                const Icon(LucideIcons.userCheck, size: 16, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(child: Text('To: ${_selected!['display_name'] ?? _selected!['username']}',
                    style: const TextStyle(fontWeight: FontWeight.w800))),
                IconButton(icon: const Icon(LucideIcons.x, size: 16), onPressed: () => setState(() => _selected = null)),
              ]),
            ),
            const SizedBox(height: 8),
          ],
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Amount', prefixText: '\$ ', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          TextField(controller: _note, decoration: const InputDecoration(labelText: 'Note (optional)', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _send,
            icon: const Icon(LucideIcons.send, size: 16),
            label: Text(_busy ? 'Sending…' : 'Send money'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          ),
        ]),
      ),
    );
  }
}
