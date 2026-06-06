import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState } from '@/components/States';
import type { Product } from '@/types';

const W = Dimensions.get('window').width;
const COLS = 2;
const GUTTER = 12;
const SIDE = 16;
const CARD_W = (W - SIDE * 2 - GUTTER) / COLS;

export function SearchScreen() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      const { data } = await supabase
        .from('products')
        .select('id,title,price,image,gallery,category_slug,rating,review_count')
        .eq('active', true)
        .ilike('title', `%${q.trim()}%`)
        .limit(60);
      setResults((data as Product[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.bar}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <TextInput
          autoFocus
          style={styles.input}
          placeholder="Search PUBSTORE"
          placeholderTextColor={theme.colors.muted}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        ListEmptyComponent={q ? <EmptyState title="No matches" /> : <EmptyState title="Type to search" />}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  bar: { margin: 16, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.mutedSurface, borderRadius: 12 },
  input: { flex: 1, color: theme.colors.foreground, fontFamily: theme.fonts.body, fontSize: 14, padding: 0 },
});
