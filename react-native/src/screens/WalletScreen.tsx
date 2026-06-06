import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ScreenLoader, EmptyState } from '@/components/States';

type Tx = {
  id: string; kind: string; amount: number; balance_after: number;
  description: string | null; reference: string | null; created_at: string;
};

export function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', u.user.id).maybeSingle(),
      supabase.from('wallet_transactions').select('*').eq('user_id', u.user.id).order('created_at', { ascending: false }).limit(80),
    ]);
    setBalance(Number(w?.balance ?? 0));
    setTxs((t as Tx[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ScreenContainer title="Wallet"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="Wallet">
      <View style={styles.hero}>
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.balance}>${balance.toFixed(2)}</Text>
      </View>
      <FlatList
        data={txs}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No transactions" hint="Top up or get paid to see activity." />}
        renderItem={({ item }) => {
          const positive = item.amount > 0;
          return (
            <View style={styles.tx}>
              <View style={[styles.icon, { backgroundColor: positive ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons
                  name={positive ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={positive ? '#15803d' : '#b91c1c'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle} numberOfLines={1}>{item.description ?? item.kind}</Text>
                <Text style={styles.txDate}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.amount, { color: positive ? '#15803d' : '#b91c1c' }]}>
                  {positive ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
                </Text>
                <Text style={styles.bal}>${Number(item.balance_after).toFixed(2)}</Text>
              </View>
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 24, alignItems: 'center', gap: 6, backgroundColor: theme.colors.mutedSurface, margin: 16, borderRadius: 18 },
  label: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13 },
  balance: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 38, color: theme.colors.foreground },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.foreground },
  txDate: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  amount: { fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 14 },
  bal: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11 },
});
