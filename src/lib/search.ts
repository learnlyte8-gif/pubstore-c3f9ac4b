/**
 * Lightweight YouTube-style search ranker.
 * - Tokenises queries, ignores stopwords.
 * - Scores across multiple weighted fields with prefix + fuzzy matching.
 * - Adds popularity (sold/rating/reviews) and recency (deal/new) boosts.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with",
  "by", "is", "are", "be", "i", "want", "need", "looking", "buy", "shop",
]);

export type Searchable = {
  id: string;
  title: string;
  category: string;
  badge?: string | null;
  supplierName?: string;
  description?: string;
  rating: number;
  reviews: number;
  sold: number;
  freeShipping?: boolean;
  dealEndsAt?: string | null;
};

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !STOPWORDS.has(t));
}

/** Damerau-Levenshtein distance, capped early for speed. */
function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  const cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

/** Score how well a single token matches a single word. */
function tokenWordScore(token: string, word: string): number {
  if (!word) return 0;
  if (word === token) return 1;
  if (word.startsWith(token)) return 0.85;
  if (word.includes(token)) return 0.6;
  if (token.length >= 4) {
    const d = editDistance(token, word, 2);
    if (d === 1) return 0.5;
    if (d === 2 && token.length >= 6) return 0.3;
  }
  return 0;
}

/** Best score for a token across all words in a field. */
function fieldScore(token: string, field: string | undefined | null): number {
  if (!field) return 0;
  const words = field.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;
  for (const w of words) {
    const s = tokenWordScore(token, w);
    if (s > best) best = s;
    if (best >= 1) break;
  }
  return best;
}

const FIELD_WEIGHTS = {
  title: 5,
  category: 2.5,
  badge: 1.2,
  supplierName: 1.8,
  description: 1,
} as const;

const REQUIRED_TOKEN_THRESHOLD = 0.3;

/** Final ranked results. Items missing too many tokens are dropped. */
export function rankSearch<T extends Searchable>(
  items: T[],
  query: string,
): { item: T; score: number }[] {
  const tokens = tokenize(query);
  if (!tokens.length) return items.map((item) => ({ item, score: 0 }));

  const now = Date.now();
  const ranked: { item: T; score: number }[] = [];

  for (const item of items) {
    let total = 0;
    let matchedTokens = 0;

    for (const t of tokens) {
      const s =
        fieldScore(t, item.title) * FIELD_WEIGHTS.title +
        fieldScore(t, item.category) * FIELD_WEIGHTS.category +
        fieldScore(t, item.badge) * FIELD_WEIGHTS.badge +
        fieldScore(t, item.supplierName) * FIELD_WEIGHTS.supplierName +
        fieldScore(t, item.description) * FIELD_WEIGHTS.description;

      const tokenBest = Math.max(
        fieldScore(t, item.title),
        fieldScore(t, item.category),
        fieldScore(t, item.badge),
        fieldScore(t, item.supplierName),
        fieldScore(t, item.description),
      );

      if (tokenBest >= REQUIRED_TOKEN_THRESHOLD) matchedTokens++;
      total += s;
    }

    // Drop items that don't match a meaningful share of the query.
    const requiredMatches = Math.max(1, Math.ceil(tokens.length * 0.5));
    if (matchedTokens < requiredMatches) continue;

    // Popularity & quality boosts (small, just tie-breakers).
    const pop = Math.log10((item.sold ?? 0) + 1) * 0.6;
    const qual = (item.rating ?? 0) * 0.2 + Math.log10((item.reviews ?? 0) + 1) * 0.3;
    const ship = item.freeShipping ? 0.2 : 0;

    let recency = 0;
    if (item.dealEndsAt) {
      const ms = new Date(item.dealEndsAt).getTime() - now;
      if (ms > 0 && ms < 1000 * 60 * 60 * 48) recency += 0.6;
    }

    ranked.push({ item, score: total + pop + qual + ship + recency });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** Suggested completions from popular product titles. */
export function suggestCompletions(
  items: { title: string; category: string }[],
  query: string,
  limit = 6,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const t = it.title.toLowerCase();
    if (t.startsWith(q) && !seen.has(t)) {
      seen.add(t);
      out.push(it.title);
      if (out.length >= limit) return out;
    }
  }
  for (const it of items) {
    const t = it.title.toLowerCase();
    if (!t.startsWith(q) && t.includes(q) && !seen.has(t)) {
      seen.add(t);
      out.push(it.title);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
