import { supabase } from "@/integrations/supabase/client";

// =================== SERVICES ===================
export type ServiceProvider = {
  id: string;
  user_id: string;
  display_name: string;
  category: string;
  subcategory: string | null;
  bio: string | null;
  skills: string[];
  hourly_rate: number | null;
  currency: string;
  service_area: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cover: string | null;
  gallery: string[];
  rating: number;
  jobs_completed: number;
  verified: boolean;
  active: boolean;
};

export type ServiceRequest = {
  id: string;
  buyer_id: string;
  title: string;
  description: string | null;
  category: string;
  budget: number | null;
  currency: string;
  deadline: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  gallery: string[];
  status: string;
  assigned_provider_id: string | null;
  created_at: string;
};

export type ServiceBid = {
  id: string;
  request_id: string;
  provider_user_id: string;
  provider_name: string | null;
  provider_avatar: string | null;
  price: number;
  currency: string;
  eta_days: number | null;
  message: string | null;
  status: string;
  created_at: string;
};

export async function fetchServiceProviders(opts: { category?: string; limit?: number } = {}): Promise<ServiceProvider[]> {
  let q = supabase.from("service_providers").select("*").eq("active", true).order("rating", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as ServiceProvider[];
}

export async function fetchServiceProvider(id: string): Promise<ServiceProvider | null> {
  const { data } = await supabase.from("service_providers").select("*").eq("id", id).maybeSingle();
  return (data as ServiceProvider) ?? null;
}

export async function fetchServiceRequests(opts: { status?: string; limit?: number } = {}): Promise<ServiceRequest[]> {
  let q = supabase.from("service_requests").select("*").order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as ServiceRequest[];
}

// =================== PROPERTIES ===================
export type Property = {
  id: string;
  owner_user_id: string;
  title: string;
  listing_type: string;
  property_kind: string;
  bedrooms: number | null;
  baths: number | null;
  area_sqm: number | null;
  price: number;
  currency: string;
  price_period: string;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  cover: string | null;
  gallery: string[];
  description: string | null;
  amenities: string[];
  virtual_tour_url: string | null;
  furnished: boolean;
  available_from: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  active: boolean;
  featured: boolean;
  views: number;
};

export async function fetchProperties(opts: { listing_type?: string; property_kind?: string; limit?: number } = {}): Promise<Property[]> {
  let q = supabase.from("properties").select("*").eq("active", true).order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (opts.listing_type) q = q.eq("listing_type", opts.listing_type);
  if (opts.property_kind) q = q.eq("property_kind", opts.property_kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as Property[];
}

export async function fetchProperty(id: string): Promise<Property | null> {
  const { data } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  return (data as Property) ?? null;
}

// =================== LOGISTICS ===================
export type LogisticsRequest = {
  id: string;
  buyer_id: string;
  title: string;
  description: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  distance_km: number | null;
  weight_kg: number | null;
  package_kind: string | null;
  vehicle_type: string;
  budget: number | null;
  currency: string;
  pickup_at: string | null;
  status: string;
  assigned_driver_id: string | null;
  gallery: string[];
  created_at: string;
};

export async function fetchLogisticsRequests(opts: { status?: string; limit?: number } = {}): Promise<LogisticsRequest[]> {
  let q = supabase.from("logistics_requests").select("*").order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as LogisticsRequest[];
}

// =================== FINANCE ===================
export type FinanceProduct = {
  id: string;
  owner_user_id: string;
  title: string;
  kind: string;
  provider_name: string | null;
  cover: string | null;
  gallery: string[];
  description: string | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string;
  interest_rate: number | null;
  term_months: number | null;
  requirements: string[];
  features: string[];
  country: string | null;
  city: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  active: boolean;
  featured: boolean;
};

export async function fetchFinanceProducts(opts: { kind?: string; limit?: number } = {}): Promise<FinanceProduct[]> {
  let q = supabase.from("finance_products").select("*").eq("active", true).order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as FinanceProduct[];
}

export async function fetchFinanceProduct(id: string): Promise<FinanceProduct | null> {
  const { data } = await supabase.from("finance_products").select("*").eq("id", id).maybeSingle();
  return (data as FinanceProduct) ?? null;
}

export const SERVICE_CATEGORIES = [
  { slug: "plumber", label: "Plumber" },
  { slug: "electrician", label: "Electrician" },
  { slug: "mechanic", label: "Mechanic" },
  { slug: "tutor", label: "Tutor" },
  { slug: "tailor", label: "Tailor" },
  { slug: "hairdresser", label: "Hairdresser" },
  { slug: "cleaner", label: "Cleaning" },
  { slug: "painter", label: "Painter" },
  { slug: "tiler", label: "Tiler" },
  { slug: "photographer", label: "Photographer" },
  { slug: "designer", label: "Designer" },
  { slug: "marketing", label: "Marketing" },
  { slug: "other", label: "Other" },
];

export const FINANCE_KINDS = [
  { slug: "loan", label: "Personal loan" },
  { slug: "vehicle_financing", label: "Vehicle financing" },
  { slug: "working_capital", label: "Working capital" },
  { slug: "insurance", label: "Insurance" },
];

export const PROPERTY_KINDS = [
  { slug: "apartment", label: "Apartment" },
  { slug: "house", label: "House" },
  { slug: "room", label: "Room / shared" },
  { slug: "land", label: "Land" },
  { slug: "commercial", label: "Commercial" },
];

// =================== CAR RENTALS ===================
export type CarRental = {
  id: string;
  owner_user_id: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_class: string;
  body_type: string | null;
  transmission: string;
  fuel: string;
  seats: number;
  doors: number | null;
  luggage: number | null;
  ac: boolean;
  features: string[];
  cover: string | null;
  gallery: string[];
  description: string | null;
  price_per_day: number;
  price_per_week: number | null;
  price_per_month: number | null;
  weekend_surcharge_pct: number | null;
  currency: string;
  deposit: number;
  free_km_per_day: number;
  unlimited_km: boolean;
  extra_km_fee: number | null;
  min_age: number;
  max_age: number | null;
  min_license_years: number;
  young_driver_fee: number | null;
  young_driver_age_threshold: number | null;
  required_documents: string[];
  international_license_ok: boolean;
  cross_border_allowed: boolean;
  cross_border_fee: number | null;
  cross_border_countries: string[];
  min_rental_days: number;
  max_rental_days: number | null;
  advance_booking_hours: number;
  pickup_locations: string[];
  delivery_available: boolean;
  delivery_fee: number | null;
  fuel_policy: string;
  smoking_allowed: boolean;
  pets_allowed: boolean;
  late_return_fee_per_hour: number | null;
  cleaning_fee: number | null;
  smoking_penalty: number | null;
  pet_penalty: number | null;
  damage_excess: number | null;
  cancellation_policy: string;
  cancellation_fee: number | null;
  custom_rules: string[];
  custom_penalties: { label: string; amount: number; currency?: string }[];
  insurance_included: boolean;
  insurance_provider: string | null;
  insurance_options: { label: string; price_per_day: number }[];
  city: string | null;
  country: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  rating: number;
  trips_completed: number;
  active: boolean;
  featured: boolean;
  verified: boolean;
};

export async function fetchCarRentals(opts: { vehicle_class?: string; limit?: number } = {}): Promise<CarRental[]> {
  let q = supabase.from("car_rentals").select("*").eq("active", true)
    .order("featured", { ascending: false })
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.vehicle_class) q = q.eq("vehicle_class", opts.vehicle_class);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as unknown as CarRental[];
}

export async function fetchCarRental(id: string): Promise<CarRental | null> {
  const { data } = await supabase.from("car_rentals").select("*").eq("id", id).maybeSingle();
  return (data as unknown as CarRental) ?? null;
}

export const CAR_RENTAL_CLASSES = [
  { slug: "economy", label: "Economy" },
  { slug: "compact", label: "Compact" },
  { slug: "suv", label: "SUV" },
  { slug: "luxury", label: "Luxury" },
  { slug: "exotic", label: "Exotic" },
  { slug: "van", label: "Van / minibus" },
  { slug: "bakkie", label: "Bakkie / pickup" },
  { slug: "ev", label: "Electric" },
];

export const CAR_RENTAL_DOCS = [
  { slug: "national_id", label: "National ID" },
  { slug: "drivers_license", label: "Driver's license" },
  { slug: "passport", label: "Passport" },
  { slug: "international_permit", label: "International driving permit" },
  { slug: "proof_of_address", label: "Proof of address" },
  { slug: "credit_card", label: "Credit card (deposit hold)" },
  { slug: "second_id", label: "Secondary ID" },
];

export const CAR_RENTAL_FEATURES = [
  "Bluetooth", "Apple CarPlay", "Android Auto", "GPS", "Reverse camera", "Sunroof",
  "Leather seats", "Heated seats", "Cruise control", "Tow bar", "Roof rack",
  "Child seat available", "Dashcam", "4x4", "Spare tire", "First aid kit",
];
