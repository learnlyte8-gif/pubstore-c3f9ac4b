import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { getCurrentPosition, requestLocationPermission } from '@/services/location';
import type { Ride } from '@/types';

const DEFAULT_REGION = { latitude: -17.8252, longitude: 31.0335, latitudeDelta: 0.05, longitudeDelta: 0.05 };

export function RidesScreen() {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [pickup, setPickup] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await requestLocationPermission();
      if (!ok) return;
      try {
        const pos = await getCurrentPosition();
        setRegion({ ...pos, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        setPickup(pos);
      } catch {}
    })();
  }, []);

  // Subscribe to active ride updates so driver assignment & status appear live
  useEffect(() => {
    if (!activeRide) return;
    const ch = supabase
      .channel(`ride-${activeRide.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${activeRide.id}` },
        (payload) => setActiveRide(payload.new as Ride)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeRide?.id]);

  const onMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!pickup) setPickup(coord);
    else if (!dropoff) setDropoff(coord);
    else setDropoff(coord);
  };

  const requestRide = async () => {
    if (!pickup || !dropoff) return Alert.alert('Pick a route', 'Tap the map to set pickup and dropoff.');
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return Alert.alert('Sign in', 'You need an account to request a ride.');
    setRequesting(true);
    const { data, error } = await supabase
      .from('rides')
      .insert({
        rider_id: u.user.id,
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        dropoff_lat: dropoff.latitude,
        dropoff_lng: dropoff.longitude,
        status: 'searching',
      })
      .select()
      .single();
    setRequesting(false);
    if (error) return Alert.alert('Error', error.message);
    setActiveRide(data as Ride);
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', activeRide.id);
    setActiveRide(null);
    setDropoff(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={onMapPress}
        showsUserLocation
      >
        {pickup && <Marker coordinate={pickup} title="Pickup" pinColor={theme.colors.primary} />}
        {dropoff && <Marker coordinate={dropoff} title="Dropoff" pinColor={theme.colors.danger} />}
      </MapView>

      <View style={styles.sheet}>
        {activeRide ? (
          <>
            <Text style={styles.h1}>
              {activeRide.status === 'searching' && 'Looking for a driver…'}
              {activeRide.status === 'offered' && 'Driver offered your ride'}
              {activeRide.status === 'accepted' && 'Driver on the way'}
              {activeRide.status === 'in_progress' && 'On trip'}
              {activeRide.status === 'completed' && 'Ride completed'}
              {activeRide.status === 'cancelled' && 'Ride cancelled'}
            </Text>
            <Text style={styles.sub}>Status: {activeRide.status}</Text>
            <TouchableOpacity style={styles.cancel} onPress={cancelRide}>
              <Text style={styles.cancelText}>Cancel ride</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.h1}>Where to?</Text>
            <Text style={styles.sub}>
              {pickup ? (dropoff ? 'Pickup + dropoff set' : 'Tap dropoff') : 'Tap pickup on map'}
            </Text>
            <TouchableOpacity
              style={[styles.cta, (!pickup || !dropoff) && { opacity: 0.5 }]}
              onPress={requestRide}
              disabled={!pickup || !dropoff || requesting}
            >
              <Ionicons name="car" size={18} color={theme.colors.background} />
              <Text style={styles.ctaText}>{requesting ? 'Requesting…' : 'Request ride'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 20, paddingBottom: 28,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 },
    elevation: 12, gap: 8,
  },
  h1: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 20, color: theme.colors.foreground },
  sub: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13 },
  cta: { marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.colors.foreground, padding: 16, borderRadius: 14 },
  ctaText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
  cancel: { marginTop: 8, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  cancelText: { color: theme.colors.danger, fontFamily: theme.fonts.body, fontWeight: '600' },
});
