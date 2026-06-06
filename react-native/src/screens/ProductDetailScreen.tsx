import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '@/services/supabase';
import { theme } from '@/config/theme';
import { ScreenLoader } from '@/components/States';
import type { Product } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
const W = Dimensions.get('window').width;

export function ProductDetailScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const id = route.params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      setProduct(data as Product);
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: w } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('user_id', u.user.id)
          .eq('product_id', id)
          .maybeSingle();
        setSaved(!!w);
      }
      setLoading(false);
    })();
  }, [id]);

  const addToCart = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return navigation.navigate('Auth');
    setAdding(true);
    const { error } = await supabase
      .from('cart_items')
      .upsert(
        { user_id: u.user.id, product_id: id, qty: 1 },
        { onConflict: 'user_id,product_id' }
      );
    setAdding(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Added', 'Item added to your cart.');
  };

  const toggleWishlist = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return navigation.navigate('Auth');
    if (saved) {
      await supabase.from('wishlist_items').delete().eq('user_id', u.user.id).eq('product_id', id);
      setSaved(false);
    } else {
      await supabase.from('wishlist_items').insert({ user_id: u.user.id, product_id: id });
      setSaved(true);
    }
  };

  if (loading || !product) return <ScreenLoader />;

  const gallery = (product.gallery && product.gallery.length > 0
    ? product.gallery
    : product.image
    ? [product.image]
    : []) as string[];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleWishlist} style={styles.iconBtn}>
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={22}
            color={saved ? theme.colors.danger : theme.colors.foreground}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {gallery.map((src, i) => (
            <Image key={i} source={{ uri: src }} style={{ width: W, height: W }} resizeMode="cover" />
          ))}
          {gallery.length === 0 ? <View style={{ width: W, height: W, backgroundColor: theme.colors.mutedSurface }} /> : null}
        </ScrollView>

        <View style={styles.body}>
          <Text style={styles.price}>${Number(product.price ?? 0).toFixed(2)}</Text>
          <Text style={styles.title}>{product.title}</Text>
          {product.rating ? (
            <Text style={styles.rating}>
              ★ {Number(product.rating).toFixed(1)} · {product.review_count ?? 0} reviews
            </Text>
          ) : null}
          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.cta}>
        <TouchableOpacity style={styles.ctaBtn} onPress={addToCart} disabled={adding}>
          <Ionicons name="bag-handle" size={18} color={theme.colors.background} />
          <Text style={styles.ctaText}>{adding ? 'Adding…' : 'Add to cart'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  topbar: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 16, gap: 6 },
  price: { fontFamily: theme.fonts.display, fontWeight: '800', fontSize: 26, color: theme.colors.foreground },
  title: { fontFamily: theme.fonts.body, fontWeight: '600', fontSize: 16, color: theme.colors.foreground },
  rating: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13 },
  desc: { marginTop: 12, color: theme.colors.foreground, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 },
  cta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, backgroundColor: theme.colors.background,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  ctaBtn: {
    flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.colors.foreground, padding: 16, borderRadius: 14,
  },
  ctaText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
});
