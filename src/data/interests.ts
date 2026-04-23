/** Master list of selectable interests — kept in sync with the live
 *  `categories` table so picking an interest always maps to a real
 *  category slug used by products. */
export const INTERESTS = [
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Beauty",
  "Sports",
  "Toys",
  "Automotive",
  "Industrial",
  "Agriculture",
  "Packaging",
  "Office",
  "Health",
] as const;

export type Interest = (typeof INTERESTS)[number];
