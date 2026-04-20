import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { PRODUCTS, type Product } from "@/data/products";

type CartItem = { productId: string; qty: number };

type ShopState = {
  cart: CartItem[];
  wishlist: string[];
  addToCart: (id: string, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  cartCount: number;
  cartTotal: number;
  cartProducts: { product: Product; qty: number }[];
};

const ShopContext = createContext<ShopState | null>(null);
const CART_KEY = "pubstore.cart.v1";
const WISH_KEY = "pubstore.wish.v1";

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

export function ShopProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => safeParse(localStorage.getItem(CART_KEY), []));
  const [wishlist, setWishlist] = useState<string[]>(() => safeParse(localStorage.getItem(WISH_KEY), []));

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(WISH_KEY, JSON.stringify(wishlist)); }, [wishlist]);

  const value = useMemo<ShopState>(() => {
    const productMap = new Map(PRODUCTS.map((p) => [p.id, p]));
    const cartProducts = cart
      .map((c) => {
        const product = productMap.get(c.productId);
        return product ? { product, qty: c.qty } : null;
      })
      .filter((x): x is { product: Product; qty: number } => x !== null);

    return {
      cart,
      wishlist,
      addToCart: (id, qty = 1) =>
        setCart((prev) => {
          const found = prev.find((c) => c.productId === id);
          if (found) return prev.map((c) => (c.productId === id ? { ...c, qty: c.qty + qty } : c));
          return [...prev, { productId: id, qty }];
        }),
      removeFromCart: (id) => setCart((prev) => prev.filter((c) => c.productId !== id)),
      updateQty: (id, qty) =>
        setCart((prev) =>
          qty <= 0 ? prev.filter((c) => c.productId !== id) : prev.map((c) => (c.productId === id ? { ...c, qty } : c))
        ),
      clearCart: () => setCart([]),
      toggleWishlist: (id) =>
        setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      isWishlisted: (id) => wishlist.includes(id),
      cartCount: cart.reduce((sum, c) => sum + c.qty, 0),
      cartTotal: cartProducts.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
      cartProducts,
    };
  }, [cart, wishlist]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
};
