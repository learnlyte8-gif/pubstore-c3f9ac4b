import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { Conversation } from '@/types';

export function MessagesScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<(Conversation & { preview?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data: convs } = await supabase
      .from('conversations')
      .select('id,buyer_id,supplier_id,title,kind,last_message_at')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50);
    setItems((convs as Conversation[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh on any new message
  useEffect(() => {
    const ch = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.h1}>Messages</Text>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No conversations yet" hint="Chat with sellers from a product page." />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Thread', { conversationId: item.id, title: item.title ?? 'Conversation' })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.title ?? 'C').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.title}>{item.title ?? 'Conversation'}</Text>
              <Text numberOfLines={1} style={styles.preview}>{item.kind ?? 'chat'}</Text>
            </View>
            {item.last_message_at ? (
              <Text style={styles.time}>{new Date(item.last_message_at).toLocaleDateString()}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  h1: { padding: 16, fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 26, color: theme.colors.foreground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.mutedSurface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.fonts.display, fontWeight: '700', color: theme.colors.foreground },
  title: { fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.foreground },
  preview: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  time: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11 },
});
