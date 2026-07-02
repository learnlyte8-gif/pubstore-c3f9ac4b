import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models_ext.dart';
import '../services/supabase_client.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Wallet.tsx` — balance card, quick actions, transactions.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});
  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  Future<WalletSummary>? _future;
  String _tab = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final uid = supabase.auth.currentUser?.id;
    if (uid != null) {
      _future = verticals.fetchWallet(uid);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = supabase.auth.currentUser != null;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('PUBSTORE Pay',
            style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: !signedIn
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Sign in to view your wallet.'),
              ),
            )
          : FutureBuilder<WalletSummary>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                final s = snap.data ??
                    WalletSummary(
                        balance: 0,
                        personal: 0,
                        sales: 0,
                        transactions: []);
                final txs = _tab == 'all'
                    ? s.transactions
                    : s.transactions
                        .where((t) => t.account == _tab)
                        .toList();
                return RefreshIndicator(
                  onRefresh: () async {
                    setState(_load);
                    await _future;
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 32),
                    children: [
                      _balanceCard(s),
                      _quickActions(),
                      _accountsRow(s),
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
                        child: Text('TRANSACTIONS',
                            style: TextStyle(
                                fontSize: 11,
                                letterSpacing: 1.4,
                                fontWeight: FontWeight.w900,
                                color: AppColors.muted)),
                      ),
                      _tabs(),
                      if (txs.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(
                              child: Text('No transactions yet',
                                  style:
                                      TextStyle(color: AppColors.muted))),
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

  Widget _balanceCard(WalletSummary s) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFF8B5CF6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
              color: const Color(0xFF6366F1).withOpacity(0.35),
              blurRadius: 24,
              offset: const Offset(0, 12)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(LucideIcons.wallet, size: 14, color: Colors.white70),
            SizedBox(width: 6),
            Text('AVAILABLE BALANCE',
                style: TextStyle(
                    color: Colors.white70,
                    fontSize: 10,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w900)),
          ]),
          const SizedBox(height: 8),
          Text('\$${s.balance.toStringAsFixed(2)}',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1)),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(LucideIcons.shieldCheck,
                size: 12, color: Colors.white70),
            const SizedBox(width: 4),
            Text('Insured & escrow-backed',
                style: TextStyle(
                    color: Colors.white.withOpacity(0.85), fontSize: 11)),
          ]),
        ],
      ),
    );
  }

  Widget _quickActions() {
    final acts = [
      (LucideIcons.plus, 'Top up'),
      (LucideIcons.send, 'Send'),
      (LucideIcons.arrowUpRight, 'Withdraw'),
      (LucideIcons.arrowRightLeft, 'Move'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        children: acts
            .map((a) => Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: GestureDetector(
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('${a.$2} — coming soon'))),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(children: [
                          Icon(a.$1, size: 18),
                          const SizedBox(height: 4),
                          Text(a.$2,
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800)),
                        ]),
                      ),
                    ),
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _accountsRow(WalletSummary s) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(children: [
        Expanded(child: _accountTile('Personal', s.personal, LucideIcons.wallet)),
        const SizedBox(width: 8),
        Expanded(child: _accountTile('Sales', s.sales, LucideIcons.store)),
      ]),
    );
  }

  Widget _accountTile(String label, double amt, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 14, color: AppColors.muted),
            const SizedBox(width: 6),
            Text(label.toUpperCase(),
                style: const TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w900,
                    color: AppColors.muted)),
          ]),
          const SizedBox(height: 6),
          Text('\$${amt.toStringAsFixed(2)}',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _tabs() {
    const opts = [('all', 'All'), ('personal', 'Personal'), ('sales', 'Sales')];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: opts.map((o) {
          final active = _tab == o.$1;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: GestureDetector(
                onTap: () => setState(() => _tab = o.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? AppColors.foreground : AppColors.mutedSurface,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(o.$2,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: active
                              ? AppColors.background
                              : AppColors.foreground)),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _txTile(WalletTx t) {
    final positive = t.amount >= 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: positive
                ? const Color(0x1A10B981)
                : const Color(0x1AEF4444),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            positive ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight,
            size: 16,
            color: positive
                ? const Color(0xFF059669)
                : const Color(0xFFDC2626),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.description.isEmpty ? t.type : t.description,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(
                  '${t.createdAt.year}-${t.createdAt.month.toString().padLeft(2, '0')}-${t.createdAt.day.toString().padLeft(2, '0')}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.muted)),
            ],
          ),
        ),
        Text('${positive ? '+' : ''}\$${t.amount.toStringAsFixed(2)}',
            style: TextStyle(
                fontWeight: FontWeight.w900,
                color: positive
                    ? const Color(0xFF059669)
                    : const Color(0xFFDC2626))),
      ]),
    );
  }
}
