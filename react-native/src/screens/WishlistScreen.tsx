import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ProductCard } from '@/components/ProductCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Product, WishlistItem } from '@/types';

const W = Dimensions.get('window').width;
const COLS = 2; const GUTTER = 12; const SIDE = 16;
const CARD_W = (W - SIDE * 2 - GUTTER) / COLS;

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

  if (loading) return <ScreenContainer title="Wishlist"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="Wishlist">
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No saved items" hint="Tap the heart on any product." />}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      />
    </ScreenContainer>
  );
}
