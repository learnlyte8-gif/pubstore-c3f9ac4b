import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ScreenLoader, EmptyState } from '@/components/States';

type PM = { id: string; kind: string; label: string | null; last4: string | null; is_default: boolean | null };

export function PaymentMethodsScreen() {
  const [items, setItems] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase.from('payment_methods').select('id,kind,label,last4,is_default').eq('user_id', u.user.id);
    setItems((data as PM[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (id: string) =>
    Alert.alert('Delete', 'Remove payment method?', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('payment_methods').delete().eq('id', id); load(); } },
    ]);

  if (loading) return <ScreenContainer title="Payment methods"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer title="Payment methods">
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<EmptyState title="No payment methods" hint="Add one to checkout faster." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="card" size={22} color={theme.colors.foreground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label ?? item.kind} {item.is_default ? '· default' : ''}</Text>
              {item.last4 ? <Text style={styles.sub}>•••• {item.last4}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 14 },
  label: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground },
  sub: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
});
