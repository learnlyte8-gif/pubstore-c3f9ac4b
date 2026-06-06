import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

const HUB: { icon: string; label: string; route: string }[] = [
  { icon: 'restaurant', label: 'Restaurants', route: 'Restaurants' },
  { icon: 'bed', label: 'Stays', route: 'Stays' },
  { icon: 'home', label: 'Properties', route: 'Properties' },
  { icon: 'car-sport', label: 'Auto', route: 'Auto' },
  { icon: 'car', label: 'Car rentals', route: 'CarRentals' },
  { icon: 'briefcase', label: 'Jobs', route: 'Jobs' },
  { icon: 'construct', label: 'Services', route: 'Services' },
  { icon: 'leaf', label: 'Agro', route: 'Agro' },
  { icon: 'cog', label: 'Industrial', route: 'Industrial' },
  { icon: 'cash', label: 'Finance', route: 'Finance' },
  { icon: 'newspaper', label: 'News', route: 'News' },
  { icon: 'videocam', label: 'Live', route: 'Live' },
  { icon: 'cube', label: 'Logistics', route: 'Logistics' },
  { icon: 'car-outline', label: 'Driver', route: 'Driver' },
  { icon: 'document-text', label: 'RFQs', route: 'RFQ' },
  { icon: 'navigate', label: 'Rides', route: 'Rides' },
];

export function MoreScreen() {
  const navigation = useNavigation<any>();
  return (
    <ScreenContainer title="Explore">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.grid}>
          {HUB.map((h) => (
            <TouchableOpacity
              key={h.route}
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(h.route)}
            >
              <View style={styles.icon}>
                <Ionicons name={h.icon as any} size={26} color={theme.colors.foreground} />
              </View>
              <Text style={styles.label}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    padding: 10, backgroundColor: theme.colors.mutedSurface, borderRadius: 14, gap: 8,
  },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: theme.fonts.body, fontWeight: '600', fontSize: 11, color: theme.colors.foreground, textAlign: 'center' },
});
