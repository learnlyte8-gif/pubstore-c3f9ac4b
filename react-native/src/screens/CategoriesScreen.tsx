import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Category } from '@/types';

const SCREEN_W = Dimensions.get('window').width;
const COLS = 3;
const GUTTER = 12;
const SIDE = 16;
const CARD_W = (SCREEN_W - SIDE * 2 - GUTTER * (COLS - 1)) / COLS;

export function CategoriesScreen() {
  const navigation = useNavigation<any>();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('categories').select('slug,name,icon,image').order('name');
      setCats((data as Category[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.h1}>Categories</Text>
      <FlatList
        data={cats}
        keyExtractor={(c) => c.slug}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GUTTER, paddingHorizontal: SIDE }}
        contentContainerStyle={{ paddingBottom: 32, gap: GUTTER }}
        ListEmptyComponent={<EmptyState title="No categories yet" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tile, { width: CARD_W }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Home', { category: item.slug })}
          >
            <View style={[styles.thumb, { width: CARD_W, height: CARD_W }]}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
            </View>
            <Text style={styles.label} numberOfLines={2}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  h1: {
    paddingHorizontal: SIDE,
    paddingTop: 8,
    paddingBottom: 12,
    fontFamily: theme.fonts.display,
    fontWeight: '800',
    fontSize: 26,
    color: theme.colors.foreground,
  },
  tile: { marginBottom: 4 },
  thumb: { borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.mutedSurface },
  label: {
    marginTop: 6,
    fontFamily: theme.fonts.body,
    fontWeight: '600',
    fontSize: 12,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
});
