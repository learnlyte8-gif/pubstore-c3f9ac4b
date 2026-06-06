import React, { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

export function AccountScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return navigation.navigate('Auth');
      setEmail(u.user.email ?? null);
      const { data } = await supabase.from('profiles').select('*').eq('user_id', u.user.id).maybeSingle();
      if (data) {
        setName(data.display_name ?? '');
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setAvatar(data.avatar_url ?? null);
      }
    })();
  }, []);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: name, username, bio,
    }).eq('user_id', u.user.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'Profile updated.');
  };

  return (
    <ScreenContainer title="Profile">
      <View style={{ padding: 16, gap: 14 }}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFillObject} /> : <Ionicons name="person" size={32} color={theme.colors.muted} />}
          </View>
          <View>
            <Text style={styles.email}>{email}</Text>
            <Text style={styles.muted}>Tap to change photo from app settings.</Text>
          </View>
        </View>

        <Field label="Display name" value={name} onChange={setName} />
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Bio" value={bio} onChange={setBio} multiline />

        <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 88, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={theme.colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.mutedSurface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  email: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground },
  muted: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  label: { fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.muted, fontSize: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, color: theme.colors.foreground, fontFamily: theme.fonts.body },
  save: { marginTop: 8, backgroundColor: theme.colors.foreground, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
});
