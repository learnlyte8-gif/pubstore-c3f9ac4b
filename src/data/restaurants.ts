import { supabase } from "@/integrations/supabase/client";

export type Restaurant = {
  id: string;
  owner_user_id: string;
  supplier_id: string | null;
  name: string;
  slug: string | null;
  cuisine: string | null;
  description: string | null;
  cover: string | null;
  gallery: string[];
  video_url: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  hours: Record<string, string>;
  price_level: number;
  rating: number;
  review_count: number;
  delivery_enabled: boolean;
  reservation_enabled: boolean;
  min_order: number;
  delivery_fee: number;
  prep_time_minutes: number;
  active: boolean;
  featured: boolean;
  created_at: string;
};

export type MenuCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image: string | null;
  gallery: string[];
  video_url: string | null;
  tags: string[];
  spicy: boolean;
  vegetarian: boolean;
  available: boolean;
  sort_order: number;
};

export type FoodOrderItem = {
  menu_item_id: string;
  name: string;
  qty: number;
  price: number;
};

export async function fetchRestaurants(opts: { cuisine?: string; city?: string; limit?: number } = {}): Promise<Restaurant[]> {
  let q = supabase.from("restaurants").select("*").eq("active", true)
    .order("featured", { ascending: false })
    .order("rating", { ascending: false });
  if (opts.cuisine) q = q.eq("cuisine", opts.cuisine);
  if (opts.city) q = q.eq("city", opts.city);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as unknown as Restaurant[];
}

export async function fetchRestaurant(id: string): Promise<Restaurant | null> {
  const { data } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
  return (data as unknown as Restaurant) ?? null;
}

export async function fetchMenu(restaurantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const [cats, items] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).eq("available", true).order("sort_order"),
  ]);
  return {
    categories: (cats.data ?? []) as MenuCategory[],
    items: (items.data ?? []) as unknown as MenuItem[],
  };
}

export async function fetchMyRestaurants(): Promise<Restaurant[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("restaurants").select("*").eq("owner_user_id", user.id).order("created_at", { ascending: false });
  return (data ?? []) as unknown as Restaurant[];
}

export const CUISINES = [
  "African", "American", "Asian", "BBQ", "Bakery", "Breakfast", "Burgers",
  "Cafe", "Caribbean", "Chinese", "Desserts", "Fast Food", "Healthy", "Indian",
  "Italian", "Japanese", "Mediterranean", "Mexican", "Pizza", "Seafood",
  "Steakhouse", "Sushi", "Thai", "Vegan", "Vegetarian",
];
