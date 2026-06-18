// Guest-mode local storage helpers. Guests can browse, wishlist, and add to
// cart without signing in. We store these in localStorage and merge into
// Supabase the first time the user signs in.

const KEYS = {
  cart: "pubstore.guest.cart",
  wishlist: "pubstore.guest.wishlist",
  interests: "pubstore.guest.interests",
  verticals: "pubstore.guest.verticals",
  onboarded: "pubstore.guest.onboarded",
} as const;

export type GuestCartItem = { product_id: string; qty: number };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export const guestCart = {
  get: (): GuestCartItem[] => read<GuestCartItem[]>(KEYS.cart, []),
  set: (items: GuestCartItem[]) => write(KEYS.cart, items),
  add: (productId: string, qty = 1) => {
    const items = guestCart.get();
    const existing = items.find((i) => i.product_id === productId);
    if (existing) existing.qty += qty;
    else items.push({ product_id: productId, qty });
    guestCart.set(items);
    return items;
  },
  remove: (productId: string) => {
    const items = guestCart.get().filter((i) => i.product_id !== productId);
    guestCart.set(items);
    return items;
  },
  update: (productId: string, qty: number) => {
    let items = guestCart.get();
    if (qty <= 0) items = items.filter((i) => i.product_id !== productId);
    else items = items.map((i) => (i.product_id === productId ? { ...i, qty } : i));
    guestCart.set(items);
    return items;
  },
  clear: () => guestCart.set([]),
};

export const guestWishlist = {
  get: (): string[] => read<string[]>(KEYS.wishlist, []),
  set: (ids: string[]) => write(KEYS.wishlist, ids),
  toggle: (productId: string) => {
    const ids = guestWishlist.get();
    const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
    guestWishlist.set(next);
    return next;
  },
  clear: () => guestWishlist.set([]),
};

export const guestInterests = {
  get: (): string[] => read<string[]>(KEYS.interests, []),
  set: (items: string[]) => write(KEYS.interests, items),
};

export const guestVerticals = {
  get: (): string[] => read<string[]>(KEYS.verticals, []),
  set: (items: string[]) => write(KEYS.verticals, items),
};

export const guestOnboarded = {
  get: (): boolean => read<boolean>(KEYS.onboarded, false),
  set: (v: boolean) => write(KEYS.onboarded, v),
};
