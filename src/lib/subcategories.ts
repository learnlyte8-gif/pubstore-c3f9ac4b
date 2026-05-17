// Lightweight subcategory derivation. We don't have a subcategory column in
// the DB, so we use a curated keyword list per top-level category and match
// product titles/descriptions against it. Subcategories with zero matches
// are hidden. Order is preserved from the curated list.
import type { Product } from "@/data/products";

export type Subcategory = { id: string; label: string; keywords: string[]; count: number };

const MAP: Record<string, { label: string; keywords: string[] }[]> = {
  electronics: [
    { label: "Smartphones", keywords: ["smartphone", "phone", "mobile"] },
    { label: "iPhones", keywords: ["iphone"] },
    { label: "Android", keywords: ["android", "samsung", "xiaomi", "redmi", "oppo", "vivo", "huawei", "pixel"] },
    { label: "Laptops", keywords: ["laptop", "macbook", "notebook", "ultrabook"] },
    { label: "Tablets", keywords: ["tablet", "ipad"] },
    { label: "Audio", keywords: ["headphone", "earbud", "earphone", "speaker", "airpod"] },
    { label: "TVs", keywords: ["tv", "television", "smart tv"] },
    { label: "Cameras", keywords: ["camera", "dslr", "gopro", "lens"] },
    { label: "Wearables", keywords: ["watch", "smartwatch", "band", "tracker"] },
    { label: "Accessories", keywords: ["charger", "cable", "case", "adapter", "power bank"] },
    { label: "Gaming", keywords: ["console", "playstation", "xbox", "nintendo", "controller"] },
  ],
  fashion: [
    { label: "Men", keywords: ["men", "mens", "men's"] },
    { label: "Women", keywords: ["women", "womens", "women's", "ladies"] },
    { label: "Kids", keywords: ["kid", "child", "boy", "girl", "baby"] },
    { label: "Shoes", keywords: ["shoe", "sneaker", "boot", "sandal", "heel"] },
    { label: "Bags", keywords: ["bag", "backpack", "handbag", "purse", "wallet"] },
    { label: "Watches", keywords: ["watch"] },
    { label: "Jewelry", keywords: ["jewel", "necklace", "ring", "earring", "bracelet"] },
    { label: "Dresses", keywords: ["dress", "gown"] },
    { label: "T-Shirts", keywords: ["t-shirt", "tshirt", "tee"] },
    { label: "Jeans", keywords: ["jean", "denim"] },
    { label: "Activewear", keywords: ["activewear", "gym", "yoga", "sport"] },
  ],
  home: [
    { label: "Furniture", keywords: ["sofa", "chair", "table", "bed", "desk", "couch", "furniture"] },
    { label: "Kitchen", keywords: ["kitchen", "cookware", "pan", "pot", "knife", "blender"] },
    { label: "Decor", keywords: ["decor", "vase", "frame", "art", "rug", "curtain"] },
    { label: "Bedding", keywords: ["bedding", "sheet", "pillow", "blanket", "duvet"] },
    { label: "Lighting", keywords: ["lamp", "light", "led", "bulb"] },
    { label: "Garden", keywords: ["garden", "plant", "outdoor", "patio"] },
    { label: "Storage", keywords: ["storage", "shelf", "organizer", "rack"] },
    { label: "Appliances", keywords: ["appliance", "fridge", "washer", "vacuum", "microwave"] },
  ],
  beauty: [
    { label: "Skincare", keywords: ["skin", "cream", "serum", "moisturizer", "cleanser"] },
    { label: "Makeup", keywords: ["makeup", "lipstick", "foundation", "mascara", "eyeshadow"] },
    { label: "Hair", keywords: ["hair", "shampoo", "conditioner"] },
    { label: "Fragrance", keywords: ["perfume", "fragrance", "cologne"] },
    { label: "Nails", keywords: ["nail", "polish", "manicure"] },
    { label: "Tools", keywords: ["brush", "dryer", "straightener", "curler"] },
  ],
  sports: [
    { label: "Fitness", keywords: ["fitness", "gym", "dumbbell", "weight"] },
    { label: "Outdoor", keywords: ["outdoor", "camping", "hiking", "tent"] },
    { label: "Cycling", keywords: ["bike", "bicycle", "cycling"] },
    { label: "Running", keywords: ["running", "runner", "jog"] },
    { label: "Yoga", keywords: ["yoga", "mat", "pilates"] },
    { label: "Team Sports", keywords: ["football", "soccer", "basketball", "cricket", "rugby"] },
    { label: "Water Sports", keywords: ["swim", "surf", "kayak"] },
  ],
  toys: [
    { label: "Educational", keywords: ["educational", "learning", "stem"] },
    { label: "Building", keywords: ["lego", "block", "building"] },
    { label: "Dolls", keywords: ["doll", "barbie"] },
    { label: "RC", keywords: ["rc", "remote control", "drone"] },
    { label: "Outdoor", keywords: ["outdoor", "ride-on"] },
    { label: "Puzzles", keywords: ["puzzle", "board game"] },
  ],
  automotive: [
    { label: "Cars", keywords: ["car", "sedan", "suv"] },
    { label: "Motorcycles", keywords: ["motorcycle", "bike", "scooter"] },
    { label: "Parts", keywords: ["part", "spare", "engine", "brake"] },
    { label: "Tires", keywords: ["tire", "tyre", "wheel"] },
    { label: "Accessories", keywords: ["accessory", "mat", "cover", "seat"] },
    { label: "Tools", keywords: ["tool", "jack", "wrench"] },
    { label: "Electronics", keywords: ["dashcam", "gps", "stereo"] },
  ],
  industrial: [
    { label: "Machinery", keywords: ["machine", "machinery", "cnc"] },
    { label: "Tools", keywords: ["tool", "drill", "saw"] },
    { label: "Safety", keywords: ["safety", "helmet", "glove", "ppe"] },
    { label: "Construction", keywords: ["construction", "cement", "steel"] },
    { label: "Electrical", keywords: ["electrical", "wire", "cable", "motor"] },
    { label: "Hydraulics", keywords: ["hydraulic", "pneumatic", "pump"] },
  ],
  agriculture: [
    { label: "Seeds", keywords: ["seed"] },
    { label: "Fertilizer", keywords: ["fertilizer", "compost"] },
    { label: "Tools", keywords: ["tool", "hoe", "shovel"] },
    { label: "Machinery", keywords: ["tractor", "harvester", "machinery"] },
    { label: "Livestock", keywords: ["livestock", "cattle", "poultry", "chicken"] },
    { label: "Irrigation", keywords: ["irrigation", "pump", "sprinkler"] },
  ],
  packaging: [
    { label: "Boxes", keywords: ["box", "carton"] },
    { label: "Bags", keywords: ["bag", "pouch"] },
    { label: "Bottles", keywords: ["bottle", "jar"] },
    { label: "Labels", keywords: ["label", "sticker"] },
    { label: "Tape", keywords: ["tape", "seal"] },
    { label: "Eco", keywords: ["eco", "biodegradable", "compostable"] },
  ],
  office: [
    { label: "Stationery", keywords: ["pen", "pencil", "paper", "notebook"] },
    { label: "Furniture", keywords: ["desk", "chair", "cabinet"] },
    { label: "Printers", keywords: ["printer", "ink", "toner"] },
    { label: "Electronics", keywords: ["computer", "monitor", "keyboard", "mouse"] },
    { label: "Storage", keywords: ["folder", "binder", "organizer"] },
  ],
  health: [
    { label: "Vitamins", keywords: ["vitamin", "supplement"] },
    { label: "Medical", keywords: ["medical", "thermometer", "blood pressure"] },
    { label: "Personal Care", keywords: ["personal care", "hygiene"] },
    { label: "Fitness", keywords: ["fitness", "yoga"] },
    { label: "Dental", keywords: ["dental", "toothbrush", "toothpaste"] },
    { label: "First Aid", keywords: ["first aid", "bandage", "plaster"] },
  ],
};

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function matches(p: Product, kws: string[]): boolean {
  const hay = `${p.title} ${p.description ?? ""}`.toLowerCase();
  return kws.some((k) => hay.includes(k.toLowerCase()));
}

export function deriveSubcategories(categoryId: string, products: Product[]): Subcategory[] {
  const defs = MAP[categoryId];
  if (!defs?.length || !products.length) return [];
  return defs
    .map((d) => ({
      id: slug(d.label),
      label: d.label,
      keywords: d.keywords,
      count: products.reduce((n, p) => (matches(p, d.keywords) ? n + 1 : n), 0),
    }))
    .filter((s) => s.count > 0);
}

export function filterBySubcategory(products: Product[], sub: Subcategory | null): Product[] {
  if (!sub) return products;
  return products.filter((p) => matches(p, sub.keywords));
}
