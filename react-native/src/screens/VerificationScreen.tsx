import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

export function VerificationScreen() {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from('user_verifications').select('status').eq('user_id', u.user.id).maybeSingle();
      setStatus(data?.status ?? 'unverified');
    })();
  }, []);

  const color = status === 'approved' ? '#15803d' : status === 'pending' ? theme.colors.warning : theme.colors.muted;

  return (
    <ScreenContainer title="Verification">
      <View style={{ padding: 16, gap: 16, alignItems: 'center' }}>
        <View style={[styles.badge, { borderColor: color }]}>
          <Ionicons name={status === 'approved' ? 'shield-checkmark' : 'shield-outline'} size={64} color={color} />
        </View>
        <Text style={[styles.h1, { color }]}>{status ?? '…'}</Text>
        <Text style={styles.body}>
          Verified accounts unlock COD, higher withdrawal limits, and priority support.
          Submit your ID through the supplier onboarding flow.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badge: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 22, textTransform: 'capitalize' },
  body: { color: theme.colors.muted, fontFamily: theme.fonts.body, textAlign: 'center', lineHeight: 20 },
});
