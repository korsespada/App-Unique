import {
  ExternalProductsPagedResponse,
  useGetExternalProducts
} from "@framework/api/product/external-get";
import Api from "@framework/api/utils/api-config";
import {
  ArrowLeft,
  ChevronDown,
  Heart,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { AppView, CartItem, Product } from "./types";

const App: React.FC = () => {
  type CatalogFiltersResponse = {
    categories?: string[];
    brands?: string[];
    brandsByCategory?: Record<string, string[]>;
  };

  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [startProductId, setStartProductId] = useState<string | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => String(Date.now()));
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteBumpId, setFavoriteBumpId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState<string>("");

  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<string[]>([]);
  const [catalogBrandsByCategory, setCatalogBrandsByCategory] = useState<
    Record<string, string[]>
  >({});

  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);

  const saveHomeScroll = useCallback(() => {
    homeScrollYRef.current = window.scrollY || 0;
  }, []);

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);
  const [detailLayerASrc, setDetailLayerASrc] = useState<string>("");
  const [detailLayerBSrc, setDetailLayerBSrc] = useState<string>("");
  const [activeDetailLayer, setActiveDetailLayer] = useState<"A" | "B">("A");
  const [isDetailImageCrossfading, setIsDetailImageCrossfading] = useState(false);

  const productsRef = useRef<Product[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const isHistoryFirstRef = useRef(true);
  const isPopNavRef = useRef(false);
  const lastPushedViewRef = useRef<AppView>("home");

  const getThumbUrl = useCallback((url: string, thumb = "400x500") => {
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (currentView !== "home") return;
      homeScrollYRef.current = window.scrollY || 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [currentView]);

  useLayoutEffect(() => {
    if (currentView !== "home") return;
    if (!shouldRestoreHomeScrollRef.current) return;
    shouldRestoreHomeScrollRef.current = false;
    restoreHomeScroll("auto");
  }, [currentView]);

  const restoreHomeScroll = (behavior: "auto" | "smooth" = "auto") => {
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
  };

  const scrollHomeToTop = (behavior: "auto" | "smooth" = "auto") => {
    homeScrollYRef.current = 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior });
    });
  };

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
          (it) =>
            it && typeof it === "object" && (it as any).id && (it as any).name
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
    category: activeCategory === "Все" ? undefined : activeCategory,
    seed: shuffleSeed
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
        const brandsByCategory =
          brandsByCategoryRaw && typeof brandsByCategoryRaw === "object"
          ? brandsByCategoryRaw
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
    const pages = (externalData?.pages ||
      []) as ExternalProductsPagedResponse[];
    const raw = pages.flatMap((p) =>
      Array.isArray(p?.products) ? p.products : []
    );
    return raw
      .map((p) => {
        const id = String((p as any).id || p.product_id || "");
        const name = String(p.title || p.name || p.product_id || "").trim();
        const brand = String(p.brand || p.season_title || "").trim();
        const category = String(p.category || "Все");
        const images =
          Array.isArray(p.images) && p.images.length ? p.images : [];

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
          description: String(p.description || ""),
          details: Array.isArray((p as any).details) ? (p as any).details : []
        };
      })
      .filter((p) => Boolean(p.id) && Boolean(p.name));
  }, [externalData]);

  const totalItems = useMemo(() => {
    const pages = (externalData?.pages ||
      []) as ExternalProductsPagedResponse[];
    const first = pages[0];
    const totalItemsRaw = Number((first as any)?.totalItems);
    return Number.isFinite(totalItemsRaw) && totalItemsRaw >= 0
      ? totalItemsRaw
      : 0;
  }, [externalData]);

  const sourceProducts = apiProducts;
  const isProductsLoading = isExternalLoading || isExternalFetching;

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

        const same =
          item.name === nextItem.name &&
          item.brand === nextItem.brand &&
          item.category === nextItem.category;
        Number(item.price) === Number(nextItem.price)
          && (item.hasPrice ?? true) === (nextItem.hasPrice ?? true)
          && itemFirstImg === freshFirstImg;

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
    const state =      currentView === "product-detail"
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

  const filteredAndSortedProducts = useMemo(() => {
    if (!sourceProducts.length) return sourceProducts;

    const arr = [...sourceProducts];

    let x = 0;
    for (let i = 0; i < shuffleSeed.length; i += 1) {
      x = (x * 31 + shuffleSeed.charCodeAt(i)) >>> 0;
    }

    const rand = () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };

    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }

    return arr;
  }, [shuffleSeed, sourceProducts]);

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
    setCart((prev) => prev
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0));
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
    setShuffleSeed(String(Date.now()));
  };

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
    [currentView, getDetailImageUrl]
  );

  useEffect(() => {
    if (!startProductId) return;
    if (!sourceProducts.length) return;

    const product = sourceProducts.find(
      (p) => String(p.id) === String(startProductId)
    );
    if (!product) return;

    navigateToProduct(product);
    setStartProductId(null);
  }, [navigateToProduct, sourceProducts, startProductId]);

  useEffect(() => {
    const nextSrc = selectedProduct?.images?.[currentImageIndex] || "";
    if (!selectedProduct || !nextSrc) return;
    const nextResolved = getDetailImageUrl(nextSrc);
    const currentResolved = activeDetailLayer === "A" ? detailLayerASrc : detailLayerBSrc;
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
  }, [activeDetailLayer, currentImageIndex, detailLayerASrc, detailLayerBSrc, getDetailImageUrl, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) return;
    const images = Array.isArray(selectedProduct.images)
      ? selectedProduct.images
      : [];
    if (images.length < 2) return;

    const nextIndex =
      currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
    const prevIndex =
      currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
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

    const images = Array.isArray(selectedProduct.images) ? selectedProduct.images : [];
    if (images.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const currentRaw = String(selectedProduct.images?.[currentImageIndex] || "");
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

  function HomeView() {
    return (
      <div className="animate-in fade-in pb-32 pt-2 duration-700">
        {/* Search Header */}
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

          {currentView === "product-detail" && (
    <button
              type="button"
              onClick={() => setCurrentView("cart")}
              className="premium-shadow absolute right-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]"
              aria-label="Открыть корзину">
              <ShoppingBag size={18} />
            </button>
    )}
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4 px-4">
          {/* Categories tabs */}
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

          {/* Brand Select */}
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
            {" "}
      {totalItems}
    </p>
        </div>

        {/* Modern Grid */}
        <div className="grid grid-cols-2 gap-4 px-4">
          {isProductsLoading && sourceProducts.length === 0 ? (
      Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="animate-pulse">
                <div className="mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5" />
                <div className="px-2">
                  <div className="mb-2 h-3 w-16 rounded bg-white/10" />
                  <div className="h-4 w-28 rounded bg-white/10" />
                </div>
              </div>
      ))
    ) : filteredAndSortedProducts.length > 0 ? (
      filteredAndSortedProducts.map((product) => {
        const isFavorited = favorites.includes(String(product.id));
        const isBumping = favoriteBumpId === String(product.id);

        return (
                <div
                  key={product.id} className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]" onClick={() => {
                  saveHomeScroll();
                  navigateToProduct(product);
                  }}>
                  <div className="premium-shadow group-hover:bg-white/7 relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 transition-all duration-300 ease-out group-hover:border-white/20">
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

        <div className="px-4">
          {hasNextPage && (
            <div className="mt-8 flex flex-col items-center gap-4">
              {(isFetchingNextPage || isExternalFetching) && (
                <div className="text-white/55 animate-pulse text-[12px] font-semibold">
                  Загружаем товары…
                </div>
              )}
              {!isFetchingNextPage && (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10">
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

  function FavoritesView() {
    const favoriteProducts = filteredAndSortedProducts.filter((p) => favorites.includes(String(p.id)));

    return (
      <div className="animate-in fade-in pb-32 pt-24 text-white duration-700">
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
                  }}>
                  <div className="premium-shadow group-hover:bg-white/7 relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 transition-all duration-300 ease-out group-hover:border-white/20">
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
                  <div className="px-2">
                    <h3 className="-mt-2 line-clamp-2 min-h-[2.6em] text-[13px] font-semibold tracking-tight text-white">
                      {product.name}
                    </h3>
                    {product.hasPrice ? (
                      <p className="text-white/85 mt-0.5 text-[14px] font-extrabold">
                        {product.price.toLocaleString()} ₽
                      </p>
                    ) : (
                      <p className="text-white/45 mt-0.5 text-[13px] font-semibold">
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

  function ProductDetailView() {
    if (!selectedProduct) return null;

    const showA = activeDetailLayer === "A";
    const showB = !showA;

    const isFavorited = favorites.includes(String(selectedProduct.id));
    const isBumping = favoriteBumpId === String(selectedProduct.id);
    const isInCart = cart.some(
      (it) => String(it.id) === String(selectedProduct.id)
    );

    const handleGalleryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      touchStartXRef.current = e.touches[0]?.clientX ?? null;
      touchLastXRef.current = touchStartXRef.current;
    };

    const handleGalleryTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      touchLastXRef.current = e.touches[0]?.clientX ?? null;
    };

    const handleGalleryTouchEnd = () => {
      const start = touchStartXRef.current;
      const end = touchLastXRef.current;
      touchStartXRef.current = null;
      touchLastXRef.current = null;
      if (start == null || end == null) return;
      const delta = start - end;
      if (Math.abs(delta) < 40) return;
      if (selectedProduct.images.length < 2) return;
      if (delta > 0) {
        setCurrentImageIndex((prev) => prev === selectedProduct.images.length - 1 ? 0 : prev + 1);
      } else {
        setCurrentImageIndex((prev) => prev === 0 ? selectedProduct.images.length - 1 : prev - 1);
      }
    };

    return (
      <div className="animate-in slide-in-from-right bg-[#050505] pb-36 pt-0 text-white duration-500">
        {/* Hero Image Section */}
        <div
          className="relative aspect-[4/5] w-full overflow-hidden"
          onTouchStart={handleGalleryTouchStart}
          onTouchMove={handleGalleryTouchMove}
          onTouchEnd={handleGalleryTouchEnd}>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="premium-shadow absolute left-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/40 p-2.5 text-white/90 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.98]"
            aria-label="Назад">
            <ArrowLeft size={18} />
          </button>

          <img
            src={detailLayerASrc}
            alt={selectedProduct.name}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
              showA ? "opacity-100" : "opacity-0"
            } ${isDetailImageCrossfading ? "" : ""}`}
            decoding="async"
          />

          <img
            src={detailLayerBSrc}
            alt={selectedProduct.name}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${
              showB ? "opacity-100" : "opacity-0"
            } ${isDetailImageCrossfading ? "" : ""}`}
            decoding="async"
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

          {selectedProduct.images.length > 1 && (
            <div className="pointer-events-none absolute bottom-12 left-0 right-0 flex items-center justify-center px-6">
              <div className="flex gap-2.5">
                {selectedProduct.images.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === currentImageIndex
                        ? "w-8 bg-white"
                        : "w-2 bg-white/25"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 -mt-8 rounded-t-[3rem] bg-[#070707] px-8 pt-12">
          <div className="mb-10">
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-extralight uppercase tracking-[0.42em] text-white/40">
                {selectedProduct.brand}
              </p>
              <h2 className="text-4xl font-extrabold leading-none tracking-tight text-white">
                {selectedProduct.name}
              </h2>

              {selectedProduct.hasPrice ? (
                <p className="mt-3 text-[16px] font-extrabold text-white">
                  {selectedProduct.price.toLocaleString()}
{' '}
₽
</p>
              ) : (
                <p className="mt-3 text-[13px] font-semibold tracking-normal text-white/60">
                  Цена по запросу
                </p>
              )}
              <div className="mt-4 h-1 w-8 bg-white/40" />
            </div>
          </div>

          <p
            className="mb-12 text-[15px] font-medium leading-relaxed text-white/70"
            style={{ whiteSpace: "pre-line" }}>
            {selectedProduct.description}
          </p>

          <div className="mb-12 space-y-8">
            <div className="grid grid-cols-1 gap-5">
              {selectedProduct.details.map((detail, i) => (
                <div
                  key={i}
                  className="hover:bg-white/7 flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 ease-out hover:translate-x-1 hover:border-white/20">
                  <div className="premium-shadow flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white/50">
                    0
{i + 1}
                  </div>
                  <span className="text-white/85 text-[13px] font-semibold">
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 z-[130] w-full max-w-md">
          <div className="bg-black/65 rounded-t-[2.5rem] border-t border-white/10 px-6 pb-6 pt-4 backdrop-blur-2xl">
            <div className="flex items-stretch gap-4">
              <button
                type="button"
                onClick={() => {
                  if (isInCart) {
                    setCurrentView("cart");
                    return;
                  }
                  addToCart(selectedProduct);
                }}
                className={`flex-1 rounded-2xl py-4 text-[14px] font-extrabold uppercase tracking-normal shadow-xl transition-all duration-200 ease-out [font-kerning:normal] active:scale-[0.98] ${
                  isInCart
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    : "bg-white text-black hover:bg-white/90"
                }`}>
                {isInCart ? "Перейти в корзину →" : "Добавить в корзину"}
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(selectedProduct.id)}
                aria-label={
                  isFavorited ? "Убрать из избранного" : "Добавить в избранное"
                }
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-200 ease-out active:scale-[0.96] ${
                  isBumping ? "scale-[1.06]" : "scale-100"
                }`}>
                <Heart
                  size={22}
                  className={
                    isFavorited
                      ? "fill-red-500 text-red-500 transition-colors"
                      : "text-white/80 transition-colors"
                  }
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function CartView() {
    return (
      <div
        className={`animate-in fade-in px-4 pb-32 pt-24 text-white duration-500 ${
          cart.length === 0 ? "h-[100dvh] overflow-hidden" : "min-h-screen"
        }`}>
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <h2 className="text-5xl font-extrabold tracking-tight">Корзина</h2>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="premium-shadow mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5">
              <ShoppingBag size={40} className="text-white/25" />
            </div>
      <p className="text-white/55 mb-12 font-semibold tracking-tight">
              Ваша корзина пуста
            </p>
      <button
              type="button"
              onClick={() => {
                setCurrentView("home");
                restoreHomeScroll();
              }}
              className="rounded-2xl bg-white px-12 py-4 text-[14px] font-extrabold uppercase tracking-normal text-black shadow-xl transition-all duration-200 ease-out [font-kerning:normal] hover:bg-white/90 active:scale-[0.98]">
              В каталог
            </button>
    </div>
        ) : (
    <>
            <div className="mb-16 space-y-8">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-center gap-8"
                  onClick={() => navigateToProduct(item)}>
                  <div className="premium-shadow h-32 w-28 flex-shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                    <img
                      src={getThumbUrl(item.images[0], "240x320")}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="mb-1 text-[9px] font-light uppercase tracking-[0.34em] text-white/40">
                          {item.brand}
                        </p>
                        <h4 className="mb-1 text-[15px] font-semibold leading-tight text-white">
                          {item.name}
                        </h4>
                        {item.hasPrice !== false && Number(item.price) > 0 ? (
                          <p className="text-sm font-bold text-white/80">
                            {Number(item.price).toLocaleString()} ₽
                          </p>
                        ) : (
                          <p className="text-white/55 text-[12px] font-semibold">
                            Цена по запросу
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item.id, -item.quantity);
                        }}
                        className="p-2 text-white/25 transition-colors hover:text-red-400">
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 self-start rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.quantity > 1) updateQuantity(item.id, -1);
                        }}
                        className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]">
                        <Minus size={14} />
                      </button>
                      <span className="min-w-[20px] text-center text-xs font-semibold text-white/80">
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(item.id, 1);
                        }}
                        className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-10 w-full rounded-[3.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-light uppercase tracking-[0.42em] text-white/40">
                  Сумма заказа
                </span>
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
                  className="premium-shadow placeholder:text-white/35 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[13px] font-medium text-white/80 outline-none transition-all duration-200 ease-out focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
              </div>

              <button
                onClick={sendOrderToManager}
                disabled={isSendingOrder}
                className="mt-6 w-full rounded-2xl bg-white py-6 text-[14px] font-extrabold uppercase tracking-normal text-black shadow-xl transition-all duration-200 ease-out [font-kerning:normal] hover:bg-white/90 active:scale-[0.98] disabled:opacity-60">
                {isSendingOrder ? "Отправляем…" : "Отправить менеджеру"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      {currentView !== "product-detail" && (
        <nav
          className={`z-[120] flex h-14 w-full max-w-md items-center justify-center px-6 transition-colors duration-300 ${
            scrolled || currentView !== "home"
              ? "blur-nav border-b border-white/10"
              : "bg-transparent"
          }`}>
          {currentView !== "home" && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="premium-shadow absolute left-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]">
              <ArrowLeft size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              shouldRestoreHomeScrollRef.current = true;
              restoreHomeScroll("auto");
            }}
            className="cursor-pointer select-none"
            aria-label="На главную">
            <img
              src="/logo.svg"
              alt="Logo"
              className="logo-auto h-7 w-auto opacity-95"
            />
          </button>
        </nav>
      )}

      <main>
        {currentView === "home" && HomeView()}
        {currentView === "product-detail" && ProductDetailView()}
        {currentView === "cart" && CartView()}
        {currentView === "favorites" && FavoritesView()}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      {currentView !== "product-detail" && (
        <div className="fixed bottom-0 z-[110] flex w-full max-w-md justify-center px-4 pb-6 pt-2">
          <div className="grid w-full grid-cols-3 items-center rounded-[2rem] border border-white/10 bg-black/50 px-6 py-3 shadow-2xl backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => {
                setCurrentView("home");
                shouldRestoreHomeScrollRef.current = true;
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
              aria-label="Избранное">
              <Heart
                size={22}
                strokeWidth={currentView === "favorites" ? 3 : 2}
                className={
                  currentView === "favorites" ? "text-white" : undefined
                }
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
