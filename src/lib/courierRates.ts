// Shared logistics rate model + calculator used by both supplier (when
// configuring a courier they partner with) and buyers (at checkout) so the
// quoted price is consistent.

export type WeightTier = {
  /** Upper inclusive bound for this tier, in kg. Last tier can be `null` for "and above". */
  up_to_kg: number | null;
  /** Flat surcharge added once shipment fits in this weight bracket. */
  flat: number;
  /** Per-km price within this weight bracket. */
  per_km: number;
};

export type DistanceDiscount = {
  /** Discount kicks in once route is at least this many km. */
  above_km: number;
  /** Percentage off the distance-based portion, 0-100. */
  percent: number;
};

export type CourierRate = {
  base_fee: number | null;
  per_km_fee: number | null;
  min_fee: number | null;
  free_delivery_above: number | null;
  currency: string;
  weight_tiers: WeightTier[];
  distance_discounts: DistanceDiscount[];
};

export type Quote = {
  amount: number;
  currency: string;
  breakdown: string[];
};

const num = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function pickWeightTier(tiers: WeightTier[], weightKg: number): WeightTier | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => {
    const ak = a.up_to_kg == null ? Infinity : a.up_to_kg;
    const bk = b.up_to_kg == null ? Infinity : b.up_to_kg;
    return ak - bk;
  });
  for (const t of sorted) {
    const cap = t.up_to_kg == null ? Infinity : t.up_to_kg;
    if (weightKg <= cap) return t;
  }
  return sorted[sorted.length - 1] ?? null;
}

export function pickDistanceDiscount(discounts: DistanceDiscount[], distanceKm: number): DistanceDiscount | null {
  if (!discounts || discounts.length === 0) return null;
  const eligible = discounts.filter((d) => distanceKm >= num(d.above_km));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, d) => (num(d.percent) > num(best.percent) ? d : best));
}

export function quoteCourierRate(
  rate: CourierRate,
  opts: { distanceKm?: number; weightKg?: number; orderSubtotal?: number }
): Quote {
  const distanceKm = num(opts.distanceKm, 0);
  const weightKg = num(opts.weightKg, 1);
  const orderSubtotal = num(opts.orderSubtotal, 0);
  const breakdown: string[] = [];

  // Free shipping above a subtotal threshold short-circuits everything.
  if (rate.free_delivery_above != null && orderSubtotal >= num(rate.free_delivery_above)) {
    breakdown.push(`Free delivery (orders over ${rate.currency} ${rate.free_delivery_above})`);
    return { amount: 0, currency: rate.currency, breakdown };
  }

  let total = num(rate.base_fee, 0);
  if (total > 0) breakdown.push(`Base ${rate.currency} ${total.toFixed(2)}`);

  const tier = pickWeightTier(rate.weight_tiers, weightKg);
  let perKm = num(rate.per_km_fee, 0);
  if (tier) {
    if (num(tier.flat) > 0) {
      total += num(tier.flat);
      breakdown.push(`Weight tier ≤${tier.up_to_kg ?? "∞"}kg flat ${rate.currency} ${num(tier.flat).toFixed(2)}`);
    }
    if (num(tier.per_km) > 0) perKm = num(tier.per_km);
  }

  let distanceCost = perKm * distanceKm;
  if (distanceCost > 0) breakdown.push(`${distanceKm.toFixed(1)}km × ${rate.currency} ${perKm.toFixed(2)}/km`);

  const discount = pickDistanceDiscount(rate.distance_discounts, distanceKm);
  if (discount && distanceCost > 0) {
    const off = distanceCost * (num(discount.percent) / 100);
    distanceCost -= off;
    breakdown.push(`-${num(discount.percent)}% long-haul discount (${rate.currency} ${off.toFixed(2)} off)`);
  }
  total += distanceCost;

  const minFee = num(rate.min_fee, 0);
  if (minFee > 0 && total < minFee) {
    breakdown.push(`Minimum fee ${rate.currency} ${minFee.toFixed(2)} applied`);
    total = minFee;
  }

  return { amount: Math.max(0, total), currency: rate.currency, breakdown };
}

export function courierToRate(courier: any): CourierRate {
  return {
    base_fee: courier?.base_fee == null ? null : Number(courier.base_fee),
    per_km_fee: courier?.per_km_fee == null ? null : Number(courier.per_km_fee),
    min_fee: courier?.min_fee == null ? null : Number(courier.min_fee),
    free_delivery_above: courier?.free_delivery_above == null ? null : Number(courier.free_delivery_above),
    currency: courier?.currency || "USD",
    weight_tiers: Array.isArray(courier?.weight_tiers) ? courier.weight_tiers : [],
    distance_discounts: Array.isArray(courier?.distance_discounts) ? courier.distance_discounts : [],
  };
}

export function summarizeRate(rate: CourierRate): string {
  const parts: string[] = [];
  if (rate.base_fee != null) parts.push(`${rate.currency} ${Number(rate.base_fee).toFixed(2)} base`);
  if (rate.per_km_fee != null) parts.push(`${rate.currency} ${Number(rate.per_km_fee).toFixed(2)}/km`);
  if (rate.weight_tiers.length) parts.push(`${rate.weight_tiers.length} weight tier${rate.weight_tiers.length > 1 ? "s" : ""}`);
  if (rate.distance_discounts.length) parts.push(`long-haul discount`);
  if (rate.free_delivery_above != null) parts.push(`free over ${rate.currency} ${rate.free_delivery_above}`);
  return parts.length ? parts.join(" · ") : "Custom quote";
}
