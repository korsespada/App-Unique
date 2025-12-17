import ProductsSkeleton from "@components/skeleton/products";
import { useGetExternalProducts } from "@framework/api/product/external-get";
import { useDebounce } from "@uidotdev/usehooks";
import { Button } from "antd";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import CatalogFilters from "./filters";

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
    updateUrlParams({ q: value || undefined });
  };

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

    const haystack = `${p.description} ${p.category || ""} ${p.brand || ""} ${
      p.season_title || ""
    } ${p.product_id}`
      .toLowerCase()
      .trim();
    return categoryOk && brandOk && haystack.includes(q);
  });

  const renderContent = () => {
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

    if (filteredProducts.length > 0) {
      return (
        <div className="grid grid-cols-1 gap-3">
          {filteredProducts.map((p) => {
            const mainImage = p.images?.[0];
            const gallery = (p.images || []).slice(1, 5);
            return (
              <div
                key={p.product_id}
                className="w-full overflow-hidden rounded-lg border-2 border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-bg-color)]">
                <div className="w-full bg-[var(--tg-theme-secondary-bg-color)]">
                  {mainImage ? (
                    <img
                      src={mainImage}
                      alt={p.description}
                      className="h-56 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-56 w-full items-center justify-center text-sm text-gray-500">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 p-3">
                  <div className="text-xs text-gray-500">
                    ID: {p.product_id}
                  </div>
                  <div className="text-sm font-medium">{p.description}</div>
                  <div className="text-sm text-gray-600">
                    Категория: {p.category}
                  </div>
                  {p.brand && (
                    <div className="text-sm text-gray-600">
                      Бренд:
                      {p.brand}
                    </div>
                  )}
                  {!p.brand && p.season_title && (
                    <div className="text-sm text-gray-600">
                      Бренд/линейка: {p.season_title}
                    </div>
                  )}

                  {gallery.length > 0 && (
                    <div className="mt-1 flex gap-2 overflow-x-auto">
                      {gallery.map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className="h-12 w-12 flex-none rounded-md object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-500">Товары не найдены</p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-2 text-blue-500 hover:text-blue-700">
            Сбросить фильтры
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CatalogFilters
        onSearch={handleSearch}
        onCategoryChange={handleCategoryChange}
        selectedCategory={selectedCategory}
        categories={categories}
        onBrandLineChange={handleBrandLineChange}
        selectedBrandLine={selectedBrandLine}
        brandLines={brandLines}
        searchQuery={searchQuery}
        onClearFilters={handleClearFilters}
      />

      <div className="w-full px-3 py-4">{renderContent()}</div>
    </div>
  );
}
