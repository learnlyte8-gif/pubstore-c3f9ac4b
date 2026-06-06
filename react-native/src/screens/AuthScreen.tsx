import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';

export function AuthScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>{mode === 'signin' ? 'Welcome back' : 'Create account'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
          <Text style={styles.ctaText}>
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text style={styles.switch}>
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  body: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontFamily: theme.fonts.display, fontSize: 28, fontWeight: '700', color: theme.colors.foreground, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.body,
  },
  cta: {
    backgroundColor: theme.colors.foreground,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
  switch: { textAlign: 'center', color: theme.colors.muted, marginTop: 12 },
});
