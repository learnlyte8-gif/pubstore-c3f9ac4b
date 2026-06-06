import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenLoader, EmptyState } from '@/components/States';
import type { CartItem, Product } from '@/types';

type Row = CartItem & { product: Product };

export function CartScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase
      .from('cart_items')
      .select('id,user_id,product_id,qty,created_at,product:products(*)')
      .eq('user_id', u.user.id);
    setItems((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setQty = async (row: Row, qty: number) => {
    if (qty < 1) {
      await supabase.from('cart_items').delete().eq('id', row.id);
    } else {
      await supabase.from('cart_items').update({ qty }).eq('id', row.id);
    }
    load();
  };

  const total = items.reduce((sum, r) => sum + Number(r.product?.price ?? 0) * r.qty, 0);

  const checkout = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setPlacing(false); return navigation.navigate('Auth'); }
    // Group by supplier_id (orders are per-supplier in the schema)
    const groups: Record<string, Row[]> = {};
    items.forEach((r) => {
      const sid = r.product?.supplier_id ?? 'unknown';
      (groups[sid] ||= []).push(r);
    });
    try {
      for (const [supplierId, rows] of Object.entries(groups)) {
        if (supplierId === 'unknown') continue;
        const subtotal = rows.reduce((s, r) => s + Number(r.product?.price ?? 0) * r.qty, 0);
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            buyer_id: u.user.id,
            supplier_id: supplierId,
            status: 'placed',
            subtotal,
            total: subtotal,
            payment_status: 'pending',
          })
          .select()
          .single();
        if (error) throw error;
        await supabase.from('order_items').insert(
          rows.map((r) => ({
            order_id: order!.id,
            product_id: r.product_id,
            qty: r.qty,
            unit_price: r.product?.price ?? 0,
            title: r.product?.title,
            image: r.product?.image ?? r.product?.gallery?.[0] ?? null,
          }))
        );
      }
      await supabase.from('cart_items').delete().eq('user_id', u.user.id);
      Alert.alert('Order placed', 'Track it under your orders.');
      load();
    } catch (e: any) {
      Alert.alert('Checkout failed', e?.message ?? 'Try again');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.h1}>Cart</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}
        ListEmptyComponent={<EmptyState title="Your cart is empty" hint="Add products to checkout." />}
        renderItem={({ item }) => {
          const img = item.product?.image ?? item.product?.gallery?.[0] ?? null;
          return (
            <View style={styles.row}>
              <View style={styles.thumb}>
                {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={styles.title}>{item.product?.title}</Text>
                <Text style={styles.price}>${Number(item.product?.price ?? 0).toFixed(2)}</Text>
                <View style={styles.qty}>
                  <TouchableOpacity style={styles.qBtn} onPress={() => setQty(item, item.qty - 1)}>
                    <Ionicons name="remove" size={16} color={theme.colors.foreground} />
                  </TouchableOpacity>
                  <Text style={styles.qN}>{item.qty}</Text>
                  <TouchableOpacity style={styles.qBtn} onPress={() => setQty(item, item.qty + 1)}>
                    <Ionicons name="add" size={16} color={theme.colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.total}>${total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={checkout} disabled={placing}>
            <Text style={styles.ctaText}>{placing ? 'Placing…' : 'Checkout'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 20, color: theme.colors.foreground },
  row: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: theme.colors.mutedSurface, borderRadius: 14 },
  thumb: { width: 78, height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.colors.border },
  title: { fontFamily: theme.fonts.body, fontWeight: '600', color: theme.colors.foreground },
  price: { fontFamily: theme.fonts.display, fontWeight: '700', color: theme.colors.foreground, marginTop: 4 },
  qty: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qBtn: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border,
  },
  qN: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground, minWidth: 18, textAlign: 'center' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  totalLabel: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  total: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 22, color: theme.colors.foreground },
  ctaBtn: { backgroundColor: theme.colors.foreground, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  ctaText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
});
