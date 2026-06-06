import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import type { Message } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

export function ThreadScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { conversationId, title } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data as Message[]) ?? []);
    })();
  }, [conversationId]);

  useEffect(() => {
    const ch = supabase
      .channel(`thread-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  const send = async () => {
    const text = body.trim();
    if (!text || !me) return;
    setBody('');
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: me,
      body: text,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.h1} numberOfLines={1}>{title ?? 'Conversation'}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.bubbleText, mine && { color: theme.colors.background }]}>{item.body}</Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={theme.colors.muted}
            value={body}
            onChangeText={setBody}
            multiline
          />
          <TouchableOpacity style={styles.send} onPress={send} disabled={!body.trim()}>
            <Ionicons name="arrow-up" size={18} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  h1: { flex: 1, textAlign: 'center', fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 16, color: theme.colors.foreground },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.foreground, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: theme.colors.mutedSurface, borderBottomLeftRadius: 4 },
  bubbleText: { color: theme.colors.foreground, fontFamily: theme.fonts.body, fontSize: 14 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
  input: {
    flex: 1, maxHeight: 120,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: theme.colors.mutedSurface, borderRadius: 20,
    color: theme.colors.foreground, fontFamily: theme.fonts.body, fontSize: 14,
  },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.foreground, alignItems: 'center', justifyContent: 'center' },
});
