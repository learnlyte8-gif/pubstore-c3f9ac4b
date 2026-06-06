import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Product } from '@/types';
import { theme } from '@/config/theme';

export function ProductCard({ product, width }: { product: Product; width: number }) {
  const navigation = useNavigation<any>();
  const img = product.image || product.gallery?.[0] || null;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { width }]}
      onPress={() => navigation.navigate('ProductDetail', { id: product.id })}
    >
      <View style={[styles.thumb, { width, height: width }]}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} />
        )}
      </View>
      <Text numberOfLines={2} style={styles.title}>{product.title}</Text>
      <View style={styles.row}>
        <Text style={styles.price}>${Number(product.price ?? 0).toFixed(2)}</Text>
        {product.rating ? (
          <Text style={styles.rating}>★ {Number(product.rating).toFixed(1)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  thumb: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.mutedSurface,
  },
  placeholder: { backgroundColor: theme.colors.mutedSurface },
  title: {
    marginTop: 8,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.body,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
  },
  row: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: theme.colors.foreground, fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 14 },
  rating: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12 },
});
