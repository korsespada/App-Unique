import { ChevronDown, Heart, Search, X } from "lucide-react";
import React from "react";

import { ProductCardSkeleton } from "../components/ProductCardSkeleton";
import { Product } from "../types";

type Props = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  derivedCategories: string[];
  activeCategory: string;
  setActiveCategory: (v: string) => void;
  derivedBrands: string[];
  activeBrand: string;
  setActiveBrand: (v: string) => void;
  resetFilters: () => void;
  totalItems: number;
  isProductsLoading: boolean;
  sourceProducts: Product[];
  filteredAndSortedProducts: Product[];
  favorites: string[];
  favoriteBumpId: string | null;
  saveHomeScroll: () => void;
  navigateToProduct: (product: Product) => void;
  getThumbUrl: (url: string, thumb?: string) => string;
  toggleFavorite: (productId: string, product?: Product) => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  isFetchingNextPage: boolean;
};

export default function HomeView({
  searchQuery,
  setSearchQuery,
  derivedCategories,
  activeCategory,
  setActiveCategory,
  derivedBrands,
  activeBrand,
  setActiveBrand,
  resetFilters,
  totalItems,
  isProductsLoading,
  sourceProducts,
  filteredAndSortedProducts,
  favorites,
  favoriteBumpId,
  saveHomeScroll,
  navigateToProduct,
  getThumbUrl,
  toggleFavorite,
  loadMoreRef,
  isFetchingNextPage
}: Props) {
  return (
    <div className="animate-in fade-in pb-32 pt-2 duration-700">
      <div className="mb-4 px-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Что вы ищете?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            enterKeyHint="search"
            className="premium-shadow w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 pr-12 text-[13px] font-medium tracking-normal text-white outline-none transition-all duration-200 ease-out [font-kerning:normal] placeholder:text-white/40 focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/40 transition-colors hover:text-white/70"
              aria-label="Очистить поиск">
              <X size={18} />
            </button>
          ) : (
            <Search
              size={18}
              className="text-white/35 absolute right-5 top-1/2 -translate-y-1/2"
            />
          )}
        </div>

        <div className="-mx-4 mt-6 h-px w-full bg-white/10" />
      </div>

      <div className="mb-8 space-y-4 px-4">
        <div className="w-full overflow-hidden">
          <div className="no-scrollbar flex max-w-full gap-3 overflow-x-auto pb-1">
            {derivedCategories.map((category) => {
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`premium-shadow shrink-0 rounded-full border px-5 py-2.5 text-[12px] font-semibold tracking-normal transition-all duration-200 ease-out active:scale-[0.98] ${
                    active
                      ? "border-white/15 bg-white text-black"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}>
                  {category === "Все" ? "Все" : category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="group relative">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="premium-shadow w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out focus:border-white/20 focus:ring-2 focus:ring-white/10">
            <option value="Все" className="bg-[#0b0b0b] text-white">
              Все бренды
            </option>
            {derivedBrands
              .filter((b) => b !== "Все")
              .map((brand) => (
                <option
                  key={brand}
                  value={brand}
                  className="bg-[#0b0b0b] text-white">
                  {brand}
                </option>
              ))}
          </select>
          <ChevronDown
            size={14}
            className="text-white/35 pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 transition-colors group-hover:text-white/60"
          />
        </div>

        {(activeBrand !== "Все" ||
          activeCategory !== "Все" ||
          searchQuery.trim()) && (
          <button
            type="button"
            onClick={resetFilters}
            className="w-full text-left text-[12px] font-semibold tracking-normal text-red-400 [font-kerning:normal]">
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="mb-4 px-4">
        <p className="text-white/55 text-[12px] font-medium tracking-normal [font-kerning:normal]">
          Товаров: 
{' '}
{totalItems}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        {isProductsLoading && sourceProducts.length === 0 ? (
          <ProductCardSkeleton count={8} />
        ) : filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => {
            const isFavorited = favorites.includes(String(product.id));
            const isBumping = favoriteBumpId === String(product.id);
            const thumbUrl = getThumbUrl(String(product.thumb || ""));
            const image0Url = getThumbUrl(String(product.images?.[0] || ""));

            return (
              <div
                key={product.id}
                className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]"
                onClick={() => {
                  saveHomeScroll();
                  navigateToProduct(product);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}>
                <div className="premium-shadow group-hover:bg-white/7 relative mb-5 aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-white/5 transition-all duration-300 ease-out">
                  <img
                    src={thumbUrl || image0Url}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="pointer-events-none h-full w-full select-none object-cover"
                    draggable={false}
                    onError={(e) => {
                      const fallback = image0Url;
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                    }}
                    onDragStart={(e) => {
                      e.preventDefault();
                    }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id, product);
                    }}
                    aria-label={
                      isFavorited
                        ? "Убрать из избранного"
                        : "Добавить в избранное"
                    }
                    className={`premium-shadow absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.96] ${
                      isBumping ? "scale-[1.06]" : "scale-100"
                    }`}>
                    <Heart
                      size={18}
                      className={
                        isFavorited
                          ? "fill-red-500 text-red-500 transition-colors"
                          : "text-white/80 transition-colors"
                      }
                    />
                  </button>
                </div>
                <div className="-mt-2 flex flex-col gap-1 px-2">
                  <h3 className="line-clamp-2 text-[13px] font-semibold tracking-tight text-white">
                    {product.name}
                  </h3>
                  {product.hasPrice ? (
                    <p className="text-white/85 text-[14px] font-extrabold">
                      {product.price.toLocaleString()} ₽
                    </p>
                  ) : (
                    <p className="text-white/45 text-[13px] font-semibold">
                      Цена по запросу
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-40 text-center">
            <p className="text-white/55 text-[13px] font-medium tracking-wide">
              Ничего не найдено
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      )}

      <div className="px-4">
        <div ref={loadMoreRef} className="h-12" />
      </div>
    </div>
  );
}
