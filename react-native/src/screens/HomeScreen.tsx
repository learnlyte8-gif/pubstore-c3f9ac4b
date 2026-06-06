import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ProductCard } from '@/components/ProductCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Category, Product } from '@/types';

const SCREEN_W = Dimensions.get('window').width;
const COLS = 2;
const GUTTER = 12;
const SIDE = 16;
const CARD_W = (SCREEN_W - SIDE * 2 - GUTTER) / COLS;

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: cats }, prods] = await Promise.all([
      supabase.from('categories').select('slug,name,icon,image').order('name'),
      fetchProducts(activeCat, search),
    ]);
    setCategories((cats as Category[]) ?? []);
    setProducts(prods);
    setLoading(false);
    setRefreshing(false);
  }, [activeCat, search]);

  useEffect(() => {
    load();
  }, [load]);

  const header = useMemo(
    () => (
      <View>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search PUBSTORE"
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={load}
          />
          <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
            <Ionicons name="bag-handle-outline" size={22} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catsRow}
        >
          <CategoryChip
            label="All"
            active={activeCat == null}
            onPress={() => setActiveCat(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.slug}
              label={c.name}
              image={c.image}
              active={activeCat === c.slug}
              onPress={() => setActiveCat(c.slug)}
            />
          ))}
        </ScrollView>

        <Text style={styles.h2}>For you</Text>
      </View>
    ),
    [categories, activeCat, search, load, navigation]
  );

  if (loading) return <ScreenLoader label="Loading PUBSTORE" />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="No products found" hint="Try a different category." />}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

async function fetchProducts(slug: string | null, q: string): Promise<Product[]> {
  let qb = supabase
    .from('products')
    .select('id,title,price,image,gallery,category_slug,supplier_id,rating,review_count,sold,active')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(60);
  if (slug) qb = qb.eq('category_slug', slug);
  if (q.trim()) qb = qb.ilike('title', `%${q.trim()}%`);
  const { data } = await qb;
  return (data as Product[]) ?? [];
}

function CategoryChip({
  label,
  image,
  active,
  onPress,
}: {
  label: string;
  image?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {image ? <Image source={{ uri: image }} style={styles.chipImg} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  searchRow: {
    marginHorizontal: SIDE,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.mutedSurface,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    padding: 0,
  },
  catsRow: { paddingHorizontal: SIDE, gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.mutedSurface,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: theme.colors.foreground },
  chipImg: { width: 18, height: 18, borderRadius: 4 },
  chipText: { color: theme.colors.foreground, fontFamily: theme.fonts.body, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: theme.colors.background },
  h2: {
    paddingHorizontal: SIDE,
    paddingVertical: 8,
    fontFamily: theme.fonts.display,
    fontWeight: '700',
    fontSize: 20,
    color: theme.colors.foreground,
  },
});
