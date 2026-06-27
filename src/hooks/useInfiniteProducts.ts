import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/data/products";

export type InfiniteProductsOpts = Omit<Parameters<typeof fetchProducts>[0], "offset" | "limit"> & {
  pageSize?: number;
};

/**
 * Infinite-scroll wrapper around fetchProducts.
 *  - pageSize defaults to 20
 *  - returns flattened items + standard react-query infinite controls
 *  - hasNextPage = the last page returned a full pageSize (heuristic, avoids extra count query)
 */
export function useInfiniteProducts(opts: InfiniteProductsOpts = {}) {
  const { pageSize = 20, ...rest } = opts;
  const query = useInfiniteQuery({
    queryKey: ["products-infinite", { ...rest, pageSize }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchProducts({ ...rest, limit: pageSize, offset: (pageParam as number) * pageSize }),
    getNextPageParam: (last, all) => (last.length < pageSize ? undefined : all.length),
  });

  const items = (query.data?.pages ?? []).flat();
  return { ...query, items };
}
