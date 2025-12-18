import ProductsSkeleton from "@components/skeleton/products";
import { ExternalProduct } from "@framework/types";
import Api from "@framework/api/utils/api-config";
import { useDebounce } from "@uidotdev/usehooks";
import { Button } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import GaShop from "@ui-ga/GaShop";

import type { GetProductsResponse, Product as BackendProduct } from "../../types";

const DEFAULT_LIMIT = 40;

function mapBackendProductToExternal(product: BackendProduct): ExternalProduct {
  return {
    product_id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    brand: product.brand,
    images: (product.photos || []).map((photo) => photo.url)
  };
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    searchParams.get("category") || undefined
  );

  const [selectedBrandLine, setSelectedBrandLine] = useState<string | undefined>(
    searchParams.get("brand") || undefined
  );

  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Кэш страниц: ключ = `${search}|${page}`
  const pagesCacheRef = useRef<
    Map<
      string,
      {
        products: BackendProduct[];
        total: number;
        page: number;
        hasMore: boolean;
      }
    >
  >(new Map());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Update URL when filters change
  const updateUrlParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  // Обновление query-параметра q в URL
  useEffect(() => {
    const q = (debouncedSearchQuery || "").trim();
    const current = (searchParams.get("q") || "").trim();
    if (q === current) return;
    updateUrlParams({ q: q || undefined });
  }, [debouncedSearchQuery, searchParams]);

  const handleCategoryChange = (value: string | undefined) => {
    setSelectedCategory(value);
    updateUrlParams({ category: value || undefined });
  };

  const handleBrandLineChange = (value: string | undefined) => {
    setSelectedBrandLine(value);
    updateUrlParams({ brand: value || undefined });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(undefined);
    setSelectedBrandLine(undefined);
    setSearchParams({});
  };

  const fetchPage = async (pageToLoad: number, search: string) => {
    const normalizedSearch = (search || "").trim().toLowerCase();
    const cacheKey = `${normalizedSearch}|${pageToLoad}`;

    if (pagesCacheRef.current.has(cacheKey)) {
      const cached = pagesCacheRef.current.get(cacheKey)!;
      const mapped: ExternalProduct[] = cached.products.map(mapBackendProductToExternal);

      setProducts((prev: ExternalProduct[]) => {
        const existingIds = new Set(prev.map((p: ExternalProduct) => p.product_id));
        const merged: ExternalProduct[] = [...prev];
        mapped.forEach((p: ExternalProduct) => {
          if (!existingIds.has(p.product_id)) {
            merged.push(p);
          }
        });
        return merged;
      });
      setHasMore(cached.hasMore);
      setInitialLoaded(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await Api.get<GetProductsResponse>("/../products", {
        params: {
          page: pageToLoad,
          limit: DEFAULT_LIMIT,
          search: normalizedSearch || undefined
        },
        timeout: 30000
      });

      const backendProducts: BackendProduct[] = data.products || [];
      const mapped: ExternalProduct[] = backendProducts.map(
        mapBackendProductToExternal
      );

      pagesCacheRef.current.set(cacheKey, {
        products: backendProducts,
        total: data.total,
        page: data.page,
        hasMore: data.hasMore
      });

      setProducts((prev: ExternalProduct[]) =>
        pageToLoad === 1
          ? mapped
          : [
              ...prev,
              ...mapped.filter(
                (p) =>
                  !prev.some(
                    (existing: ExternalProduct) => existing.product_id === p.product_id
                  )
              )
            ]
      );
      setHasMore(data.hasMore);
      setInitialLoaded(true);
    } catch (e: any) {
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Не удалось загрузить товары";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  };

  // Первая загрузка и загрузка при изменении поиска
  useEffect(() => {
    const normalizedSearch = (debouncedSearchQuery || "").trim().toLowerCase();

    // Сброс состояния и кэша при новом поисковом запросе
    setPage(1);
    setProducts([]);
    setHasMore(true);
    pagesCacheRef.current.clear();

    fetchPage(1, normalizedSearch);
  }, [debouncedSearchQuery]);

  // IntersectionObserver для бесконечной прокрутки
  useEffect(() => {
    if (!loaderRef.current) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loading && initialLoaded) {
          const nextPage = page + 1;
          setPage(nextPage);
          const normalizedSearch = (debouncedSearchQuery || "")
            .trim()
            .toLowerCase();
          fetchPage(nextPage, normalizedSearch);
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0
      }
    );

    observerRef.current.observe(loaderRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, initialLoaded, page, debouncedSearchQuery]);

  const categories = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p: ExternalProduct) => {
      if (p.category) {
        set.add(p.category);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const brandLines = useMemo<string[]>(() => {
    const set = new Set<string>();
    products.forEach((p: ExternalProduct) => {
      const brand = p.brand || p.season_title;
      if (brand) {
        set.add(brand);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  if (!initialLoaded && loading) {
    return <ProductsSkeleton />;
  }

  if (error && !initialLoaded) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-10">
        <div className="text-center">{error}</div>
        <Button
          onClick={() => {
            const normalizedSearch = (debouncedSearchQuery || "")
              .trim()
              .toLowerCase();
            fetchPage(1, normalizedSearch);
          }}
          type="default"
        >
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <>
      <GaShop
        products={products}
        categories={categories}
        brandLines={brandLines}
        selectedCategory={selectedCategory}
        selectedBrandLine={selectedBrandLine}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        onBrandLineChange={handleBrandLineChange}
        onClearFilters={handleClearFilters}
      />

      <div ref={loaderRef} className="w-full py-6 text-center text-xs text-gray-400">
        {loading && initialLoaded && hasMore && "Загрузка товаров..."}
        {!hasMore && initialLoaded && "Все товары загружены"}
      </div>
    </>
  );
}
