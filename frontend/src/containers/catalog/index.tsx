import ProductsSkeleton from "@components/skeleton/products";
import { useGetExternalProducts } from "@framework/api/product/external-get";
import { useDebounce } from "@uidotdev/usehooks";
import { Button } from "antd";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import GaShop from "@ui-ga/GaShop";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    searchParams.get("category") || undefined
  );

  const [selectedBrandLine, setSelectedBrandLine] = useState<
    string | undefined
  >(searchParams.get("brand") || undefined);

  const { data, isLoading, isFetching, error, refetch } =
    useGetExternalProducts();

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

  const products = data?.products ?? [];

  const categories = Array.from(
    new Set(
      products.map((p) => p.category).filter((v): v is string => Boolean(v))
    )
  ).sort((a, b) => a.localeCompare(b));

  const brandLines = Array.from(
    new Set(
      products
        .map((p) => p.brand || p.season_title)
        .filter((v): v is string => Boolean(v))
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredProducts = products.filter((p) => {
    const categoryOk = !selectedCategory || p.category === selectedCategory;
    const brandValue = p.brand || p.season_title;
    const brandOk = !selectedBrandLine || brandValue === selectedBrandLine;
    const q = (debouncedSearchQuery || "").trim().toLowerCase();
    if (!q) {
      return categoryOk && brandOk;
    }

    const haystack = `${p.title || ""} ${p.name || ""} ${p.description || ""} ${p.category || ""} ${
      p.brand || ""
    } ${p.season_title || ""} ${p.product_id}`
      .toLowerCase()
      .trim();
    return categoryOk && brandOk && haystack.includes(q);
  });

  if (!data && (isLoading || isFetching)) {
    return <ProductsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-10">
        <div className="text-center">{error.message}</div>
        <Button onClick={() => refetch()} type="default">
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <GaShop
      products={filteredProducts}
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
  );
}
