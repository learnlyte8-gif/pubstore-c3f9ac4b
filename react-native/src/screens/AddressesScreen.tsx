import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ScreenLoader, EmptyState } from '@/components/States';

type Addr = {
  id: string; label: string | null; line1: string; line2: string | null;
  city: string | null; country: string | null; is_default: boolean | null;
};

export function AddressesScreen() {
  const [items, setItems] = useState<Addr[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase.from('addresses').select('id,label,line1,line2,city,country,is_default').eq('user_id', u.user.id);
    setItems((data as Addr[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (id: string) =>
    Alert.alert('Delete address', 'This cannot be undone.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('addresses').delete().eq('id', id); load(); } },
    ]);

  const makeDefault = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', u.user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    load();
  };

  if (loading) return <ScreenContainer title="Addresses"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="Addresses">
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<EmptyState title="No addresses yet" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="location" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label ?? 'Address'} {item.is_default ? '· default' : ''}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {[item.line1, item.line2, item.city, item.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              {!item.is_default && (
                <TouchableOpacity onPress={() => makeDefault(item.id)}><Text style={styles.action}>Default</Text></TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => remove(item.id)}><Text style={[styles.action, { color: theme.colors.danger }]}>Delete</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 14 },
  label: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground },
  body: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  action: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground, fontSize: 12 },
});
