import type { LucideIcon } from "lucide-react";
import {
  Shirt,
  Smartphone,
  Home as HomeIcon,
  Sparkles,
  Dumbbell,
  Gamepad2,
  Car,
  ShoppingBasket,
  BookOpen,
  PawPrint,
} from "lucide-react";

export type Category = {
  id: string;
  name: string;
  icon: LucideIcon;
};

export type Product = {
  id: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  sold: number;
  category: string;
  badge?: "Hot" | "New" | "Deal" | "Top";
  freeShipping?: boolean;
};

export const CATEGORIES: Category[] = [
  { id: "fashion", name: "Fashion", icon: Shirt },
  { id: "electronics", name: "Electronics", icon: Smartphone },
  { id: "home", name: "Home", icon: HomeIcon },
  { id: "beauty", name: "Beauty", icon: Sparkles },
  { id: "sports", name: "Sports", icon: Dumbbell },
  { id: "toys", name: "Toys", icon: Gamepad2 },
  { id: "auto", name: "Auto", icon: Car },
  { id: "grocery", name: "Grocery", icon: ShoppingBasket },
  { id: "books", name: "Books", icon: BookOpen },
  { id: "pets", name: "Pets", icon: PawPrint },
];

// Picsum seed-based images = stable URLs, free, no API needed
const img = (seed: string, w = 600, h = 600) =>
  `https://picsum.photos/seed/pubstore-${seed}/${w}/${h}`;

export const PRODUCTS: Product[] = [
  { id: "p1", title: "Wireless Bluetooth Earbuds Pro Noise Cancelling", image: img("earbuds"), price: 24.99, originalPrice: 79.99, rating: 4.7, reviews: 1283, sold: 12500, category: "electronics", badge: "Hot", freeShipping: true },
  { id: "p2", title: "Women's Oversized Cotton Blazer Jacket Beige", image: img("blazer"), price: 39.5, originalPrice: 89.0, rating: 4.6, reviews: 642, sold: 4800, category: "fashion", badge: "Deal", freeShipping: true },
  { id: "p3", title: "Smart Watch Series 9 Fitness Tracker", image: img("smartwatch"), price: 49.99, originalPrice: 149.99, rating: 4.8, reviews: 3104, sold: 28000, category: "electronics", badge: "Top", freeShipping: true },
  { id: "p4", title: "Minimalist Ceramic Coffee Mug Set (4-pack)", image: img("mugs"), price: 18.9, originalPrice: 35.0, rating: 4.5, reviews: 412, sold: 2100, category: "home", badge: "Deal" },
  { id: "p5", title: "Hydrating Vitamin C Serum 30ml", image: img("serum"), price: 12.49, originalPrice: 29.99, rating: 4.9, reviews: 5821, sold: 41000, category: "beauty", badge: "Hot", freeShipping: true },
  { id: "p6", title: "Pro Football Soccer Ball Match Size 5", image: img("football"), price: 22.0, rating: 4.4, reviews: 187, sold: 1400, category: "sports" },
  { id: "p7", title: "Plush Teddy Bear Soft Toy 60cm", image: img("teddy"), price: 19.99, originalPrice: 34.0, rating: 4.7, reviews: 803, sold: 6700, category: "toys", badge: "New" },
  { id: "p8", title: "Car Phone Holder Magnetic Dashboard Mount", image: img("carmount"), price: 9.99, originalPrice: 24.99, rating: 4.3, reviews: 2210, sold: 15800, category: "auto", badge: "Deal", freeShipping: true },
  { id: "p9", title: "Mechanical Keyboard RGB 87 Keys Hot-Swap", image: img("keyboard"), price: 59.0, originalPrice: 119.0, rating: 4.8, reviews: 1542, sold: 9300, category: "electronics", badge: "Top" },
  { id: "p10", title: "Men's Slim Fit Linen Shirt Summer", image: img("linen"), price: 28.5, rating: 4.5, reviews: 309, sold: 1800, category: "fashion", freeShipping: true },
  { id: "p11", title: "LED Strip Lights 10m WiFi Smart App", image: img("ledstrip"), price: 14.9, originalPrice: 39.9, rating: 4.6, reviews: 4120, sold: 33000, category: "home", badge: "Hot", freeShipping: true },
  { id: "p12", title: "Air Fryer 5L Digital Touchscreen", image: img("airfryer"), price: 79.0, originalPrice: 159.0, rating: 4.7, reviews: 2034, sold: 11200, category: "home", badge: "Deal", freeShipping: true },
  { id: "p13", title: "Yoga Mat Eco TPE 6mm Non-Slip", image: img("yogamat"), price: 21.0, rating: 4.6, reviews: 528, sold: 3700, category: "sports", badge: "New" },
  { id: "p14", title: "Sneakers Unisex Lightweight Running", image: img("sneakers"), price: 42.0, originalPrice: 89.0, rating: 4.5, reviews: 1102, sold: 7800, category: "fashion", badge: "Deal", freeShipping: true },
  { id: "p15", title: "4K Action Camera Waterproof 30m", image: img("actioncam"), price: 64.99, originalPrice: 199.0, rating: 4.4, reviews: 612, sold: 4100, category: "electronics" },
  { id: "p16", title: "Organic Green Tea Loose Leaf 200g", image: img("greentea"), price: 11.9, rating: 4.8, reviews: 245, sold: 1600, category: "grocery", badge: "New" },
  { id: "p17", title: "Bestseller Novel: The Quiet Sea", image: img("book1"), price: 9.5, rating: 4.7, reviews: 1340, sold: 8800, category: "books", badge: "Top" },
  { id: "p18", title: "Pet Bed Cushion Soft Washable Medium", image: img("petbed"), price: 26.0, originalPrice: 49.0, rating: 4.6, reviews: 421, sold: 2900, category: "pets", badge: "Deal", freeShipping: true },
];

export const FLASH_DEALS = PRODUCTS.filter((p) => p.originalPrice).slice(0, 8);
export const TRENDING = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 6);

export const discountPct = (p: Product) =>
  p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;

export const getRecommended = (interests: string[] = []) => {
  if (!interests.length) return PRODUCTS;
  const lower = interests.map((i) => i.toLowerCase());
  const matchCat = (c: string) => lower.some((i) => c.includes(i) || i.includes(c));
  const liked = PRODUCTS.filter((p) => matchCat(p.category));
  const others = PRODUCTS.filter((p) => !matchCat(p.category));
  return [...liked, ...others];
};
