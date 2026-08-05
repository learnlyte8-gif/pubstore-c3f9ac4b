import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [prefs, setPrefs] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', u.user.id).maybeSingle();
      setPrefs(data);
    })();
  }, []);

  const toggle = async (key: string) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await supabase.from('notification_preferences').update({ [key]: next[key] }).eq('user_id', prefs.user_id);
  };

  const signOut = () =>
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      } },
    ]);

  return (
    <ScreenContainer title="Settings">
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={styles.section}>Notifications</Text>
        {prefs ? (
          <>
            <Toggle label="Orders" value={!!prefs.inapp_orders} onChange={() => toggle('inapp_orders')} />
            <Toggle label="Messages" value={!!prefs.inapp_messages} onChange={() => toggle('inapp_messages')} />
            <Toggle label="Wishlist price drops" value={!!prefs.inapp_wishlist_price_drop} onChange={() => toggle('inapp_wishlist_price_drop')} />
            <Toggle label="Wishlist restock" value={!!prefs.inapp_wishlist_restock} onChange={() => toggle('inapp_wishlist_restock')} />
            <Toggle label="Suppliers you follow go live" value={!!prefs.inapp_followed_supplier_live} onChange={() => toggle('inapp_followed_supplier_live')} />
          </>
        ) : (
          <Text style={styles.muted}>Sign in to manage preferences.</Text>
        )}

        <Text style={styles.section}>Account</Text>
        <Row icon="person-outline" label="Profile" onPress={() => navigation.navigate('Account')} />
        <Row icon="location-outline" label="Addresses" onPress={() => navigation.navigate('Addresses')} />
        <Row icon="card-outline" label="Payment methods" onPress={() => navigation.navigate('PaymentMethods')} />
        <Row icon="shield-checkmark-outline" label="Verification" onPress={() => navigation.navigate('Verification')} />
        <Row icon="help-circle-outline" label="Help center" onPress={() => navigation.navigate('HelpCenter')} />
        <Row icon="document-text-outline" label="Privacy" onPress={() => navigation.navigate('Privacy')} />
        <Row icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('Terms')} />

        <TouchableOpacity style={styles.signout} onPress={signOut}>
          <Text style={styles.signoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={theme.colors.foreground} />
      <Text style={[styles.rowLabel, { flex: 1, marginLeft: 12 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 13, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 12 },
  rowLabel: { fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.foreground, fontSize: 14 },
  muted: { color: theme.colors.muted, fontFamily: theme.fonts.body },
  signout: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  signoutText: { color: theme.colors.danger, fontFamily: theme.fonts.body, fontWeight: '700' },
});
