import Api from "@framework/api/utils/api-config";
import { useCallback, useEffect, useRef } from "react";

import { CartItem } from "../types";

interface UseProfileSyncOptions {
  cart: CartItem[];
  favorites: string[];
  setCart: (cart: CartItem[]) => void;
  setFavorites: (favorites: string[]) => void;
  buildMergedCart: (local: CartItem[], server: CartItem[]) => CartItem[];
  buildMergedFavorites: (a: string[], b: string[]) => string[];
  cartRef: React.MutableRefObject<CartItem[]>;
}

export function useProfileSync({
  cart,
  favorites,
  setCart,
  setFavorites,
  buildMergedCart,
  buildMergedFavorites,
  cartRef
}: UseProfileSyncOptions) {
  const didInitProfileSyncRef = useRef(false);
  const profileSyncTimerRef = useRef<number | null>(null);

  const scheduleProfileSync = useCallback(
    (nextCart: CartItem[], nextFavorites: string[]) => {
      if (profileSyncTimerRef.current) {
        window.clearTimeout(profileSyncTimerRef.current);
        profileSyncTimerRef.current = null;
      }
      profileSyncTimerRef.current = window.setTimeout(async () => {
        profileSyncTimerRef.current = null;
        try {
          const tg = (window as any)?.Telegram?.WebApp;
          const u = tg?.initDataUnsafe?.user;
          const username = u?.username ? String(u.username).trim() : "";
          const first = u?.first_name ? String(u.first_name).trim() : "";
          const last = u?.last_name ? String(u.last_name).trim() : "";
          const nickname = `${first} ${last}`.trim();
          await Api.post(
            "/profile/state",
            {
              cart: nextCart,
              favorites: nextFavorites,
              username,
              nickname
            },
            { timeout: 15000 }
          );
        } catch {
          // ignore
        }
      }, 500);
    },
    []
  );

  // Initial profile sync
  useEffect(() => {
    if (didInitProfileSyncRef.current) return;

    const tg = (window as any)?.Telegram?.WebApp;
    const initData = tg?.initData;
    const userId = tg?.initDataUnsafe?.user?.id;
    if (!initData || !userId) {
      didInitProfileSyncRef.current = true;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await Api.get("/profile/state", { timeout: 15000 });
        if (cancelled) return;

        const serverCart = Array.isArray((data as any)?.cart)
          ? (data as any).cart
          : [];
        const serverFavorites = Array.isArray((data as any)?.favorites)
          ? (data as any).favorites
          : [];

        const mergedFavorites = buildMergedFavorites(
          favorites,
          serverFavorites
        );
        const mergedCart = buildMergedCart(cartRef.current, serverCart as any);

        setFavorites(mergedFavorites);
        setCart(mergedCart);

        scheduleProfileSync(mergedCart, mergedFavorites);
      } catch {
        // ignore
      } finally {
        didInitProfileSyncRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    buildMergedCart,
    buildMergedFavorites,
    favorites,
    scheduleProfileSync,
    setCart,
    setFavorites,
    cartRef
  ]);

  // Sync on cart/favorites change
  useEffect(() => {
    if (!didInitProfileSyncRef.current) return;
    scheduleProfileSync(cart, favorites);
  }, [cart, favorites, scheduleProfileSync]);

  return { didInitProfileSyncRef, scheduleProfileSync };
}
