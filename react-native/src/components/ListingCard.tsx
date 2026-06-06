import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@/config/theme';

/**
 * Universal card used by every marketplace vertical (restaurants, stays,
 * properties, vehicles, jobs, etc.). Pass title/subtitle/image/meta and it
 * adapts to any list.
 */
export function ListingCard({
  title,
  subtitle,
  image,
  meta,
  badge,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  image?: string | null;
  meta?: string | null;
  badge?: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={28} color={theme.colors.muted} />
        )}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    padding: 12, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: theme.colors.mutedSurface, borderRadius: 14,
  },
  thumb: {
    width: 78, height: 78, borderRadius: 10, overflow: 'hidden',
    backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 6, left: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: theme.colors.foreground,
  },
  badgeText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700', fontSize: 10 },
  title: { fontFamily: theme.fonts.body, fontWeight: '700', fontSize: 14, color: theme.colors.foreground },
  subtitle: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  meta: { color: theme.colors.foreground, fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 13 },
});
