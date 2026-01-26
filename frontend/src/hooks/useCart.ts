import {
 useCallback, useEffect, useRef, useState 
} from "react";

import { CartItem, Product } from "../types";
import { trackEvent } from "../utils/analytics";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>([]);

  // Load cart from localStorage on mount
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

  // Sync cart to localStorage and ref
  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem("tg_cart", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  const addToCart = useCallback((product: Product) => {
    trackEvent("add_to_cart", {
      product_id: String(product?.id || ""),
      product_title: String(product?.name || ""),
      price: Number(product?.price) || 0,
      hasPrice: product?.hasPrice !== false
    });

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    const prevQty = cartRef.current.find(
      (it) => String(it.id) === String(id)
    )?.quantity;
    const nextQty = Math.max(0, (Number(prevQty) || 0) + Number(delta));

    if (prevQty && nextQty === 0 && delta < 0) {
      trackEvent("remove_from_cart", { product_id: String(id) });
    }

    setCart((prev) => prev
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const buildMergedCart = useCallback(
    (localCart: CartItem[], serverCart: CartItem[]) => {
      const byId = new Map<string, CartItem>();
      const add = (it: any) => {
        if (!it) return;
        const id = String(it.id || "").trim();
        const name = String(it.name || "").trim();
        if (!id || !name) return;
        const qty = Math.max(1, Number(it.quantity) || 1);
        const normalized: CartItem = {
          ...(it as any), id, name, quantity: qty
        };
        const prev = byId.get(id);
        if (!prev) {
          byId.set(id, normalized);
          return;
        }
        byId.set(id, {
          ...normalized,
          quantity: Math.min(99, (prev.quantity || 1) + qty)
        });
      };
      (Array.isArray(serverCart) ? serverCart : []).forEach(add);
      (Array.isArray(localCart) ? localCart : []).forEach(add);
      return Array.from(byId.values());
    },
    []
  );

  // Computed values
  const cartHasUnknownPrice = cart.some((item) => item.hasPrice === false);

  const cartTotal = cart.reduce((sum, item) => {
    if (item.hasPrice === false) return sum;
    const price = Number(item.price);
    const qty = Number(item.quantity) || 1;
    if (!Number.isFinite(price) || price <= 0) return sum;
    return sum + price * qty;
  }, 0);

  const cartTotalText =
    cartTotal > 0 ? `${cartTotal.toLocaleString()} ₽` : "Цена по запросу";

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cart,
    setCart,
    cartRef,
    addToCart,
    updateQuantity,
    clearCart,
    buildMergedCart,
    cartHasUnknownPrice,
    cartTotal,
    cartTotalText,
    cartCount
  };
}
