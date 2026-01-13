import { Heart, ShoppingBag } from "lucide-react";
import React from "react";

import { Product } from "../types";

type Props = {
  favorites: string[];
  favoriteItemsById: Record<string, Product>;
  favoriteBumpId: string | null;
  saveHomeScroll: () => void;
  navigateToProduct: (p: Product) => void;
  getThumbUrl: (url: string, thumb?: string) => string;
  toggleFavorite: (productId: string, product?: Product) => void;
  addToCart: (product: Product) => void;
};

export default function FavoritesView({
  favorites,
  favoriteItemsById,
  favoriteBumpId,
  saveHomeScroll,
  navigateToProduct,
  getThumbUrl,
  toggleFavorite,
  addToCart
}: Props) {
  const favoriteProducts = favorites
    .map((id) => favoriteItemsById[String(id)])
    .filter(Boolean);

  return (
    <div className="animate-in fade-in pb-32 pt-16 text-white duration-700">
      <div className="mb-12 px-4">
        <h2 className="text-5xl font-extrabold tracking-tight">Избранное</h2>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="px-8 py-40 text-center">
          <p className="text-white/55 text-[13px] font-medium tracking-normal [font-kerning:normal]">
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
                onContextMenu={(e) => {
                  e.preventDefault();
                }}>
                <div className="premium-shadow group-hover:bg-white/7 relative mb-5 aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-white/5 transition-all duration-300 ease-out">
                  <img
                    src={product.thumb || getThumbUrl(product.images[0])}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const fallback = getThumbUrl(product.images[0]);
                      if (fallback && e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    onContextMenu={(e) => {
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

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(product);
                    }}
                    aria-label="Добавить в корзину"
                    className="premium-shadow absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.96]">
                    <ShoppingBag
                      size={18}
                      className="text-white/80 transition-colors"
                    />
                  </button>
                </div>
                <div className="px-2">
                  <div className="-mt-2 flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 min-h-[2.6em] flex-1 text-[13px] font-semibold tracking-tight text-white">
                      {product.name}
                    </h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
