import {
  ExternalProductsPagedResponse,
  useGetExternalProducts
} from "@framework/api/product/external-get";
import Api from "@framework/api/utils/api-config";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import BottomNav from "./components/BottomNav";
import TopNav from "./components/TopNav";
import { useHomeScroll } from "./hooks/useHomeScroll";
import { useScrolled } from "./hooks/useScrolled";
import { AppView, CartItem, Product } from "./types";
import { getDetailImageUrl, getThumbUrl } from "./utils/images";
import { CatalogFiltersResponse } from "./utils/types";
import CartView from "./views/CartView";
import FavoritesView from "./views/FavoritesView";
import HomeView from "./views/HomeView";
import ProductDetailView from "./views/ProductDetailView";

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
  const [favoriteItemsById, setFavoriteItemsById] = useState<
    Record<string, Product>
  >({});
  const [favoriteBumpId, setFavoriteBumpId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState<string>("");

  const didInitProfileSyncRef = useRef(false);
  const profileSyncTimerRef = useRef<number | null>(null);

  const buildMergedFavorites = useCallback((a: string[], b: string[]) => {
    return Array.from(new Set([...(a || []), ...(b || [])].map((x) => String(x).trim()).filter(Boolean)));
  }, []);

  const buildMergedCart = useCallback((localCart: CartItem[], serverCart: CartItem[]) => {
    const byId = new Map<string, CartItem>();
    const add = (it: any) => {
      if (!it) return;
      const id = String(it.id || '').trim();
      const name = String(it.name || '').trim();
      if (!id || !name) return;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const normalized: CartItem = {
        ...(it as any),
        id,
        name,
        quantity: qty,
      };
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, normalized);
        return;
      }
      byId.set(id, { ...normalized, quantity: Math.min(99, (prev.quantity || 1) + qty) });
    };
    (Array.isArray(serverCart) ? serverCart : []).forEach(add);
    (Array.isArray(localCart) ? localCart : []).forEach(add);
    return Array.from(byId.values());
  }, []);

  const scheduleProfileSync = useCallback((nextCart: CartItem[], nextFavorites: string[]) => {
    if (profileSyncTimerRef.current) {
      window.clearTimeout(profileSyncTimerRef.current);
      profileSyncTimerRef.current = null;
    }
    profileSyncTimerRef.current = window.setTimeout(async () => {
      profileSyncTimerRef.current = null;
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        const u = tg?.initDataUnsafe?.user;
        const username = u?.username ? String(u.username).trim() : '';
        const first = u?.first_name ? String(u.first_name).trim() : '';
        const last = u?.last_name ? String(u.last_name).trim() : '';
        const nickname = `${first} ${last}`.trim();
        await Api.post('/profile/state', {
          cart: nextCart,
          favorites: nextFavorites,
          username,
          nickname,
        }, { timeout: 15000 });
      } catch {
        // ignore
      }
    }, 500);
  }, []);

  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<string[]>([]);
  const [catalogBrandsByCategory, setCatalogBrandsByCategory] = useState<
    Record<string, string[]>
  >({});

  const { shouldRestoreHomeScrollRef, saveHomeScroll, restoreHomeScroll } =
    useHomeScroll(currentView);

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const [detailLayerASrc, setDetailLayerASrc] = useState<string>("");
  const [detailLayerBSrc, setDetailLayerBSrc] = useState<string>("");
  const [activeDetailLayer, setActiveDetailLayer] = useState<"A" | "B">("A");
  const [isDetailImageCrossfading, setIsDetailImageCrossfading] =
    useState(false);

  const productsRef = useRef<Product[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const isHistoryFirstRef = useRef(true);
  const isPopNavRef = useRef(false);
  const lastPushedViewRef = useRef<AppView>("home");

  const scrolled = useScrolled();

  // scrollHomeToTop больше не используется здесь

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = String(tg?.initDataUnsafe?.start_param || "").trim();
    if (!startParam) return;

    if (startParam.startsWith("product__")) {
      const id = startParam.slice("product__".length).trim();
      if (id) {
        setSearchQuery("");
        setActiveCategory("Все");
        setActiveBrand("Все");
        setStartProductId(id);
      }
      return;
    }

    if (startParam.startsWith("product_")) {
      const id = startParam.slice("product_".length).trim();
      if (id) {
        setSearchQuery("");
        setActiveCategory("Все");
        setActiveBrand("Все");
        setStartProductId(id);
      }
    }
  }, [setActiveBrand, setActiveCategory, setSearchQuery, setStartProductId]);

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

  useEffect(() => {
    try {
      localStorage.setItem("tg_favorites", JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  useEffect(() => {
    if (!didInitProfileSyncRef.current) return;
    scheduleProfileSync(cartRef.current, favorites);
  }, [favorites, scheduleProfileSync]);

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

  const toggleFavorite = useCallback((productId: string, product?: Product) => {
    const id = String(productId);

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
          const fromCart = cartRef.current.find((p) => String(p.id) === id);
          const fallback = fromProducts || fromCart;
          if (fallback) next[id] = fallback as any;
        }

        return next;
      });

      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });

    setFavoriteBumpId(id);
    window.setTimeout(() => setFavoriteBumpId(null), 250);
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
        const { data } = await Api.get('/profile/state', { timeout: 15000 });
        if (cancelled) return;

        const serverCart = Array.isArray((data as any)?.cart) ? (data as any).cart : [];
        const serverFavorites = Array.isArray((data as any)?.favorites)
          ? (data as any).favorites
          : [];

        const mergedFavorites = buildMergedFavorites(favorites, serverFavorites);
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
  }, [buildMergedCart, buildMergedFavorites, favorites, scheduleProfileSync]);

  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem("tg_cart", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    if (!didInitProfileSyncRef.current) return;
    scheduleProfileSync(cart, favorites);
  }, [cart, favorites, scheduleProfileSync]);

  useEffect(() => {
    if (currentView !== "cart") return undefined;
    if (cart.length !== 0) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cart.length, currentView]);

  const {
    data: externalData,
    isLoading: isExternalLoading,
    isFetching: isExternalFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useGetExternalProducts({
    search: searchQuery,
    brand: activeBrand === "Все" ? undefined : activeBrand,
    category: activeCategory === "Все" ? undefined : activeCategory
  });

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
        const brandsByCategory =          brandsByCategoryRaw && typeof brandsByCategoryRaw === "object"
            ? brandsByCategoryRaw
            : {};

        const normalizedBrandsByCategory: Record<string, string[]> =          Object.fromEntries(
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

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (!hasNextPage) return;
        if (isFetchingNextPage) return;
        fetchNextPage();
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const apiProducts = useMemo<Product[]>(() => {
    const pages = (externalData?.pages
      || []) as ExternalProductsPagedResponse[];
    const raw = pages.flatMap((p) => Array.isArray(p?.products) ? p.products : []);

    return raw
      .map((p) => {
        const id = String((p as any).id || p.product_id || "");
        const name = String(p.title || p.name || p.product_id || "").trim();
        const brand = String(p.brand || p.season_title || "").trim();
        const category = String(p.category || "Все");
        const images =          Array.isArray(p.images) && p.images.length ? p.images : [];

        const rawPrice = Number((p as any).price);
        const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;

        return {
          id,
          name,
          brand: brand || " ",
          category,
          price: hasPrice ? rawPrice : 0,
          hasPrice,
          images: images.length
            ? images
            : [
              "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000"
            ],
          thumb: (p as any).thumb || "",
          description: String(p.description || ""),
          details: Array.isArray((p as any).details) ? (p as any).details : []
        };
      })
      .filter((p) => Boolean(p.id) && Boolean(p.name));
  }, [externalData]);

  const totalItems = useMemo(() => {
    const pages = (externalData?.pages
      || []) as ExternalProductsPagedResponse[];
    const first = pages[0];
    const totalItemsRaw = Number((first as any)?.totalItems);
    return Number.isFinite(totalItemsRaw) && totalItemsRaw >= 0
      ? totalItemsRaw
      : 0;
  }, [externalData]);

  const sourceProducts = apiProducts;
  const isProductsLoading = isExternalLoading || isExternalFetching;

  useEffect(() => {
    if (!favorites.length) return;
    if (!sourceProducts.length) return;
    const byId = new Map(sourceProducts.map((p) => [String(p.id), p] as const));
    setFavoriteItemsById((prev) => {
      let changed = false;
      const next = { ...prev };
      favorites.forEach((id) => {
        const fresh = byId.get(String(id));
        if (fresh) {
          next[String(id)] = fresh;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [favorites, sourceProducts]);

  useEffect(() => {
    productsRef.current = sourceProducts;
  }, [sourceProducts]);

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

        const same = item.name === nextItem.name;
        item.brand === nextItem.brand
          && item.category === nextItem.category;
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

  useEffect(() => {
    if (activeBrand === "Все") return;
    if (!derivedBrands.includes(activeBrand)) {
      setActiveBrand("Все");
    }
  }, [activeBrand, derivedBrands]);

  const filteredAndSortedProducts = useMemo(
    () => sourceProducts,
    [sourceProducts]
  );

  const addToCart = (product: Product) => {
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
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
      .map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      })
      .filter((item) => item.quantity > 0)
    );
  };

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

  const resetFilters = () => {
    setActiveBrand("Все");
    setActiveCategory("Все");
    setSearchQuery("");
  };

  useEffect(() => {
    const raw = String(searchQuery || "").trim();
    const looksLikeId = raw.length >= 12 && raw.length <= 120;
    !raw.includes(" ")
      && !raw.includes("\t")
      && !raw.includes("\n");
    if (!looksLikeId) return;

    setActiveCategory("Все");
    setActiveBrand("Все");
    setStartProductId(raw);
  }, [searchQuery, setActiveBrand, setActiveCategory, setStartProductId]);

  const sendOrderToManager = async () => {
    if (isSendingOrder) return;
    if (!cart.length) return;

    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const initData = tg?.initData;

    if (!user?.id || !initData) {
      alert(
        "Откройте мини‑приложение внутри Telegram, чтобы отправить заказ менеджеру."
      );
      return;
    }

    const payload = {
      initData,
      comment: orderComment,
      items: cart.map((it) => ({
        id: it.id,
        title: it.name,
        quantity: it.quantity,
        hasPrice: it.hasPrice !== false,
        price: it.hasPrice !== false ? it.price : null,
        image: it.images?.[0] || ""
      }))
    };

    try {
      setIsSendingOrder(true);
      await Api.post("/orders", payload, { timeout: 30000 });
      alert("Заказ отправлен менеджеру");
      setCart([]);
      setOrderComment("");
      setCurrentView("home");
    } catch (e: any) {
      const msg = e?.response?.data?.error;
      e?.message || "Не удалось отправить заказ менеджеру";
      alert(String(msg));
    } finally {
      setIsSendingOrder(false);
    }
  };

  const copyProductLink = useCallback(() => {
    if (!selectedProduct) return;

    const id = String(selectedProduct.id || "").trim();
    const productUrl = id
      ? `https://t.me/YeezyUniqueBot?startapp=product__${id}`
      : `${window.location.origin}?start_param=product_${selectedProduct.id}`;

    navigator.clipboard
      .writeText(productUrl)
      .then(() => {
        alert("Ссылка скопирована!");
      })
      .catch(() => {
        alert("Не удалось скопировать ссылку");
      });
  }, [selectedProduct]);

  const navigateToProduct = useCallback(
    (product: Product) => {
      if (currentView === "home") saveHomeScroll();
      setSelectedProduct(product);
      setCurrentImageIndex(0);
      const first = product?.images?.[0] || "";
      const firstResolved = first ? getDetailImageUrl(first) : "";
      setDetailLayerASrc(firstResolved);
      setDetailLayerBSrc("");
      setActiveDetailLayer("A");
      setIsDetailImageCrossfading(false);
      setCurrentView("product-detail");
      window.scrollTo(0, 0);
    },
    [currentView, saveHomeScroll]
  );

  useEffect(() => {
    if (!startProductId) return;

    const product = sourceProducts.find(
      (p) => String(p.id) === String(startProductId)
    );

    if (product) {
      navigateToProduct(product);
      setStartProductId(null);
      return;
    }

    if (!hasNextPage) return;
    if (isFetchingNextPage) return;
    fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    navigateToProduct,
    sourceProducts,
    startProductId
  ]);

  useEffect(() => {
    const nextSrc = selectedProduct?.images?.[currentImageIndex] || "";
    if (!selectedProduct || !nextSrc) return;
    const nextResolved = getDetailImageUrl(nextSrc);
    const currentResolved =
      activeDetailLayer === "A" ? detailLayerASrc : detailLayerBSrc;
    if (nextResolved === currentResolved) return;

    let cancelled = false;
    setIsDetailImageCrossfading(false);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const nextLayer = activeDetailLayer === "A" ? "B" : "A";
      if (nextLayer === "A") setDetailLayerASrc(nextResolved);
      else setDetailLayerBSrc(nextResolved);

      requestAnimationFrame(() => {
        if (cancelled) return;
        setIsDetailImageCrossfading(true);
        setActiveDetailLayer(nextLayer);
      });

      window.setTimeout(() => {
        if (cancelled) return;
        setIsDetailImageCrossfading(false);
      }, 260);
    };
    img.onerror = () => {
      if (cancelled) return;
      // если не загрузилось корректно, всё равно переключаемся на следующий слой
      const nextLayer = activeDetailLayer === "A" ? "B" : "A";
      if (nextLayer === "A") setDetailLayerASrc(nextResolved);
      else setDetailLayerBSrc(nextResolved);
      setActiveDetailLayer(nextLayer);
      setIsDetailImageCrossfading(false);
    };
    img.src = nextResolved;

    return () => {
      cancelled = true;
    };
  }, [
    activeDetailLayer,
    currentImageIndex,
    detailLayerASrc,
    detailLayerBSrc,
    getDetailImageUrl,
    selectedProduct
  ]);

  useEffect(() => {
    if (!selectedProduct) return;
    const images = Array.isArray(selectedProduct.images)
      ? selectedProduct.images
      : [];
    if (images.length < 2) return;

    const nextIndex =      currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
    const prevIndex =      currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
    const toPrefetch = [images[nextIndex], images[prevIndex]].filter(Boolean);

    toPrefetch.forEach((src) => {
      try {
        const img = new Image();
        img.src = getDetailImageUrl(String(src));
      } catch {
        // ignore
      }
    });
  }, [currentImageIndex, getDetailImageUrl, selectedProduct]);

  useEffect(() => {
    if (currentView !== "product-detail") return;
    if (!selectedProduct) return;

    const images = Array.isArray(selectedProduct.images)
      ? selectedProduct.images
      : [];
    if (images.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const currentRaw = String(
        selectedProduct.images?.[currentImageIndex] || ""
      );
      const currentResolved = currentRaw ? getDetailImageUrl(currentRaw) : "";

      const resolved = images
        .map((src) => {
          try {
            return getDetailImageUrl(String(src));
          } catch {
            return "";
          }
        })
        .filter(Boolean)
        .filter((src) => src !== currentResolved);

      const uniq = Array.from(new Set(resolved));
      const concurrency = 3;
      let idx = 0;

      const pump = () => {
        if (cancelled) return;
        while (idx < uniq.length && idx < 1000) {
          const batchStart = idx;
          const batch = uniq.slice(batchStart, batchStart + concurrency);
          idx += batch.length;
          batch.forEach((src) => {
            try {
              const img = new Image();
              img.src = src;
            } catch {
              // ignore
            }
          });

          // отдаем управление UI
          window.setTimeout(() => pump(), 0);
          return;
        }
      };

      pump();
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentImageIndex, currentView, getDetailImageUrl, selectedProduct]);

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      {currentView !== "product-detail" && (
        <TopNav
          currentView={currentView}
          scrolled={scrolled}
          setCurrentView={setCurrentView}
          restoreHomeScroll={restoreHomeScroll}
          shouldRestoreHomeScrollRef={shouldRestoreHomeScrollRef}
        />
      )}

      <main>
        {currentView === "home" && (
          <HomeView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            derivedCategories={derivedCategories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            derivedBrands={derivedBrands}
            activeBrand={activeBrand}
            setActiveBrand={setActiveBrand}
            resetFilters={resetFilters}
            totalItems={totalItems}
            isProductsLoading={isProductsLoading}
            sourceProducts={sourceProducts}
            filteredAndSortedProducts={filteredAndSortedProducts}
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
            loadMoreRef={loadMoreRef}
          />
        )}
        {currentView === "product-detail" && (
          <ProductDetailView
            selectedProduct={selectedProduct}
            activeDetailLayer={activeDetailLayer}
            detailLayerASrc={detailLayerASrc}
            detailLayerBSrc={detailLayerBSrc}
            isDetailImageCrossfading={isDetailImageCrossfading}
            currentImageIndex={currentImageIndex}
            setCurrentImageIndex={setCurrentImageIndex}
            touchStartXRef={touchStartXRef}
            touchLastXRef={touchLastXRef}
            favorites={favorites}
            favoriteBumpId={favoriteBumpId}
            cart={cart}
            copyProductLink={copyProductLink}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            toggleFavorite={toggleFavorite}
          />
        )}
        {currentView === "cart" && (
          <CartView
            cart={cart}
            cartTotalText={cartTotalText}
            orderComment={orderComment}
            setOrderComment={setOrderComment}
            sendOrderToManager={sendOrderToManager}
            isSendingOrder={isSendingOrder}
            setCurrentView={setCurrentView}
            restoreHomeScroll={restoreHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            updateQuantity={updateQuantity}
          />
        )}
        {currentView === "favorites" && (
          <FavoritesView
            favorites={favorites}
            favoriteItemsById={favoriteItemsById}
            favoriteBumpId={favoriteBumpId}
            saveHomeScroll={saveHomeScroll}
            navigateToProduct={navigateToProduct}
            getThumbUrl={getThumbUrl}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
          />
        )}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      {currentView !== "product-detail" && (
        <BottomNav
          currentView={currentView}
          setCurrentView={setCurrentView}
          saveHomeScroll={saveHomeScroll}
          restoreHomeScroll={restoreHomeScroll}
          shouldRestoreHomeScrollRef={shouldRestoreHomeScrollRef}
          cartCount={cartCount}
        />
      )}
    </div>
  );
};

export default App;
