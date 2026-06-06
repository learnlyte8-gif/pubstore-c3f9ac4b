import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ScreenLoader, EmptyState } from '@/components/States';

type Notif = {
  id: string; type: string; title: string; body: string | null;
  link: string | null; read: boolean | null; created_at: string;
};

export function NotificationsScreen() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('notifications')
      .select('id,type,title,body,link,read,created_at')
      .eq('user_id', u.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as Notif[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const ch = supabase.channel('notifs').on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load()
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const markAllRead = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', u.user.id).eq('read', false);
    load();
  };

  if (loading) return <ScreenContainer title="Notifications"><ScreenLoader /></ScreenContainer>;

  return (
    <ScreenContainer
      title="Notifications"
      right={
        <TouchableOpacity onPress={markAllRead}>
          <Ionicons name="checkmark-done" size={22} color={theme.colors.foreground} />
        </TouchableOpacity>
      }
    >
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<EmptyState title="You're all caught up" />}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.read && styles.unread]}>
            {!item.read && <View style={styles.dot} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
              <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  unread: { backgroundColor: '#eff6ff' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 },
  title: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground, fontSize: 14 },
  body: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  time: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 6 },
});
