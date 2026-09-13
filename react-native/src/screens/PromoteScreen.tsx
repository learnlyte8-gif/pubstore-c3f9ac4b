import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ProductCard } from '@/components/ProductCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import { theme } from '@/config/theme';

const W = Dimensions.get('window').width;
const COLS = 2; const GUTTER = 12; const SIDE = 16;
const CARD_W = (W - SIDE * 2 - GUTTER) / COLS;

type PromoteProduct = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  gallery: string[] | null;
  rating: number | null;
  commission_type: 'percent' | 'fixed' | null;
  commission_value: number | null;
};

function commissionFor(p: PromoteProduct): number {
  const price = Number(p.price ?? 0);
  const value = Number(p.commission_value ?? 0);
  if (!value || price <= 0) return 0;
  if (p.commission_type === 'fixed') return Math.min(value, price);
  return Math.min((value / 100) * price, price);
}

export function PromoteScreen() {
  const [items, setItems] = useState<PromoteProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('products')
      .select('id,title,price,image,gallery,rating,commission_type,commission_value')
      .eq('active', true)
      .eq('promote_enabled', true)
      .gt('commission_value', 0);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data } = await q.order('created_at', { ascending: false }).limit(100);
    setItems((data ?? []) as PromoteProduct[]);
    setLoading(false);
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScreenContainer title="Promote & Earn">
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.muted} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products to promote"
          placeholderTextColor={theme.colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={load}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); load(); }} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            <EmptyState
              title="No products to promote"
              hint="Check back later or try a different search."
            />
          }
          renderItem={({ item }) => {
            const commission = commissionFor(item);
            return (
              <View style={[styles.cardWrap, { width: CARD_W }]}>
                <ProductCard product={item as any} width={CARD_W} />
                {commission > 0 && (
                  <View style={styles.earnBadge}>
                    <Text style={styles.earnText}>Earn ${commission.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginHorizontal: SIDE,
    marginTop: 12,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.foreground,
    paddingVertical: 0,
  },
  clearBtn: { padding: 4 },
  cardWrap: { marginBottom: 16 },
  earnBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '14',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  earnText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
    fontSize: 11,
  },
});
