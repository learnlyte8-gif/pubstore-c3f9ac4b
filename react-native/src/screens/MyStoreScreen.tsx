import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ProductCard } from '@/components/ProductCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Product } from '@/types';

const W = Dimensions.get('window').width;
const COLS = 2; const GUTTER = 12; const SIDE = 16;
const CARD_W = (W - SIDE * 2 - GUTTER) / COLS;

export function MyStoreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, listings: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data: sup } = await supabase.from('suppliers').select('id').eq('owner_id', u.user.id).maybeSingle();
    if (!sup) { setLoading(false); return; }
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from('products').select('id,title,price,image,gallery').eq('supplier_id', sup.id).limit(60),
      supabase.from('orders').select('total').eq('supplier_id', sup.id),
    ]);
    setProducts((p as Product[]) ?? []);
    const orders = o ?? [];
    setStats({
      orders: orders.length,
      revenue: orders.reduce((s, r: any) => s + Number(r.total ?? 0), 0),
      listings: p?.length ?? 0,
    });
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ScreenContainer title="My store"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="My store">
      <View style={styles.statsRow}>
        <Stat icon="bag" label="Orders" value={String(stats.orders)} />
        <Stat icon="cash" label="Revenue" value={`$${stats.revenue.toFixed(0)}`} />
        <Stat icon="pricetag" label="Listings" value={String(stats.listings)} />
      </View>
      <Text style={styles.h2}>Your products</Text>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No listings yet" hint="Add a product from the web app." />}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      />
    </ScreenContainer>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as any} size={18} color={theme.colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  stat: { flex: 1, alignItems: 'center', padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 14, gap: 4 },
  statValue: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 18, color: theme.colors.foreground },
  statLabel: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  h2: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 16, color: theme.colors.foreground },
});
