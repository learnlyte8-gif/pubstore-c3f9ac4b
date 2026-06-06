import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ScreenLoader, EmptyState } from '@/components/States';

type Order = {
  id: string; ref_code: string | null; total: number;
  status: string; payment_status: string | null; created_at: string;
};

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('orders')
      .select('id,ref_code,total,status,payment_status,created_at')
      .eq('buyer_id', u.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders((data as Order[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ScreenContainer title="Orders"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="Orders">
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<EmptyState title="No orders yet" hint="Your purchases will appear here." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ref}>{item.ref_code ?? item.id.slice(0, 8)}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              <View style={styles.tags}>
                <Tag label={item.status} />
                {item.payment_status ? <Tag label={item.payment_status} muted /> : null}
              </View>
            </View>
            <Text style={styles.total}>${Number(item.total).toFixed(2)}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

function Tag({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View style={[styles.tag, muted && { backgroundColor: theme.colors.mutedSurface }]}>
      <Text style={[styles.tagText, muted && { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 14 },
  ref: { fontFamily: theme.fonts.display, fontWeight: '700', color: theme.colors.foreground },
  date: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.foreground },
  tagText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700', fontSize: 11 },
  total: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 16, color: theme.colors.foreground },
});
