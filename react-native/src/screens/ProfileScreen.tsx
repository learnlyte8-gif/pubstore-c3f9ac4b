import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenLoader } from '@/components/States';
import type { Profile } from '@/types';

type RouteName =
  | 'Orders' | 'Wallet' | 'Notifications' | 'Account' | 'Addresses' | 'PaymentMethods'
  | 'Verification' | 'HelpCenter' | 'Settings' | 'Privacy' | 'MyStore' | 'Wishlist';

const ROWS: { icon: string; label: string; route: RouteName }[] = [
  { icon: 'receipt-outline', label: 'Orders', route: 'Orders' },
  { icon: 'heart-outline', label: 'Wishlist', route: 'Wishlist' },
  { icon: 'wallet-outline', label: 'Wallet', route: 'Wallet' },
  { icon: 'notifications-outline', label: 'Notifications', route: 'Notifications' },
  { icon: 'storefront-outline', label: 'My store', route: 'MyStore' },
  { icon: 'person-outline', label: 'Profile', route: 'Account' },
  { icon: 'location-outline', label: 'Addresses', route: 'Addresses' },
  { icon: 'card-outline', label: 'Payment methods', route: 'PaymentMethods' },
  { icon: 'shield-checkmark-outline', label: 'Verification', route: 'Verification' },
  { icon: 'help-circle-outline', label: 'Help center', route: 'HelpCenter' },
  { icon: 'settings-outline', label: 'Settings', route: 'Settings' },
  { icon: 'document-text-outline', label: 'Privacy', route: 'Privacy' },
];

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); setProfile(null); return; }
    setEmail(u.user.email ?? null);
    const { data } = await supabase
      .from('profiles')
      .select('user_id,display_name,username,avatar_url,bio')
      .eq('user_id', u.user.id)
      .maybeSingle();
    setProfile(data as Profile);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFillObject} />
            ) : (
              <Ionicons name="person" size={32} color={theme.colors.muted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile?.display_name ?? 'Guest'}</Text>
            <Text style={styles.sub}>{email ?? 'Not signed in'}</Text>
          </View>
          {!profile && (
            <TouchableOpacity style={styles.signin} onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.signinText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.list}>
          {ROWS.map((r) => (
            <TouchableOpacity key={r.route} style={styles.row} onPress={() => navigation.navigate(r.route)}>
              <Ionicons name={r.icon as any} size={20} color={theme.colors.foreground} />
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {profile && (
          <TouchableOpacity style={styles.signout} onPress={() => Alert.alert('Sign out', 'Are you sure?', [
            { text: 'Cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
          ])}>
            <Text style={styles.signoutText}>Sign out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.mutedSurface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 18, color: theme.colors.foreground },
  sub: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 2 },
  signin: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.colors.foreground, borderRadius: 10 },
  signinText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
  list: { marginTop: 12, marginHorizontal: 16, backgroundColor: theme.colors.mutedSurface, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLabel: { flex: 1, fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.foreground, fontSize: 14 },
  signout: { margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  signoutText: { color: theme.colors.danger, fontFamily: theme.fonts.body, fontWeight: '700' },
});
