import { useQuery } from "@tanstack/react-query";
import {
  fetchProducts,
  fetchProduct,
  fetchSupplier,
  fetchSuppliers,
  fetchMySupplier,
  fetchProductTierPrices,
  fetchProductReviews,
  fetchCategories,
} from "@/data/products";

export const useProducts = (opts: Parameters<typeof fetchProducts>[0] = {}) =>
  useQuery({ queryKey: ["products", opts], queryFn: () => fetchProducts(opts) });

export const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
  });

export const useSupplier = (id: string | undefined) =>
  useQuery({
    queryKey: ["supplier", id],
    queryFn: () => fetchSupplier(id!),
    enabled: !!id,
  });

export const useSuppliers = (opts: Parameters<typeof fetchSuppliers>[0] = {}) =>
  useQuery({ queryKey: ["suppliers", opts], queryFn: () => fetchSuppliers(opts) });

export const useMySupplier = () =>
  useQuery({ queryKey: ["my-supplier"], queryFn: fetchMySupplier });

export const useTierPrices = (productId: string | undefined) =>
  useQuery({
    queryKey: ["tier-prices", productId],
    queryFn: () => fetchProductTierPrices(productId!),
    enabled: !!productId,
  });

export const useReviews = (productId: string | undefined) =>
  useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetchProductReviews(productId!),
    enabled: !!productId,
  });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
