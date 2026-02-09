import Api from "@framework/api/utils/api-config";
import { useEffect, useMemo, useState } from "react";

import { Product } from "../types";
import { CatalogFiltersResponse } from "../utils/types";

export function useCatalogFilters() {
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<string[]>([]);
  const [catalogSubcategories, setCatalogSubcategories] = useState<string[]>([]);
  const [catalogBrandsByCategory, setCatalogBrandsByCategory] = useState<
    Record<string, string[]>
  >({});
  const [catalogSubcategoriesByCategory, setCatalogSubcategoriesByCategory] = useState<
    Record<string, string[]>
  >({});
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);

  // Fetch catalog filters
  useEffect(() => {
    let cancelled = false;

    // Сначала пробуем загрузить из локального кэша
    try {
      const cached = localStorage.getItem("catalog_filters_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.categories)) setCatalogCategories(parsed.categories);
          if (Array.isArray(parsed.brands)) setCatalogBrands(parsed.brands);
          if (Array.isArray(parsed.subcategories)) setCatalogSubcategories(parsed.subcategories);
          if (parsed.brandsByCategory) setCatalogBrandsByCategory(parsed.brandsByCategory);
          if (parsed.subcategoriesByCategory) setCatalogSubcategoriesByCategory(parsed.subcategoriesByCategory);
        }
      }
    } catch (e) {
      console.warn("Failed to load filters from cache", e);
    }

    (async () => {
      try {
        const { data } = await Api.get<CatalogFiltersResponse>(
          "/catalog-filters"
        );
        if (cancelled) return;

        console.log("Filters loaded from API:", data);

        const categories = Array.isArray(data?.categories)
          ? data.categories.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const brands = Array.isArray(data?.brands)
          ? data.brands.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const subcategories = Array.isArray(data?.subcategories)
          ? data.subcategories.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const brandsByCategoryRaw = data?.brandsByCategory;
        const brandsByCategory =
          brandsByCategoryRaw && typeof brandsByCategoryRaw === "object"
            ? brandsByCategoryRaw
            : {};
        const subcategoriesByCategoryRaw = data?.subcategoriesByCategory;
        const subcategoriesByCategory =
          subcategoriesByCategoryRaw && typeof subcategoriesByCategoryRaw === "object"
            ? subcategoriesByCategoryRaw
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

        const normalizedSubcategoriesByCategory: Record<string, string[]> =
          Object.fromEntries(
            Object.entries(subcategoriesByCategory).map(([k, v]) => {
              const key = String(k).trim();
              const value = Array.isArray(v)
                ? v.map((x) => String(x).trim()).filter(Boolean)
                : [];
              return [key, value] as const;
            })
          );

        console.log("Normalized subcategories:", normalizedSubcategoriesByCategory);

        setCatalogCategories(categories);
        setCatalogBrands(brands);
        setCatalogSubcategories(subcategories);
        setCatalogBrandsByCategory(normalizedBrandsByCategory);
        setCatalogSubcategoriesByCategory(normalizedSubcategoriesByCategory);

        // Сохраняем в кэш для следующего раза
        localStorage.setItem("catalog_filters_v2", JSON.stringify({
          categories,
          brands,
          subcategories,
          brandsByCategory: normalizedBrandsByCategory,
          subcategoriesByCategory: normalizedSubcategoriesByCategory,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error("Failed to load catalog filters:", err);
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

  // Subcategories derived from selected category (hide for "Часы")
  const derivedSubcategories = useMemo<string[]>(() => {
    // Скрываем для категории "Часы"
    if (activeCategory === "Часы") return [];

    console.log("Stats:", {
      activeCategory,
      keys: Object.keys(catalogSubcategoriesByCategory),
      hasKey: !!catalogSubcategoriesByCategory[activeCategory],
      val: catalogSubcategoriesByCategory[activeCategory]
    });

    if (activeCategory !== "Все") {
      const subcatsForCategory = catalogSubcategoriesByCategory[activeCategory];
      if (Array.isArray(subcatsForCategory) && subcatsForCategory.length) {
        return ["Все", ...subcatsForCategory];
      }
      return [];
    }

    // Для "Все" показываем все подкатегории
    if (catalogSubcategories.length) return ["Все", ...catalogSubcategories];
    return [];
  }, [activeCategory, catalogSubcategories, catalogSubcategoriesByCategory]);

  // Reset brand if not in derived brands
  useEffect(() => {
    if (activeBrand === "Все") return;
    if (!derivedBrands.includes(activeBrand)) {
      setActiveBrand("Все");
    }
  }, [activeBrand, derivedBrands]);

  // Reset subcategory if not in derived subcategories or category changed
  useEffect(() => {
    if (activeSubcategory === "Все") return;
    if (!derivedSubcategories.includes(activeSubcategory)) {
      setActiveSubcategory("Все");
    }
  }, [activeSubcategory, derivedSubcategories]);

  // Reset subcategory when category changes
  useEffect(() => {
    setActiveSubcategory("Все");
  }, [activeCategory]);

  const resetFilters = () => {
    setActiveBrand("Все");
    setActiveCategory("Все");
    setActiveSubcategory("Все");
    setSearchQuery("");
  };

  return {
    activeBrand,
    setActiveBrand,
    activeCategory,
    setActiveCategory,
    activeSubcategory,
    setActiveSubcategory,
    searchQuery,
    setSearchQuery,
    derivedCategories,
    derivedBrands,
    derivedSubcategories,
    resetFilters,
    setSourceProducts
  };
}
