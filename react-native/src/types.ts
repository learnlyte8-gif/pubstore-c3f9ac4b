// Shared types matching the Supabase public schema columns used by the app.
// Kept loose — only the fields we read are typed.

export type Product = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  gallery: string[] | null;
  category_slug: string | null;
  supplier_id: string | null;
  rating: number | null;
  review_count: number | null;
  sold: number | null;
  active: boolean | null;
  description?: string | null;
  created_at?: string;
};

export type Category = {
  slug: string;
  name: string;
  icon: string | null;
  image: string | null;
};

export type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  qty: number;
  created_at: string;
  product?: Product;
};

export type WishlistItem = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
};

export type Conversation = {
  id: string;
  buyer_id: string;
  supplier_id: string | null;
  title: string | null;
  kind: string | null;
  last_message_at?: string | null;
  unread_count?: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export type Ride = {
  id: string;
  rider_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_address: string | null;
  dropoff_address: string | null;
  status: 'searching' | 'offered' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare: number | null;
  created_at: string;
};

export type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};
