import {
  ExternalProductsPagedResponse,
  useGetExternalProducts
} from "@framework/api/product/external-get";
import Api from "@framework/api/utils/api-config";
import {
  ArrowLeft, ChevronDown, Heart, Minus, Plus, Search, ShoppingBag, Trash2, X
} from "lucide-react";
import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState
} from "react";

import { AppView, CartItem, Product } from "./types";

type HomeViewProps = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  currentView: AppView;
  totalItems: number;
  isProductsLoading: boolean;
  sourceProducts: Product[];
  filteredAndSortedProducts: Product[];
  derivedCategories: string[];
  activeCategory: string;
  setActiveCategory: (v: string) => void;
  derivedBrands: string[];
  activeBrand: string;
  setActiveBrand: (v: string) => void;
  resetFilters: () => void;
  favorites: string[];
  favoriteBumpId: string | null;
  toggleFavorite: (productId: string) => void;
  getThumbUrl: (url: string) => string;
  saveHomeScroll: () => void;
  navigateToProduct: (p: Product) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isExternalFetching: boolean;
  fetchNextPage: () => void;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
};

function HomeView({
  searchQuery,
  setSearchQuery,
  currentView,
  totalItems,
  isProductsLoading,
  sourceProducts,
  filteredAndSortedProducts,
  derivedCategories,
  activeCategory,
  setActiveCategory,
  derivedBrands,
  activeBrand,
  setActiveBrand,
  resetFilters,
  favorites,
  favoriteBumpId,
  toggleFavorite,
  getThumbUrl,
  saveHomeScroll,
  navigateToProduct,
  hasNextPage,
  isFetchingNextPage,
  isExternalFetching,
  fetchNextPage,
  loadMoreRef
}: HomeViewProps) {
  return (
    <div className="animate-in fade-in duration-700 pb-32 pt-6">
      <div className="px-4 mb-6">
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
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-6 pr-12 text-[13px] font-medium tracking-normal [font-kerning:normal] text-white placeholder:text-white/40 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/40 transition-colors hover:text-white/70"
              aria-label="Очистить поиск"
            >
              <X size={18} />
            </button>
          ) : (
            <Search
              size={18}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35"
            />
          )}
        </div>

        <div className="mt-6 h-px w-full bg-white/10" />

        {currentView === "product-detail" && (
          <button
            type="button"
            className="premium-shadow absolute right-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]"
            aria-label="Открыть корзину"
          >
            <ShoppingBag size={18} />
          </button>
        )}
      </div>

      <div className="px-4 mb-12 space-y-4">
        <div className="w-full overflow-hidden">
          <div className="no-scrollbar flex max-w-full gap-3 overflow-x-auto pb-1">
            {derivedCategories.map((category) => {
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full border px-5 py-2.5 text-[12px] font-semibold tracking-normal transition-all duration-200 ease-out premium-shadow active:scale-[0.98] ${
                    active
                      ? "border-white/15 bg-white text-black"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  {category === "Все" ? "Все" : category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative group">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          >
            <option value="Все">Все бренды</option>
            {derivedBrands
              .filter((b) => b !== "Все")
              .map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-hover:text-white/60"
          />
        </div>

        {(activeBrand !== "Все" || activeCategory !== "Все" || searchQuery.trim()) && (
          <button
            type="button"
            onClick={resetFilters}
            className="w-full text-left text-[12px] font-semibold tracking-normal [font-kerning:normal] text-red-400"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="px-4 mb-6">
        <p className="text-[12px] font-medium tracking-normal [font-kerning:normal] text-white/55">
          Товаров: {totalItems}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        {isProductsLoading && sourceProducts.length === 0 ? (
          Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="animate-pulse">
              <div className="mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5" />
              <div className="px-2">
                <div className="mt-6 h-px w-full bg-white/10" />
              </div>
            </div>
          ))
        ) : filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => {
            const isFavorited = favorites.includes(String(product.id));
            const isBumping = favoriteBumpId === String(product.id);

            return (
              <div
                key={product.id}
                className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]"
                onClick={() => {
                  saveHomeScroll();
                  navigateToProduct(product);
                }}
              >
                <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow transition-all duration-300 ease-out group-hover:border-white/20 group-hover:bg-white/7">
                  <img
                    src={getThumbUrl(product.images[0])}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id);
                    }}
                    aria-label={
                      isFavorited ? "Убрать из избранного" : "Добавить в избранное"
                    }
                    className={`premium-shadow absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.96] ${
                      isBumping ? "scale-[1.06]" : "scale-100"
                    }`}
                  >
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
                <div className="px-2">
                  <h3 className="line-clamp-2 min-h-[2.2em] -mt-2 text-[13px] font-semibold leading-snug tracking-tight text-white">
                    {product.name}
                  </h3>
                  {product.hasPrice ? (
                    <p className="-mt-1 text-[14px] font-extrabold text-white/85">
                      {product.price.toLocaleString()} ₽
                    </p>
                  ) : (
                    <p className="-mt-1 text-[13px] font-semibold text-white/45">
                      Цена по запросу
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-40 text-center">
            <p className="text-[13px] font-medium tracking-wide text-white/55">Ничего не найдено</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      <div className="px-4">
        {hasNextPage && (
          <div className="mt-8 flex flex-col items-center gap-4">
            {(isFetchingNextPage || isExternalFetching) && (
              <div className="animate-pulse text-[12px] font-semibold text-white/55">
                Загружаем товары…
              </div>
            )}
            {!isFetchingNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                Загрузить ещё
              </button>
            )}
          </div>
        )}
        <div ref={loadMoreRef} className="h-12" />
      </div>
    </div>
  );
}

type ProductDetailViewProps = {
  product: Product | null;
  favorites: string[];
  currentImageIndex: number;
  detailImageSrc: string;
  isDetailImageLoading: boolean;
  setIsDetailImageLoading: (v: boolean) => void;
  setCurrentImageIndex: (v: number) => void;
  setDetailImageSrc: (v: string) => void;
  getDetailImageUrl: (url: string) => string;
  addToCart: (p: Product) => void;
  toggleFavorite: (productId: string) => void;
};

function ProductDetailView({
  product,
  favorites,
  currentImageIndex,
  detailImageSrc,
  isDetailImageLoading,
  setIsDetailImageLoading,
  setCurrentImageIndex,
  setDetailImageSrc,
  getDetailImageUrl,
  addToCart,
  toggleFavorite
}: ProductDetailViewProps) {
  if (!product) return null;

  const mainImage = detailImageSrc || getDetailImageUrl(product.images?.[0] || "");
  const canGoPrev = currentImageIndex > 0;
  const canGoNext = currentImageIndex < (product.images?.length || 1) - 1;

  const gotoIndex = (nextIdx: number) => {
    const maxIdx = Math.max(0, (product.images?.length || 1) - 1);
    const idx = Math.max(0, Math.min(nextIdx, maxIdx));
    setCurrentImageIndex(idx);
    setDetailImageSrc(getDetailImageUrl(product.images?.[idx] || ""));
  };

  return (
    <div className="animate-in fade-in duration-500 px-4 pt-6 pb-32 text-white">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight">{product.name}</h2>
        {product.brand ? (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {product.brand}
          </p>
        ) : null}
      </div>

      <div className="relative mb-8 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow">
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name}
            className="h-full w-full object-cover"
            onLoad={() => setIsDetailImageLoading(false)}
          />
        ) : (
          <div className="h-full w-full" />
        )}

        {isDetailImageLoading && <div className="absolute inset-0 bg-black/20" />}

        {(product.images?.length || 0) > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
            {product.images.map((_, idx) => (
              <span
                key={`${product.id}_${idx}`}
                className={`h-1.5 w-1.5 rounded-full ${
                  idx === currentImageIndex ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {canGoPrev && (
          <button
            type="button"
            onClick={() => gotoIndex(currentImageIndex - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-semibold text-white/80 backdrop-blur-2xl"
          >
            Назад
          </button>
        )}

        {canGoNext && (
          <button
            type="button"
            onClick={() => gotoIndex(currentImageIndex + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] font-semibold text-white/80 backdrop-blur-2xl"
          >
            Далее
          </button>
        )}
      </div>

      <div className="mb-10 rounded-[2.5rem] border border-white/10 bg-white/5 p-6 premium-shadow">
        {product.hasPrice ? (
          <div className="text-[18px] font-extrabold text-white">
            {Number(product.price).toLocaleString()} ₽
          </div>
        ) : (
          <div className="text-[14px] font-semibold text-white/55">Цена по запросу</div>
        )}

        {product.description ? (
          <p className="mt-4 text-[13px] font-medium leading-relaxed text-white/70">
            {product.description}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => addToCart(product)}
          className="flex-1 rounded-2xl bg-white py-4 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
        >
          В корзину
        </button>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 premium-shadow"
          aria-label="Избранное"
        >
          <Heart
            size={20}
            className={
              favorites.includes(String(product.id))
                ? "fill-red-500 text-red-500"
                : "text-white/80"
            }
          />
        </button>
      </div>
    </div>
  );
}

type CartViewProps = {
  cart: CartItem[];
  cartTotalText: string;
  orderComment: string;
  setOrderComment: (v: string) => void;
  isSendingOrder: boolean;
  setCurrentView: (v: AppView) => void;
  restoreHomeScroll: (behavior?: "auto" | "smooth") => void;
  getThumbUrl: (url: string, thumb?: string) => string;
  navigateToProduct: (p: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  sendOrderToManager: () => void;
};

function CartView({
  cart,
  cartTotalText,
  orderComment,
  setOrderComment,
  isSendingOrder,
  setCurrentView,
  restoreHomeScroll,
  getThumbUrl,
  navigateToProduct,
  updateQuantity,
  sendOrderToManager
}: CartViewProps) {
  return (
    <div
      className={`animate-in fade-in duration-500 px-4 pt-6 pb-32 text-white ${
        cart.length === 0 ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      <div className="mb-12 flex items-baseline justify-between gap-6">
        <h2 className="text-5xl font-extrabold tracking-tight">Корзина</h2>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mt-6 h-px w-full bg-white/10" />
          <div className="mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5 premium-shadow">
            <ShoppingBag size={40} className="text-white/25" />
          </div>
          <p className="mb-12 font-semibold tracking-tight text-white/55">Ваша корзина пуста</p>
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              restoreHomeScroll("auto");
            }}
            className="rounded-2xl bg-white px-12 py-4 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
          >
            В каталог
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8 mb-16">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex gap-8 items-center group cursor-pointer"
                onClick={() => navigateToProduct(item)}
              >
                <div className="h-32 w-28 flex-shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 premium-shadow transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                  <img
                    src={getThumbUrl(item.images[0], "240x320")}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="mb-1 text-[9px] font-light uppercase tracking-[0.34em] text-white/40">{item.brand}</p>
                      <h4 className="mb-1 text-[15px] font-semibold leading-tight text-white">{item.name}</h4>
                      {item.hasPrice !== false && Number(item.price) > 0 ? (
                        <p className="text-sm font-bold text-white/80">{Number(item.price).toLocaleString()} ₽</p>
                      ) : (
                        <p className="text-[12px] font-semibold text-white/55">Цена по запросу</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(item.id, -item.quantity);
                      }}
                      className="p-2 text-white/25 transition-colors hover:text-red-400"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 self-start rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.quantity > 1) updateQuantity(item.id, -1);
                      }}
                      className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-[20px] text-center text-xs font-semibold text-white/80">{item.quantity}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(item.id, 1);
                      }}
                      className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-10 w-full rounded-[3.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-light uppercase tracking-[0.42em] text-white/40">Сумма заказа</span>
              <span className="text-right text-[15px] font-semibold leading-tight tracking-tight text-white">
                {cartTotalText}
              </span>
            </div>
            <div className="mt-8">
              <label className="mb-3 block text-[10px] font-light uppercase tracking-[0.42em] text-white/40">
                Комментарий
              </label>
              <textarea
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                rows={3}
                placeholder="Комментарий к заказу"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[13px] font-medium text-white/80 outline-none transition-all duration-200 ease-out premium-shadow placeholder:text-white/35 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <button
              onClick={sendOrderToManager}
              disabled={isSendingOrder}
              className="mt-6 w-full rounded-2xl bg-white py-6 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
            >
              {isSendingOrder ? "Отправляем…" : "Отправить менеджеру"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type FavoritesViewProps = {
  favorites: string[];
  favoriteBumpId: string | null;
  filteredAndSortedProducts: Product[];
  toggleFavorite: (productId: string) => void;
  getThumbUrl: (url: string) => string;
  saveHomeScroll: () => void;
  navigateToProduct: (p: Product) => void;
};

function FavoritesView({
  favorites,
  favoriteBumpId,
  filteredAndSortedProducts,
  toggleFavorite,
  getThumbUrl,
  saveHomeScroll,
  navigateToProduct
}: FavoritesViewProps) {
  const favoriteProducts = filteredAndSortedProducts.filter((p) => favorites.includes(String(p.id)));

  return (
    <div className="animate-in fade-in duration-700 pb-32 pt-6 text-white">
      <div className="px-4 mb-12">
        <h2 className="text-5xl font-extrabold tracking-tight">Избранное</h2>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="px-8 py-40 text-center">
          <p className="text-[13px] font-medium tracking-normal [font-kerning:normal] text-white/55">
            Пока пусто
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4">
          {favoriteProducts.map((product) => {
            const isFavorited = favorites.includes(String(product.id));
            const isBumping = favoriteBumpId === String(product.id);

            return (
              <div
                key={product.id}
                className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]"
                onClick={() => {
                  saveHomeScroll();
                  navigateToProduct(product);
                }}
              >
                <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow transition-all duration-300 ease-out group-hover:border-white/20 group-hover:bg-white/7">
                  <img
                    src={getThumbUrl(product.images[0])}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id);
                    }}
                    aria-label={
                      isFavorited ? "Убрать из избранного" : "Добавить в избранное"
                    }
                    className={`premium-shadow absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.96] ${
                        isBumping ? "scale-[1.06]" : "scale-100"
                      }`}
                  >
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
                <div className="px-2">
                  <h3 className="line-clamp-2 min-h-[2.6em] -mt-2 text-[13px] font-semibold tracking-tight text-white">
                    {product.name}
                  </h3>
                  {product.hasPrice ? (
                    <p className="mt-0 text-[14px] font-extrabold text-white/85">
                      {product.price.toLocaleString()} ₽
                    </p>
                  ) : (
                    <p className="mt-0 text-[13px] font-semibold text-white/45">
                      Цена по запросу
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [startProductId, setStartProductId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteBumpId, setFavoriteBumpId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState<string>("");

  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const saveHomeScroll = useCallback(() => {
    homeScrollYRef.current = window.scrollY || 0;
  }, []);

  const restoreHomeScroll = useCallback((behavior: "auto" | "smooth" = "auto") => {
    const y = homeScrollYRef.current || 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior });
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior });
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior });
        });
      });
    });
  }, []);

  const scrollHomeToTop = (behavior: "auto" | "smooth" = "auto") => {
    homeScrollYRef.current = 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior });
    });
  };

  useLayoutEffect(() => {
    if (currentView === "home" && shouldRestoreHomeScrollRef.current) {
      restoreHomeScroll();
      shouldRestoreHomeScrollRef.current = false;
    }
  }, [currentView, restoreHomeScroll]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = String(tg?.initDataUnsafe?.start_param || "").trim();
    if (!startParam) return;

    if (startParam.startsWith("product_")) {
      const id = startParam.slice("product_".length).trim();
      if (id) setStartProductId(id);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tg_favorites");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setFavorites(parsed.map((x) => String(x)).filter(Boolean));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tg_favorites", JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const getThumbUrl = useCallback((url: string, thumb: string = "400x500") => {
    const raw = String(url || "").trim();
    if (!raw) return raw;

    try {
      const u = new URL(raw);

      if (!u.searchParams.has("thumb") && u.pathname.includes("/api/files/")) {
        u.searchParams.set("thumb", thumb);
      }

      if (u.searchParams.has("w")) {
        u.searchParams.set("w", "600");
      }

      return u.toString();
    } catch {
      return raw;
    }
  }, []);

  const getDetailImageUrl = useCallback(
    (url: string) => getThumbUrl(url, "1000x1250"),
    [getThumbUrl]
  );

  const resetFilters = useCallback(() => {
    setActiveBrand("Все");
    setActiveCategory("Все");
    setSearchQuery("");
  }, []);

  const externalQuery = useMemo(
    () => ({
      search: searchQuery.trim() || undefined,
      brand: activeBrand !== "Все" ? activeBrand : undefined,
      category: activeCategory !== "Все" ? activeCategory : undefined
    }),
    [activeBrand, activeCategory, searchQuery]
  );

  const {
    data: externalProductsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isProductsLoading,
    isFetching: isExternalFetching
  } = useGetExternalProducts(externalQuery);

  const sourceProducts = useMemo<Product[]>(() => {
    const pages: ExternalProductsPagedResponse[] =
      (externalProductsData?.pages as ExternalProductsPagedResponse[] | undefined) || [];

    const flattened = pages.flatMap((p) => (p?.products || []) as any[]);

    const mapOne = (raw: any): Product => {
      const id = String(raw?.id || raw?.product_id || raw?.productId || "").trim();
      const name = String(raw?.name || raw?.title || "").trim();
      const brand = String(raw?.brand || "").trim() || "Без бренда";
      const category = String(raw?.category || "").trim() || "Другое";
      const images = Array.isArray(raw?.images) ? raw.images.map((x: any) => String(x)).filter(Boolean) : [];
      const description = String(raw?.description || "");

      const hasPrice = Boolean(raw?.hasPrice ?? (raw?.price != null && Number(raw.price) > 0));
      const price = hasPrice ? Number(raw?.price) || 0 : 0;

      return {
        id,
        name,
        brand,
        category,
        price,
        hasPrice,
        images,
        description,
        details: []
      };
    };

    const mapped = flattened.map(mapOne).filter((p) => p.id && p.name);
    return mapped;
  }, [externalProductsData]);

  useEffect(() => {
    productsRef.current = sourceProducts;
  }, [sourceProducts]);

  const totalItems = useMemo(() => {
    const pages: ExternalProductsPagedResponse[] =
      (externalProductsData?.pages as ExternalProductsPagedResponse[] | undefined) || [];
    const first = pages[0];
    return Number(first?.totalItems) || sourceProducts.length;
  }, [externalProductsData, sourceProducts.length]);

  const derivedCategories = useMemo(() => {
    const set = new Set<string>();
    sourceProducts.forEach((p) => {
      if (p.category) set.add(String(p.category));
    });
    return ["Все", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))];
  }, [sourceProducts]);

  const derivedBrands = useMemo(() => {
    const set = new Set<string>();
    sourceProducts.forEach((p) => {
      if (p.brand) set.add(String(p.brand));
    });
    return ["Все", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru"))];
  }, [sourceProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = sourceProducts.filter((p) => {
      if (activeCategory !== "Все" && p.category !== activeCategory) return false;
      if (activeBrand !== "Все" && p.brand !== activeBrand) return false;
      if (!q) return true;

      const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return filtered;
  }, [activeBrand, activeCategory, searchQuery, sourceProducts]);

  const cartCount = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [cart]
  );

  const cartTotalText = useMemo(() => {
    const hasAnyPrice = cart.some((it) => it.hasPrice !== false && Number(it.price) > 0);
    const hasAnyNoPrice = cart.some((it) => it.hasPrice === false || Number(it.price) <= 0);
    if (!cart.length) return "0 ₽";
    if (!hasAnyPrice && hasAnyNoPrice) return "Цена по запросу";
    if (hasAnyNoPrice) return "Частично по запросу";

    const total = cart.reduce((sum, it) => sum + Number(it.price) * (Number(it.quantity) || 1), 0);
    return `${total.toLocaleString()} ₽`;
  }, [cart]);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    const id = String(productId);
    setCart((prev) => {
      const next = prev
        .map((it) => (it.id !== id ? it : { ...it, quantity: (Number(it.quantity) || 0) + delta }))
        .filter((it) => (Number(it.quantity) || 0) > 0);
      return next;
    });
  }, []);

  const addToCart = useCallback((product: Product) => {
    const id = String(product.id);
    setCart((prev) => {
      const existing = prev.find((x) => String(x.id) === id);
      if (existing) {
        return prev.map((x) => (String(x.id) === id ? { ...x, quantity: (Number(x.quantity) || 0) + 1 } : x));
      }
      return [...prev, { ...(product as CartItem), quantity: 1 }];
    });
  }, []);

  const navigateToProduct = useCallback(
    (p: Product) => {
      saveHomeScroll();
      setSelectedProduct(p);
      setCurrentImageIndex(0);
      setIsDetailImageLoading(true);
      setDetailImageSrc(getDetailImageUrl(p.images?.[0] || ""));
      setCurrentView("product-detail");

      try {
        const tg = window.Telegram?.WebApp as any;
        tg?.BackButton?.show?.();
      } catch {
        // ignore
      }
    },
    [getDetailImageUrl, saveHomeScroll]
  );

  const sendOrderToManager = useCallback(async () => {
    if (!cartRef.current.length) return;

    setIsSendingOrder(true);
    try {
      const payload = {
        items: cartRef.current.map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          hasPrice: it.hasPrice
        })),
        comment: orderComment
      };

      const tg = window.Telegram?.WebApp as any;
      if (typeof tg?.sendData === "function") {
        tg.sendData(JSON.stringify(payload));
      } else {
        await Api.post("/orders", payload);
      }
      setCart([]);
      setOrderComment("");
      setCurrentView("home");
      restoreHomeScroll("auto");
    } catch {
      // ignore
    } finally {
      setIsSendingOrder(false);
    }
  }, [orderComment]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (!hasNextPage) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        if (isFetchingNextPage) return;
        fetchNextPage();
      },
      { rootMargin: "400px 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = String(tg?.initDataUnsafe?.start_param || "").trim();
    if (!startParam) return;

    if (startParam.startsWith("product_")) {
      const id = startParam.slice("product_".length).trim();
      if (id) setStartProductId(id);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tg_favorites");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setFavorites(parsed.map((x) => String(x)).filter(Boolean));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tg_favorites", JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    const id = String(productId);
    setFavorites((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
    setFavoriteBumpId(id);
    window.setTimeout(() => {
      setFavoriteBumpId((curr) => (curr === id ? null : curr));
    }, 180);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tg_cart");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const restored = parsed
        .filter(
          (it) => it && typeof it === "object" && (it as any).id && (it as any).name
        )
        .map((it) => ({
          ...(it as any),
          quantity: Number((it as any).quantity) || 1
        })) as CartItem[];
      setCart(restored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem("tg_cart", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

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

        const nextItem: CartItem = {
          ...fresh,
          quantity: item.quantity
        };

        const itemFirstImg = Array.isArray(item.images)
          ? item.images[0]
          : undefined;
        const freshFirstImg = Array.isArray(nextItem.images)
          ? nextItem.images[0]
          : undefined;

        const same =
          item.name === nextItem.name &&
          item.brand === nextItem.brand &&
          item.category === nextItem.category &&
          Number(item.price) === Number(nextItem.price) &&
          (item.hasPrice ?? true) === (nextItem.hasPrice ?? true) &&
          itemFirstImg === freshFirstImg;

        if (!same) changed = true;
        return same ? item : nextItem;
      });

      return changed ? next : prev;
    });
  }, [sourceProducts]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp as any;
    const backButton = tg?.BackButton;
    if (!backButton) return undefined;

    const handler = () => {
      window.history.back();
    };

    try {
      backButton.onClick?.(handler);
    } catch {
      // ignore
    }

    return () => {
      try {
        backButton.offClick?.(handler);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp as any;
    const backButton = tg?.BackButton;
    if (!backButton) return;
    if (currentView === "home") backButton.hide();
    else backButton.show();
  }, [currentView]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = (e.state || {}) as any;
      const view = state?.view as AppView | undefined;

      isPopNavRef.current = true;

      if (!view) {
        setSelectedProduct(null);
        setCurrentView("home");
        shouldRestoreHomeScrollRef.current = true;
        return;
      }

      if (view === "product-detail") {
        const productId = String(state?.productId || "").trim();
        const fromProducts = productsRef.current.find(
          (p) => p.id === productId
        );
        const fromCart = cartRef.current.find((p) => p.id === productId);
        const product = fromProducts || fromCart;
        if (product) {
          setSelectedProduct(product);
          setCurrentImageIndex(0);
          setDetailImageSrc(getDetailImageUrl(product.images?.[0] || ""));
          setCurrentView("product-detail");
        } else {
          setSelectedProduct(null);
          setCurrentView("home");
        }
        return;
      }

      setSelectedProduct(null);
      setCurrentView(view);

      if (view === "home") {
        shouldRestoreHomeScrollRef.current = true;
      }
    };

    window.history.replaceState({ view: "home" }, "");
    isHistoryFirstRef.current = false;

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (isPopNavRef.current) {
      isPopNavRef.current = false;
      return;
    }

    const fromView = lastPushedViewRef.current;
    const state =
      currentView === "product-detail"
      ? { view: currentView, productId: selectedProduct?.id || "", fromView }
      : { view: currentView, fromView };

    window.history.pushState(state, "");
    lastPushedViewRef.current = currentView;
  }, [currentView, selectedProduct?.id]);

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      {currentView !== "product-detail" && (
        <nav
          className="z-[120] flex h-14 w-full max-w-md items-center justify-center px-6">
          {currentView !== "home" && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="premium-shadow absolute left-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              restoreHomeScroll("auto");
            }}
            className="cursor-pointer select-none"
            aria-label="На главную"
          >
            <img
              src="/logo.svg"
              alt="Logo"
              className="logo-auto h-7 w-auto opacity-95"
            />
          </button>
        </nav>
      )}

      <main>
        {currentView === "home" && (
          <HomeView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            currentView={currentView}
            totalItems={totalItems}
            isProductsLoading={isProductsLoading}
            sourceProducts={sourceProducts}
            filteredAndSortedProducts={filteredAndSortedProducts}
            derivedCategories={derivedCategories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            derivedBrands={derivedBrands}
            activeBrand={activeBrand}
            setActiveBrand={setActiveBrand}
            resetFilters={resetFilters}
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            toggleFavorite={toggleFavorite}
            getThumbUrl={getThumbUrl}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
            hasNextPage={Boolean(hasNextPage)}
            isFetchingNextPage={isFetchingNextPage}
            isExternalFetching={isExternalFetching}
            fetchNextPage={fetchNextPage}
            loadMoreRef={loadMoreRef}
          />
        )}

        {currentView === "favorites" && (
          <FavoritesView
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            filteredAndSortedProducts={filteredAndSortedProducts}
            toggleFavorite={toggleFavorite}
            getThumbUrl={getThumbUrl}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
          />
        )}

        {currentView === "product-detail" && (
          <ProductDetailView
            product={selectedProduct}
            favorites={favorites}
            currentImageIndex={currentImageIndex}
            detailImageSrc={detailImageSrc}
            isDetailImageLoading={isDetailImageLoading}
            setIsDetailImageLoading={setIsDetailImageLoading}
            setCurrentImageIndex={setCurrentImageIndex}
            setDetailImageSrc={setDetailImageSrc}
            getDetailImageUrl={getDetailImageUrl}
            addToCart={addToCart}
            toggleFavorite={toggleFavorite}
          />
        )}

        {currentView === "cart" && (
          <CartView
            cart={cart}
            cartTotalText={cartTotalText}
            orderComment={orderComment}
            setOrderComment={setOrderComment}
            isSendingOrder={isSendingOrder}
            setCurrentView={setCurrentView}
            restoreHomeScroll={restoreHomeScroll}
            getThumbUrl={getThumbUrl}
            navigateToProduct={navigateToProduct}
            updateQuantity={updateQuantity}
            sendOrderToManager={sendOrderToManager}
          />
        )}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      {currentView !== "product-detail" && (
      <div className="fixed bottom-0 z-[110] flex w-full max-w-md justify-center px-4 pb-6 pt-2">
        <div className="grid w-full grid-cols-3 items-center rounded-[2rem] border border-white/10 bg-black/50 px-6 py-3 shadow-2xl backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              restoreHomeScroll("auto");
            }}
            className={`flex items-center justify-center transition-all ${
              currentView === "home"
                ? "scale-125 text-white"
                : "text-neutral-500 hover:text-white"
            }`}>
            <Search size={22} strokeWidth={currentView === "home" ? 3 : 2} />
          </button>

          <button
            type="button"
            onClick={() => {
              saveHomeScroll();
              setCurrentView("favorites");
            }}
            className={`flex items-center justify-center transition-all ${
              currentView === "favorites"
                ? "scale-125 text-white"
                : "text-neutral-500 hover:text-white"
            }`}
            aria-label="Избранное"
          >
            <Heart
              size={22}
              strokeWidth={currentView === "favorites" ? 3 : 2}
              className={currentView === "favorites" ? "text-white" : undefined}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              saveHomeScroll();
              setCurrentView("cart");
            }}
            className={`relative flex items-center justify-center transition-all ${
              currentView === "cart"
                ? "scale-125 text-white"
                : "text-neutral-500 hover:text-white"
            }`}>
            <ShoppingBag
              size={22}
              strokeWidth={currentView === "cart" ? 3 : 2}
            />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-extrabold text-black">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default App;
