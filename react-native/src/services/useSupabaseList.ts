import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Generic list hook for any Supabase table. Returns rows + loading state and a refresh fn.
 * Pass `filter` to apply .eq() pairs; pass `search` columns to OR-search across columns.
 */
export function useSupabaseList<T = any>(opts: {
  table: string;
  select?: string;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  filter?: Record<string, unknown>;
  search?: { q: string; columns: string[] };
}) {
  const { table, select = '*', order, limit = 50, filter, search } = opts;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let qb = supabase.from(table).select(select).limit(limit);
    if (filter) Object.entries(filter).forEach(([k, v]) => { qb = (qb as any).eq(k, v); });
    if (search?.q.trim()) {
      const expr = search.columns.map((c) => `${c}.ilike.%${search.q.trim()}%`).join(',');
      qb = (qb as any).or(expr);
    }
    if (order) qb = (qb as any).order(order.column, { ascending: order.ascending ?? false });
    const { data: rows } = await qb;
    setData((rows as T[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [table, select, limit, JSON.stringify(filter), search?.q, JSON.stringify(search?.columns), order?.column, order?.ascending]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, refreshing, refresh: () => { setRefreshing(true); load(); }, reload: load };
}
