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

export type TierPrice = { minQty: number; price: number };
export type Variant = { id: string; name: string; image?: string };
export type VariantGroup = { name: string; options: Variant[] };

export type Supplier = {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  yearsActive: number;
  responseRate: number;
  responseTime: string;
  onTimeDelivery: number;
  rating: number;
  verified: boolean;
  gold: boolean;
  tradeAssurance: boolean;
  logo: string;
  banner: string;
  about: string;
};

export type Review = {
  id: string;
  user: string;
  country: string;
  rating: number;
  date: string;
  text: string;
  variant?: string;
};

export type Product = {
  id: string;
  title: string;
  image: string;
  gallery?: string[];
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  sold: number;
  category: string;
  badge?: "Hot" | "New" | "Deal" | "Top";
  freeShipping?: boolean;
  // B2B
  supplierId: string;
  moq: number;
  unit: string;
  leadTime: string;
  shipFrom: string;
  tierPrices?: TierPrice[];
  variants?: VariantGroup[];
  specs?: { label: string; value: string }[];
  description?: string;
  reviewList?: Review[];
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

const img = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/pubstore-${seed}/${w}/${h}`;

export const SUPPLIERS: Supplier[] = [
  {
    id: "s1",
    name: "Shenzhen Aurora Electronics Co., Ltd",
    country: "China",
    countryCode: "CN",
    yearsActive: 8,
    responseRate: 98,
    responseTime: "≤ 2h",
    onTimeDelivery: 96,
    rating: 4.8,
    verified: true,
    gold: true,
    tradeAssurance: true,
    logo: img("sup-aurora-logo", 120, 120),
    banner: img("sup-aurora-banner", 1200, 400),
    about: "Leading manufacturer of consumer electronics with 12+ production lines and a 6,000m² facility.",
  },
  {
    id: "s2",
    name: "Guangzhou Lumière Apparel Group",
    country: "China",
    countryCode: "CN",
    yearsActive: 12,
    responseRate: 95,
    responseTime: "≤ 4h",
    onTimeDelivery: 93,
    rating: 4.7,
    verified: true,
    gold: true,
    tradeAssurance: true,
    logo: img("sup-lumiere-logo", 120, 120),
    banner: img("sup-lumiere-banner", 1200, 400),
    about: "Full-package fashion supplier specializing in private label and OEM since 2012.",
  },
  {
    id: "s3",
    name: "Yiwu HomeCraft Trading Co.",
    country: "China",
    countryCode: "CN",
    yearsActive: 5,
    responseRate: 91,
    responseTime: "≤ 6h",
    onTimeDelivery: 90,
    rating: 4.5,
    verified: true,
    gold: false,
    tradeAssurance: true,
    logo: img("sup-homecraft-logo", 120, 120),
    banner: img("sup-homecraft-banner", 1200, 400),
    about: "Sourcing partner for home, kitchen and lifestyle goods across 30+ factories.",
  },
  {
    id: "s4",
    name: "Mumbai Wellness Naturals Pvt Ltd",
    country: "India",
    countryCode: "IN",
    yearsActive: 6,
    responseRate: 94,
    responseTime: "≤ 3h",
    onTimeDelivery: 92,
    rating: 4.6,
    verified: true,
    gold: true,
    tradeAssurance: true,
    logo: img("sup-mumbai-logo", 120, 120),
    banner: img("sup-mumbai-banner", 1200, 400),
    about: "Ayurvedic and natural beauty manufacturer with GMP & ISO 22716 certifications.",
  },
  {
    id: "s5",
    name: "Istanbul Atlas Sports Industries",
    country: "Türkiye",
    countryCode: "TR",
    yearsActive: 9,
    responseRate: 90,
    responseTime: "≤ 5h",
    onTimeDelivery: 91,
    rating: 4.5,
    verified: true,
    gold: false,
    tradeAssurance: false,
    logo: img("sup-atlas-logo", 120, 120),
    banner: img("sup-atlas-banner", 1200, 400),
    about: "Manufacturer and exporter of sports equipment and outdoor gear since 2015.",
  },
];

const gallery = (seed: string) => [
  img(`${seed}-1`),
  img(`${seed}-2`),
  img(`${seed}-3`),
  img(`${seed}-4`),
  img(`${seed}-5`),
];

const sampleReviews = (seed: string): Review[] => [
  {
    id: `${seed}-r1`,
    user: "Alex M.",
    country: "United States",
    rating: 5,
    date: "2025-02-12",
    text: "Excellent quality, exactly as described. Packaging was professional and delivery was faster than expected.",
    variant: "Black",
  },
  {
    id: `${seed}-r2`,
    user: "Maya K.",
    country: "Germany",
    rating: 4,
    date: "2025-01-28",
    text: "Good product overall, the supplier was very responsive. Would order again for our next batch.",
  },
  {
    id: `${seed}-r3`,
    user: "Carlos R.",
    country: "Mexico",
    rating: 5,
    date: "2025-01-15",
    text: "Great communication and the samples matched the production order perfectly.",
    variant: "Large",
  },
];

const colors: VariantGroup = {
  name: "Color",
  options: [
    { id: "black", name: "Black" },
    { id: "white", name: "White" },
    { id: "blue", name: "Navy Blue" },
    { id: "beige", name: "Beige" },
  ],
};
const sizes: VariantGroup = {
  name: "Size",
  options: [
    { id: "s", name: "S" },
    { id: "m", name: "M" },
    { id: "l", name: "L" },
    { id: "xl", name: "XL" },
  ],
};

const enrich = (p: Omit<Product, "supplierId" | "moq" | "unit" | "leadTime" | "shipFrom"> & Partial<Product>): Product => ({
  ...p,
  gallery: p.gallery ?? gallery(p.id),
  supplierId: p.supplierId ?? "s1",
  moq: p.moq ?? 1,
  unit: p.unit ?? "piece",
  leadTime: p.leadTime ?? "7–15 days",
  shipFrom: p.shipFrom ?? "Shenzhen, China",
  tierPrices: p.tierPrices,
  variants: p.variants,
  specs: p.specs,
  description: p.description,
  reviewList: p.reviewList ?? sampleReviews(p.id),
});

export const PRODUCTS: Product[] = [
  enrich({
    id: "p1", title: "Wireless Bluetooth Earbuds Pro Noise Cancelling",
    image: img("earbuds"), price: 24.99, originalPrice: 79.99, rating: 4.7, reviews: 1283, sold: 12500,
    category: "electronics", badge: "Hot", freeShipping: true,
    supplierId: "s1", moq: 2, unit: "pair", leadTime: "5–10 days", shipFrom: "Shenzhen, China",
    tierPrices: [
      { minQty: 2, price: 24.99 },
      { minQty: 50, price: 21.5 },
      { minQty: 200, price: 18.9 },
      { minQty: 1000, price: 15.5 },
    ],
    variants: [colors],
    specs: [
      { label: "Driver", value: "10mm dynamic" },
      { label: "Battery life", value: "8h + 32h with case" },
      { label: "Bluetooth", value: "5.3" },
      { label: "Water resistance", value: "IPX5" },
      { label: "Charging", value: "USB-C / Wireless Qi" },
    ],
    description:
      "Active noise cancelling true wireless earbuds with hi-fi audio, transparency mode and a 40-hour total battery life. OEM and private label available.",
  }),
  enrich({
    id: "p2", title: "Women's Oversized Cotton Blazer Jacket Beige",
    image: img("blazer"), price: 39.5, originalPrice: 89.0, rating: 4.6, reviews: 642, sold: 4800,
    category: "fashion", badge: "Deal", freeShipping: true,
    supplierId: "s2", moq: 10, unit: "piece", leadTime: "12–20 days", shipFrom: "Guangzhou, China",
    tierPrices: [
      { minQty: 10, price: 39.5 },
      { minQty: 100, price: 32.0 },
      { minQty: 500, price: 27.5 },
    ],
    variants: [
      { name: "Color", options: [{ id: "beige", name: "Beige" }, { id: "black", name: "Black" }, { id: "cream", name: "Cream" }] },
      sizes,
    ],
    specs: [
      { label: "Material", value: "70% Cotton, 30% Polyester" },
      { label: "Fit", value: "Oversized" },
      { label: "Care", value: "Machine wash cold" },
    ],
    description: "Tailored oversized blazer with structured shoulders and double-button closure. Custom labels and packaging available.",
  }),
  enrich({
    id: "p3", title: "Smart Watch Series 9 Fitness Tracker",
    image: img("smartwatch"), price: 49.99, originalPrice: 149.99, rating: 4.8, reviews: 3104, sold: 28000,
    category: "electronics", badge: "Top", freeShipping: true,
    supplierId: "s1", moq: 1, unit: "piece", leadTime: "5–10 days",
    tierPrices: [
      { minQty: 1, price: 49.99 },
      { minQty: 50, price: 42.0 },
      { minQty: 500, price: 35.0 },
    ],
    variants: [{ name: "Strap", options: [{ id: "black", name: "Black" }, { id: "silver", name: "Silver" }, { id: "rose", name: "Rose Gold" }] }],
    specs: [
      { label: "Display", value: "1.85\" AMOLED" },
      { label: "Sensors", value: "Heart rate, SpO2, accelerometer" },
      { label: "Water resistance", value: "5 ATM" },
      { label: "Battery", value: "Up to 14 days" },
    ],
  }),
  enrich({
    id: "p4", title: "Minimalist Ceramic Coffee Mug Set (4-pack)",
    image: img("mugs"), price: 18.9, originalPrice: 35.0, rating: 4.5, reviews: 412, sold: 2100,
    category: "home", badge: "Deal",
    supplierId: "s3", moq: 20, unit: "set", leadTime: "10–18 days", shipFrom: "Yiwu, China",
    tierPrices: [
      { minQty: 20, price: 18.9 },
      { minQty: 200, price: 15.5 },
      { minQty: 1000, price: 12.0 },
    ],
  }),
  enrich({
    id: "p5", title: "Hydrating Vitamin C Serum 30ml",
    image: img("serum"), price: 12.49, originalPrice: 29.99, rating: 4.9, reviews: 5821, sold: 41000,
    category: "beauty", badge: "Hot", freeShipping: true,
    supplierId: "s4", moq: 50, unit: "bottle", leadTime: "10–15 days", shipFrom: "Mumbai, India",
    tierPrices: [
      { minQty: 50, price: 12.49 },
      { minQty: 500, price: 9.9 },
      { minQty: 5000, price: 7.5 },
    ],
    specs: [
      { label: "Volume", value: "30 ml" },
      { label: "Skin type", value: "All" },
      { label: "Certifications", value: "GMP, ISO 22716" },
      { label: "Shelf life", value: "24 months" },
    ],
  }),
  enrich({
    id: "p6", title: "Pro Football Soccer Ball Match Size 5",
    image: img("football"), price: 22.0, rating: 4.4, reviews: 187, sold: 1400, category: "sports",
    supplierId: "s5", moq: 10, unit: "ball", leadTime: "7–14 days", shipFrom: "Istanbul, Türkiye",
  }),
  enrich({
    id: "p7", title: "Plush Teddy Bear Soft Toy 60cm",
    image: img("teddy"), price: 19.99, originalPrice: 34.0, rating: 4.7, reviews: 803, sold: 6700,
    category: "toys", badge: "New",
    supplierId: "s3", moq: 24, unit: "piece", leadTime: "12–18 days",
  }),
  enrich({
    id: "p8", title: "Car Phone Holder Magnetic Dashboard Mount",
    image: img("carmount"), price: 9.99, originalPrice: 24.99, rating: 4.3, reviews: 2210, sold: 15800,
    category: "auto", badge: "Deal", freeShipping: true,
    supplierId: "s1", moq: 5, unit: "piece", leadTime: "5–10 days",
  }),
  enrich({
    id: "p9", title: "Mechanical Keyboard RGB 87 Keys Hot-Swap",
    image: img("keyboard"), price: 59.0, originalPrice: 119.0, rating: 4.8, reviews: 1542, sold: 9300,
    category: "electronics", badge: "Top",
    supplierId: "s1", moq: 2, unit: "piece", leadTime: "7–12 days",
    variants: [{ name: "Switch", options: [{ id: "red", name: "Red" }, { id: "brown", name: "Brown" }, { id: "blue", name: "Blue" }] }],
  }),
  enrich({
    id: "p10", title: "Men's Slim Fit Linen Shirt Summer",
    image: img("linen"), price: 28.5, rating: 4.5, reviews: 309, sold: 1800,
    category: "fashion", freeShipping: true,
    supplierId: "s2", moq: 10, unit: "piece", leadTime: "12–18 days",
    variants: [colors, sizes],
  }),
  enrich({
    id: "p11", title: "LED Strip Lights 10m WiFi Smart App",
    image: img("ledstrip"), price: 14.9, originalPrice: 39.9, rating: 4.6, reviews: 4120, sold: 33000,
    category: "home", badge: "Hot", freeShipping: true,
    supplierId: "s1", moq: 5, unit: "piece", leadTime: "5–10 days",
  }),
  enrich({
    id: "p12", title: "Air Fryer 5L Digital Touchscreen",
    image: img("airfryer"), price: 79.0, originalPrice: 159.0, rating: 4.7, reviews: 2034, sold: 11200,
    category: "home", badge: "Deal", freeShipping: true,
    supplierId: "s3", moq: 5, unit: "piece", leadTime: "12–20 days",
  }),
  enrich({
    id: "p13", title: "Yoga Mat Eco TPE 6mm Non-Slip",
    image: img("yogamat"), price: 21.0, rating: 4.6, reviews: 528, sold: 3700,
    category: "sports", badge: "New",
    supplierId: "s5", moq: 20, unit: "piece", leadTime: "10–15 days",
  }),
  enrich({
    id: "p14", title: "Sneakers Unisex Lightweight Running",
    image: img("sneakers"), price: 42.0, originalPrice: 89.0, rating: 4.5, reviews: 1102, sold: 7800,
    category: "fashion", badge: "Deal", freeShipping: true,
    supplierId: "s2", moq: 10, unit: "pair", leadTime: "12–18 days",
    variants: [{ name: "Size", options: [{ id: "40", name: "40" }, { id: "41", name: "41" }, { id: "42", name: "42" }, { id: "43", name: "43" }, { id: "44", name: "44" }] }],
  }),
  enrich({
    id: "p15", title: "4K Action Camera Waterproof 30m",
    image: img("actioncam"), price: 64.99, originalPrice: 199.0, rating: 4.4, reviews: 612, sold: 4100,
    category: "electronics",
    supplierId: "s1", moq: 2, unit: "piece", leadTime: "7–12 days",
  }),
  enrich({
    id: "p16", title: "Organic Green Tea Loose Leaf 200g",
    image: img("greentea"), price: 11.9, rating: 4.8, reviews: 245, sold: 1600,
    category: "grocery", badge: "New",
    supplierId: "s4", moq: 30, unit: "pack", leadTime: "10–15 days",
  }),
  enrich({
    id: "p17", title: "Hardcover Notebook A5 Premium Paper",
    image: img("book1"), price: 9.5, rating: 4.7, reviews: 1340, sold: 8800,
    category: "books", badge: "Top",
    supplierId: "s3", moq: 50, unit: "piece", leadTime: "10–15 days",
  }),
  enrich({
    id: "p18", title: "Pet Bed Cushion Soft Washable Medium",
    image: img("petbed"), price: 26.0, originalPrice: 49.0, rating: 4.6, reviews: 421, sold: 2900,
    category: "pets", badge: "Deal", freeShipping: true,
    supplierId: "s3", moq: 10, unit: "piece", leadTime: "10–18 days",
  }),
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

export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
export const getSupplier = (id: string) => SUPPLIERS.find((s) => s.id === id);
export const getProductsBySupplier = (supplierId: string) =>
  PRODUCTS.filter((p) => p.supplierId === supplierId);
export const getRelated = (p: Product, limit = 6) =>
  PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category).slice(0, limit);

export const tierPriceFor = (p: Product, qty: number): number => {
  if (!p.tierPrices?.length) return p.price;
  const sorted = [...p.tierPrices].sort((a, b) => a.minQty - b.minQty);
  let price = sorted[0].price;
  for (const tier of sorted) {
    if (qty >= tier.minQty) price = tier.price;
  }
  return price;
};
