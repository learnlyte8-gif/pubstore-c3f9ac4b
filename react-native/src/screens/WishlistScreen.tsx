import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ProductCard } from '@/components/ProductCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Product, WishlistItem } from '@/types';

const SCREEN_W = Dimensions.get('window').width;
const COLS = 2;
const GUTTER = 12;
const SIDE = 16;
const CARD_W = (SCREEN_W - SIDE * 2 - GUTTER) / COLS;

export function WishlistScreen() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('wishlist_items')
      .select('product:products(*)')
      .eq('user_id', u.user.id);
    const rows = (data as unknown as (WishlistItem & { product: Product })[]) ?? [];
    setItems(rows.map((r) => r.product).filter(Boolean));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.h1}>Wishlist</Text>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No saved items" hint="Tap the heart on any product." />}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  h1: { padding: 16, fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 26, color: theme.colors.foreground },
});
