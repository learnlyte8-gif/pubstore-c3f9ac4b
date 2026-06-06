import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListingCard } from '@/components/ListingCard';
import { ScreenLoader, EmptyState } from '@/components/States';
import { useSupabaseList } from '@/services/useSupabaseList';

type Mapper = (row: any) => {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  meta?: string | null;
  badge?: string | null;
};

/**
 * Generic vertical screen. Used by every marketplace category that's
 * essentially "search a table and show rich list cards".
 */
export function VerticalScreen({
  title,
  table,
  select,
  orderColumn = 'created_at',
  searchColumns,
  mapRow,
}: {
  title: string;
  table: string;
  select?: string;
  orderColumn?: string;
  searchColumns: string[];
  mapRow: Mapper;
}) {
  const [q, setQ] = useState('');
  const { data, loading, refreshing, refresh } = useSupabaseList({
    table,
    select,
    order: { column: orderColumn, ascending: false },
    search: { q, columns: searchColumns },
    limit: 60,
  });

  const list = useCallback(
    () => (
      <FlatList
        data={data}
        keyExtractor={(r: any) => r.id}
        contentContainerStyle={{ paddingVertical: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={styles.bar}>
            <Ionicons name="search" size={18} color={theme.colors.muted} />
            <TextInput
              style={styles.input}
              placeholder={`Search ${title.toLowerCase()}`}
              placeholderTextColor={theme.colors.muted}
              value={q}
              onChangeText={setQ}
            />
          </View>
        }
        ListEmptyComponent={<EmptyState title={`No ${title.toLowerCase()} yet`} />}
        renderItem={({ item }) => {
          const m = mapRow(item);
          return <ListingCard {...m} />;
        }}
      />
    ),
    [data, refreshing, refresh, q, title, mapRow]
  );

  return (
    <ScreenContainer title={title}>
      {loading ? <ScreenLoader /> : list()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bar: { margin: 16, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.mutedSurface, borderRadius: 12 },
  input: { flex: 1, color: theme.colors.foreground, fontFamily: theme.fonts.body, fontSize: 14, padding: 0 },
});
