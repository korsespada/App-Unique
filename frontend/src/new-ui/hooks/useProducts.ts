import {
  ExternalProductsPagedResponse,
  useGetExternalProducts
} from "@framework/api/product/external-get";
import { useQueryClient } from "@tanstack/react-query";
import {
 useCallback, useEffect, useMemo, useRef, useState 
} from "react";

import { CartItem, Product } from "../types";

interface UseProductsOptions {
  searchQuery: string;
  activeBrand: string;
  activeCategory: string;
}

export function useProducts({
  searchQuery,
  activeBrand,
  activeCategory
}: UseProductsOptions) {
  const queryClient = useQueryClient();
  const productsRef = useRef<Product[]>([]);
  const [loadMoreEl, setLoadMoreEl] = useState<HTMLDivElement | null>(null);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    setLoadMoreEl(node);
  }, []);

  const {
    data: externalData,
    isLoading: isExternalLoading,
    isFetching: isExternalFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useGetExternalProducts({
    search: searchQuery,
    brand: activeBrand === "Все" ? undefined : activeBrand,
    category: activeCategory === "Все" ? undefined : activeCategory
  });

  // Invalidate queries on filter change
  useEffect(() => {
    queryClient.invalidateQueries(["external-products"]);
  }, [searchQuery, activeBrand, activeCategory, queryClient]);

  // Transform API data to Product[]
  const apiProducts = useMemo<Product[]>(() => {
    const pages = (externalData?.pages
      || []) as ExternalProductsPagedResponse[];
    const raw = pages.flatMap((p) => Array.isArray(p?.products) ? p.products : []);

    return raw
      .map((p) => {
        const id = String((p as any).id || p.product_id || "");
        const name = String(p.title || p.name || p.product_id || "").trim();
        const brand = String(p.brand || p.season_title || "").trim();
        const category = String(p.category || "Все");
        const images =          Array.isArray(p.images) && p.images.length ? p.images : [];

        const rawPrice = Number((p as any).price);
        const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;

        return {
          id,
          name,
          brand: brand || " ",
          category,
          price: hasPrice ? rawPrice : 0,
          hasPrice,
          images: images.length
            ? images
            : [
              "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000"
            ],
          thumb: (p as any).thumb || "",
          description: String(p.description || ""),
          details: Array.isArray((p as any).details) ? (p as any).details : []
        };
      })
      .filter((p) => Boolean(p.id) && Boolean(p.name));
  }, [externalData]);

  const totalItems = useMemo(() => {
    const pages = (externalData?.pages
      || []) as ExternalProductsPagedResponse[];
    const first = pages[0];
    const totalItemsRaw = Number((first as any)?.totalItems);
    return Number.isFinite(totalItemsRaw) && totalItemsRaw >= 0
      ? totalItemsRaw
      : 0;
  }, [externalData]);

  // Update ref
  useEffect(() => {
    productsRef.current = apiProducts;
  }, [apiProducts]);

  // Show loading when:
  // 1. Initial load (isLoading)
  // 2. Fetching but NOT pagination (isFetching && !isFetchingNextPage)
  const isProductsLoading = isExternalLoading || (isExternalFetching && !isFetchingNextPage);

  return {
    products: apiProducts,
    productsRef,
    totalItems,
    isProductsLoading,
    loadMoreRef,
    loadMoreEl,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  };
}

// Hook for infinite scroll
export function useInfiniteScroll(
  currentView: string,
  loadMoreEl: HTMLDivElement | null,
  hasNextPage: boolean | undefined,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void
) {
  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (currentView !== "home") return undefined;
    const el = loadMoreEl;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasNextPage) return;
        if (isFetchingNextPage) return;
        fetchNextPage();
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [currentView, fetchNextPage, hasNextPage, isFetchingNextPage, loadMoreEl]);

  // Immediate check for visible load more element
  useEffect(() => {
    if (currentView !== "home") return;
    if (!hasNextPage) return;
    if (isFetchingNextPage) return;

    const el = loadMoreEl;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const rootMarginPx = 600;
    const inRange = rect.top <= window.innerHeight + rootMarginPx;
    if (!inRange) return;

    fetchNextPage();
  }, [currentView, fetchNextPage, hasNextPage, isFetchingNextPage, loadMoreEl]);
}

// Hook to sync cart with fresh product data
export function useSyncCartWithProducts(
  sourceProducts: Product[],
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
) {
  useEffect(() => {
    if (!sourceProducts.length) return;

    setCart((prev) => {
      let changed = false;
      const byId = new Map(
        sourceProducts.map((p) => [String(p.id), p] as const)
      );

      const next = prev.map((item) => {
        const fresh = byId.get(String(item.id));

        if (!fresh) {
          if (item.hasPrice !== false || Number(item.price) !== 0) {
            changed = true;
            return { ...item, hasPrice: false, price: 0 };
          }
          return item;
        }

        const nextItem: CartItem = { ...fresh, quantity: item.quantity };
        const same = item.name === nextItem.name;

        if (!same) changed = true;
        return same ? item : nextItem;
      });

      return changed ? next : prev;
    });
  }, [sourceProducts, setCart]);
}

// Hook to sync favorites with fresh product data
export function useSyncFavoritesWithProducts(
  favorites: string[],
  sourceProducts: Product[],
  setFavoriteItemsById: React.Dispatch<
    React.SetStateAction<Record<string, Product>>
  >
) {
  useEffect(() => {
    if (!favorites.length) return;
    if (!sourceProducts.length) return;
    const byId = new Map(sourceProducts.map((p) => [String(p.id), p] as const));
    setFavoriteItemsById((prev) => {
      let changed = false;
      const next = { ...prev };
      favorites.forEach((id) => {
        const fresh = byId.get(String(id));
        if (fresh) {
          next[String(id)] = fresh;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [favorites, sourceProducts, setFavoriteItemsById]);
}
