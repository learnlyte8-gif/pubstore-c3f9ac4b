import { createContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapProduct, type Product } from "@/data/products";
import { guestCart, guestWishlist } from "@/lib/guest";

type CartRow = { id: string; product_id: string; qty: number };

type CartItemWithProduct = { product: Product; qty: number; rowId: string };

type ShopState = {
  cart: { productId: string; qty: number }[];
  wishlist: string[];
  loading: boolean;
  isGuest: boolean;
  addToCart: (productId: string, qty?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQty: (productId: string, qty: number) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  cartCount: number;
  cartTotal: number;
  cartProducts: CartItemWithProduct[];
  refresh: () => Promise<void>;
};

const ShopContext = createContext<ShopState | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cartRows, setCartRows] = useState<CartRow[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const productCache = useRef<Map<string, Product>>(new Map());
  const mergedRef = useRef(false);

  // Track auth user id
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const hydrateProducts = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !productCache.current.has(id));
    if (missing.length === 0) {
      setProducts(new Map(productCache.current));
      return;
    }
    const { data } = await supabase.from("products").select("*").in("id", missing);
    (data ?? []).forEach((p) => {
      const mapped = mapProduct(p as Parameters<typeof mapProduct>[0]);
      productCache.current.set(mapped.id, mapped);
    });
    setProducts(new Map(productCache.current));
  }, []);

  // Merge guest cart/wishlist into the user's account on first sign-in
  const mergeGuestData = useCallback(
    async (uid: string) => {
      if (mergedRef.current) return;
      mergedRef.current = true;
      const localCart = guestCart.get();
      const localWish = guestWishlist.get();
      if (localCart.length === 0 && localWish.length === 0) return;

      try {
        if (localWish.length) {
          const rows = localWish.map((product_id) => ({ user_id: uid, product_id }));
          await supabase.from("wishlist_items").upsert(rows, { onConflict: "user_id,product_id", ignoreDuplicates: true });
        }
        if (localCart.length) {
          const { data: existing } = await supabase
            .from("cart_items")
            .select("id,product_id,qty")
            .eq("user_id", uid);
          const existingMap = new Map((existing ?? []).map((r) => [r.product_id, r]));
          for (const item of localCart) {
            const ex = existingMap.get(item.product_id);
            if (ex) {
              await supabase.from("cart_items").update({ qty: ex.qty + item.qty }).eq("id", ex.id);
            } else {
              await supabase.from("cart_items").insert({ user_id: uid, product_id: item.product_id, qty: item.qty });
            }
          }
        }
        guestCart.clear();
        guestWishlist.clear();
      } catch (e) {
        console.warn("guest merge failed", e);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!authReady) return;

    if (!userId) {
      // Guest mode — load from localStorage
      const localCart = guestCart.get();
      const localWish = guestWishlist.get();
      const fakeRows: CartRow[] = localCart.map((c) => ({
        id: `guest:${c.product_id}`,
        product_id: c.product_id,
        qty: c.qty,
      }));
      setCartRows(fakeRows);
      setWishlist(localWish);
      const ids = Array.from(new Set([...localCart.map((c) => c.product_id), ...localWish]));
      if (ids.length) await hydrateProducts(ids);
      setLoading(false);
      return;
    }

    setLoading(true);
    await mergeGuestData(userId);
    const [{ data: cart }, { data: wish }] = await Promise.all([
      supabase.from("cart_items").select("id,product_id,qty").eq("user_id", userId),
      supabase.from("wishlist_items").select("product_id").eq("user_id", userId),
    ]);
    const cartList = (cart ?? []) as CartRow[];
    const wishList = (wish ?? []).map((w) => w.product_id);
    setCartRows(cartList);
    setWishlist(wishList);
    const ids = Array.from(new Set([...cartList.map((c) => c.product_id), ...wishList]));
    if (ids.length) await hydrateProducts(ids);
    setLoading(false);
  }, [userId, authReady, hydrateProducts, mergeGuestData]);

  useEffect(() => { refresh(); }, [refresh]);

  const addToCart = useCallback(
    async (productId: string, qty = 1) => {
      if (!userId) {
        const items = guestCart.add(productId, qty);
        setCartRows(items.map((c) => ({ id: `guest:${c.product_id}`, product_id: c.product_id, qty: c.qty })));
        await hydrateProducts([productId]);
        return;
      }
      const existing = cartRows.find((c) => c.product_id === productId);
      if (existing) {
        const newQty = existing.qty + qty;
        setCartRows((prev) => prev.map((c) => (c.id === existing.id ? { ...c, qty: newQty } : c)));
        await supabase.from("cart_items").update({ qty: newQty }).eq("id", existing.id);
      } else {
        const { data } = await supabase
          .from("cart_items")
          .insert({ user_id: userId, product_id: productId, qty })
          .select("id,product_id,qty")
          .single();
        if (data) setCartRows((prev) => [...prev, data as CartRow]);
        await hydrateProducts([productId]);
      }
    },
    [userId, cartRows, hydrateProducts],
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (!userId) {
        const items = guestCart.remove(productId);
        setCartRows(items.map((c) => ({ id: `guest:${c.product_id}`, product_id: c.product_id, qty: c.qty })));
        return;
      }
      const row = cartRows.find((c) => c.product_id === productId);
      if (!row) return;
      setCartRows((prev) => prev.filter((c) => c.id !== row.id));
      await supabase.from("cart_items").delete().eq("id", row.id);
    },
    [userId, cartRows],
  );

  const updateQty = useCallback(
    async (productId: string, qty: number) => {
      if (!userId) {
        const items = guestCart.update(productId, qty);
        setCartRows(items.map((c) => ({ id: `guest:${c.product_id}`, product_id: c.product_id, qty: c.qty })));
        return;
      }
      const row = cartRows.find((c) => c.product_id === productId);
      if (!row) return;
      if (qty <= 0) return removeFromCart(productId);
      setCartRows((prev) => prev.map((c) => (c.id === row.id ? { ...c, qty } : c)));
      await supabase.from("cart_items").update({ qty }).eq("id", row.id);
    },
    [userId, cartRows, removeFromCart],
  );

  const clearCart = useCallback(async () => {
    if (!userId) {
      guestCart.clear();
      setCartRows([]);
      return;
    }
    setCartRows([]);
    await supabase.from("cart_items").delete().eq("user_id", userId);
  }, [userId]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!userId) {
        const next = guestWishlist.toggle(productId);
        setWishlist(next);
        if (next.includes(productId)) await hydrateProducts([productId]);
        return;
      }
      const exists = wishlist.includes(productId);
      if (exists) {
        setWishlist((prev) => prev.filter((p) => p !== productId));
        await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("product_id", productId);
      } else {
        setWishlist((prev) => [...prev, productId]);
        await supabase.from("wishlist_items").insert({ user_id: userId, product_id: productId });
        await hydrateProducts([productId]);
      }
    },
    [userId, wishlist, hydrateProducts],
  );

  const value = useMemo<ShopState>(() => {
    const cartProducts: CartItemWithProduct[] = cartRows
      .map((c) => {
        const product = products.get(c.product_id);
        return product ? { product, qty: c.qty, rowId: c.id } : null;
      })
      .filter((x): x is CartItemWithProduct => x !== null);

    return {
      cart: cartRows.map((c) => ({ productId: c.product_id, qty: c.qty })),
      wishlist,
      loading,
      isGuest: !userId,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      toggleWishlist,
      isWishlisted: (id) => wishlist.includes(id),
      cartCount: cartRows.reduce((sum, c) => sum + c.qty, 0),
      cartTotal: cartProducts.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
      cartProducts,
      refresh,
    };
  }, [cartRows, wishlist, products, loading, userId, addToCart, removeFromCart, updateQty, clearCart, toggleWishlist, refresh]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export { ShopContext };
export { useShop } from "./useShop";
