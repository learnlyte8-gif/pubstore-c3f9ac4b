/** Master list of selectable interests (used by Onboarding & Settings). */
export const INTERESTS = [
  "Fashion", "Electronics", "Beauty", "Home", "Sports", "Books",
  "Toys", "Groceries", "Art", "Handmade", "Jewelry", "Footwear",
  "Health", "Pets", "Auto", "Garden",
] as const;

export type Interest = (typeof INTERESTS)[number];
