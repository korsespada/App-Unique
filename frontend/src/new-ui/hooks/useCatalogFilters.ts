import Api from "@framework/api/utils/api-config";
import { useEffect, useMemo, useState } from "react";

import { Product } from "../types";
import { CatalogFiltersResponse } from "../utils/types";

export function useCatalogFilters() {
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<string[]>([]);
  const [catalogBrandsByCategory, setCatalogBrandsByCategory] = useState<
    Record<string, string[]>
  >({});
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);

  // Fetch catalog filters
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await Api.get<CatalogFiltersResponse>(
          "/catalog-filters"
        );
        if (cancelled) return;

        const categories = Array.isArray(data?.categories)
          ? data.categories.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const brands = Array.isArray(data?.brands)
          ? data.brands.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const brandsByCategoryRaw = data?.brandsByCategory;
        const brandsByCategory =
          brandsByCategoryRaw && typeof brandsByCategoryRaw === "object"
          ? brandsByCategoryRaw
          : {};

        const normalizedBrandsByCategory: Record<string, string[]> =
          Object.fromEntries(
          Object.entries(brandsByCategory).map(([k, v]) => {
            const key = String(k).trim();
            const value = Array.isArray(v)
              ? v.map((x) => String(x).trim()).filter(Boolean)
              : [];
            return [key, value] as const;
          })
        );

        setCatalogCategories(categories);
        setCatalogBrands(brands);
        setCatalogBrandsByCategory(normalizedBrandsByCategory);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const derivedCategories = useMemo<string[]>(() => {
    if (catalogCategories.length) return ["Все", ...catalogCategories];

    const uniq = Array.from(
      new Set(
        sourceProducts
          .map((p) => String(p.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["Все", ...uniq];
  }, [catalogCategories, sourceProducts]);

  const derivedBrands = useMemo<string[]>(() => {
    if (activeCategory !== "Все") {
      const brandsForCategory = catalogBrandsByCategory[activeCategory];
      if (Array.isArray(brandsForCategory) && brandsForCategory.length) {
        return ["Все", ...brandsForCategory];
      }

      const fromProducts = Array.from(
        new Set(
          sourceProducts
            .filter((p) => String(p.category || "").trim() === activeCategory)
            .map((p) => String(p.brand || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));

      return ["Все", ...fromProducts];
    }

    if (catalogBrands.length) return ["Все", ...catalogBrands];

    const uniq = Array.from(
      new Set(
        sourceProducts.map((p) => String(p.brand || "").trim()).filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["Все", ...uniq];
  }, [activeCategory, catalogBrands, catalogBrandsByCategory, sourceProducts]);

  // Reset brand if not in derived brands
  useEffect(() => {
    if (activeBrand === "Все") return;
    if (!derivedBrands.includes(activeBrand)) {
      setActiveBrand("Все");
    }
  }, [activeBrand, derivedBrands]);

  const resetFilters = () => {
    setActiveBrand("Все");
    setActiveCategory("Все");
    setSearchQuery("");
  };

  return {
    activeBrand,
    setActiveBrand,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    derivedCategories,
    derivedBrands,
    resetFilters,
    setSourceProducts
  };
}
