import { useCallback, useEffect, useRef, useState } from "react";

import { Product } from "../types";
import { trackEvent } from "../utils/analytics";

export function useFavorites(productsRef: React.MutableRefObject<Product[]>) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteItemsById, setFavoriteItemsById] = useState<
    Record<string, Product>
  >({});
  const [favoriteBumpId, setFavoriteBumpId] = useState<string | null>(null);

  // Load favorites from localStorage
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

  // Load favorite items from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tg_favorite_items");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const next: Record<string, Product> = {};
      Object.entries(parsed as Record<string, any>).forEach(([k, v]) => {
        const id = String(k);
        if (!v || typeof v !== "object") return;
        const images = Array.isArray((v as any).images)
          ? (v as any).images
          : [];
        next[id] = {
          id,
          name: String((v as any).name || ""),
          brand: String((v as any).brand || " "),
          category: String((v as any).category || "Все"),
          price: Number((v as any).price) || 0,
          hasPrice: (v as any).hasPrice !== false,
          images: images.length
            ? images
            : [
              "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000"
            ],
          description: String((v as any).description || ""),
          details: Array.isArray((v as any).details) ? (v as any).details : []
        };
      });
      setFavoriteItemsById(next);
    } catch {
      // ignore
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("tg_favorites", JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  // Save favorite items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "tg_favorite_items",
        JSON.stringify(favoriteItemsById)
      );
    } catch {
      // ignore
    }
  }, [favoriteItemsById]);

  const toggleFavorite = useCallback(
    (productId: string, product?: Product) => {
      const id = String(productId);
      const productForTracking =        product || productsRef.current.find((p) => String(p.id) === id);
      const wasFavorite = favorites.includes(id);

      setFavorites((prev) => {
        const has = prev.includes(id);

        setFavoriteItemsById((prevItems) => {
          const next = { ...prevItems };

          if (has) {
            delete next[id];
            return next;
          }

          if (product) {
            next[id] = product;
            return next;
          }

          if (!next[id]) {
            const fromProducts = productsRef.current.find(
              (p) => String(p.id) === id
            );
            if (fromProducts) next[id] = fromProducts;
          }

          return next;
        });

        return has ? prev.filter((x) => x !== id) : [...prev, id];
      });

      trackEvent(wasFavorite ? "remove_from_favorites" : "add_to_favorites", {
        product_id: id,
        product_title: productForTracking
          ? String(productForTracking.name || "")
          : undefined,
        product_price: productForTracking
          ? Number(productForTracking.price) || 0
          : undefined
      });

      setFavoriteBumpId(id);
      window.setTimeout(() => setFavoriteBumpId(null), 250);
    },
    [favorites, productsRef]
  );

  const buildMergedFavorites = useCallback(
    (a: string[], b: string[]) => Array.from(
        new Set(
          [...(a || []), ...(b || [])]
            .map((x) => String(x).trim())
            .filter(Boolean)
        )
      ),
    []
  );

  return {
    favorites,
    setFavorites,
    favoriteItemsById,
    setFavoriteItemsById,
    favoriteBumpId,
    toggleFavorite,
    buildMergedFavorites
  };
}
