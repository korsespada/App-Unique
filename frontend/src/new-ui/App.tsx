import {
  ExternalProductsPagedResponse,
  useGetExternalProducts
} from "@framework/api/product/external-get";
import Api from "@framework/api/utils/api-config";
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Heart, Minus, Plus, Search, ShoppingBag, Trash2, X
} from "lucide-react";
import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";

import { AppView, CartItem, Product } from "./types";


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeBrand, setActiveBrand] = useState<string>("Все");
  const [activeCategory, setActiveCategory] = useState<string>("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [startProductId, setStartProductId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteBumpId, setFavoriteBumpId] = useState<string | null>(null);
  const [orderComment, setOrderComment] = useState<string>("");

  const homeScrollYRef = useRef(0);

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);

  const productsRef = useRef<Product[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const isHistoryFirstRef = useRef(true);
  const isPopNavRef = useRef(false);
  const lastPushedViewRef = useRef<AppView>("home");

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

  const restoreHomeScroll = (behavior: "auto" | "smooth" = "auto") => {
    const y = homeScrollYRef.current || 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior });
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
    brand: activeBrand === "Все" ? "" : activeBrand,
    category: activeCategory === "Все" ? "" : activeCategory
  });

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

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
    const pages = (externalData?.pages || []) as ExternalProductsPagedResponse[];
    const raw = pages.flatMap((p) => (Array.isArray(p?.products) ? p.products : []));
    return raw
      .map((p) => {
        const id = String((p as any).id || p.product_id || "");
        const name = String(p.title || p.name || p.product_id || "").trim();
        const brand = String(p.brand || p.season_title || "").trim();
        const category = String(p.category || "Все");
        const images = Array.isArray(p.images) && p.images.length ? p.images : [];

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
    const pages = (externalData?.pages || []) as ExternalProductsPagedResponse[];
    const first = pages[0];
    const v = Number((first as any)?.totalItems);
    return Number.isFinite(v) && v >= 0 ? v : 0;
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
        scrollHomeToTop();
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
        const fromView = state?.fromView as AppView | undefined;
        if (fromView === "product-detail") restoreHomeScroll();
        else scrollHomeToTop();
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

  const derivedBrands = useMemo<string[]>(() => {
    const uniq = Array.from(
      new Set(
        sourceProducts.map((p) => String(p.brand || "").trim()).filter(Boolean)
      )
    );
    return ["Все", ...uniq.sort((a, b) => a.localeCompare(b))];
  }, [sourceProducts]);

  const derivedCategories = useMemo<string[]>(() => {
    const uniq = Array.from(
      new Set(
        sourceProducts
          .map((p) => String(p.category || "").trim())
          .filter(Boolean)
      )
    );
    return ["Все", ...uniq.sort((a, b) => a.localeCompare(b))];
  }, [sourceProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    return sourceProducts;
  }, [sourceProducts]);

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
  const cartTotalText = cartTotal > 0
    ? `${cartTotal.toLocaleString()} ₽`
    : "Цена по запросу";
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const resetFilters = () => {
    setActiveBrand("Все");
    setActiveCategory("Все");
    setSearchQuery("");
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
      const msg =        e?.response?.data?.error
        || e?.message
        || "Не удалось отправить заказ менеджеру";
      alert(String(msg));
    } finally {
      setIsSendingOrder(false);
    }
  };

  const navigateToProduct = useCallback(
    (product: Product) => {
      if (currentView === "home") homeScrollYRef.current = window.scrollY || 0;
      setSelectedProduct(product);
      setCurrentImageIndex(0);
      setCurrentView("product-detail");
      window.scrollTo(0, 0);
    },
    [currentView]
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

  function HomeView() {
    return (
<div className="animate-in fade-in duration-700 pb-32 pt-20">
      {/* Search Header */}
      <div className="px-6 mb-10">
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
            <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35" />
          )}
        </div>

        {currentView === "product-detail" && (
          <button
            type="button"
            onClick={() => setCurrentView("cart")}
            className="premium-shadow absolute right-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]"
            aria-label="Открыть корзину"
          >
            <ShoppingBag size={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-6 mb-12 space-y-4">
        {/* Categories tabs */}
        <div className="-mx-6 px-6">
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {derivedCategories.map((category) => {
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold tracking-normal transition-all duration-200 ease-out premium-shadow active:scale-[0.98] ${
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

        {/* Brand Select */}
        <div className="relative group">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          >
            <option value="Все">Все бренды</option>
            {derivedBrands.filter((b) => b !== "Все").map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-hover:text-white/60" />
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

      <div className="px-6 mb-6">
        <p className="text-[12px] font-medium tracking-normal [font-kerning:normal] text-white/55">
          Товаров: {totalItems}
        </p>
      </div>

      {/* Modern Grid */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 px-6">
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
            <div key={product.id} className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]" onClick={() => navigateToProduct(product)}>
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
                <h3 className="line-clamp-2 min-h-[2.6em] -mt-2 text-[13px] font-semibold tracking-tight text-white">{product.name}</h3>
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

      <div ref={loadMoreRef} className="h-12" />

    </div>
    );
  }

  function FavoritesView() {
    const favoriteProducts = filteredAndSortedProducts.filter((p) =>
      favorites.includes(String(p.id))
    );

    return (
      <div className="animate-in fade-in duration-700 pb-32 pt-24 text-white">
        <div className="px-8 mb-12">
          <h2 className="text-5xl font-extrabold tracking-tight">Избранное</h2>
        </div>

        {favoriteProducts.length === 0 ? (
          <div className="px-8 py-40 text-center">
            <p className="text-[13px] font-medium tracking-normal [font-kerning:normal] text-white/55">
              Пока пусто
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 px-6">
            {favoriteProducts.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]"
                onClick={() => navigateToProduct(product)}
              >
                <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow">
                  <img
                    src={getThumbUrl(product.images[0])}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

                  <div className="premium-shadow absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl">
                    <Heart size={18} className="fill-red-500 text-red-500" />
                  </div>
                </div>
                <div className="px-2">
                  <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-semibold tracking-tight text-white">
                    {product.name}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function ProductDetailView() {
    if (!selectedProduct) return null;

    const isFavorited = favorites.includes(String(selectedProduct.id));
    const isBumping = favoriteBumpId === String(selectedProduct.id);
    const isInCart = cart.some((it) => String(it.id) === String(selectedProduct.id));

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
        setCurrentImageIndex((prev) =>
          prev === selectedProduct.images.length - 1 ? 0 : prev + 1
        );
      } else {
        setCurrentImageIndex((prev) =>
          prev === 0 ? selectedProduct.images.length - 1 : prev - 1
        );
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
            aria-label="Назад"
          >
            <ArrowLeft size={18} />
          </button>

          <img
            src={selectedProduct.images[currentImageIndex]}
            alt={selectedProduct.name}
            className="h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            decoding="async"
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

          {selectedProduct.images.length > 1 && (
            <div className="pointer-events-none absolute bottom-12 left-0 right-0 flex items-center justify-between px-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === 0 ? selectedProduct.images.length - 1 : prev - 1
                  );
                }}
                className="border-white/15 premium-shadow pointer-events-auto rounded-3xl border bg-black/40 p-4 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.97]">
                <ChevronLeft size={20} />
              </button>
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) =>
                    prev === selectedProduct.images.length - 1 ? 0 : prev + 1
                  );
                }}
                className="border-white/15 premium-shadow pointer-events-auto rounded-3xl border bg-black/40 p-4 backdrop-blur-2xl transition-all duration-200 ease-out active:scale-[0.97]">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 -mt-8 rounded-t-[3rem] bg-[#070707] px-8 pt-12">
          <div className="mb-10 flex items-start justify-between">
            <div className="max-w-[70%]">
              <p className="mb-3 text-[10px] font-extralight uppercase tracking-[0.42em] text-white/40">
                {selectedProduct.brand}
              </p>
              <h2 className="text-4xl font-extrabold leading-none tracking-tight text-white">
                {selectedProduct.name}
              </h2>

            </div>
            <div className="text-right">
              {selectedProduct.hasPrice ? (
                <p className="text-2xl font-extrabold text-white">
                  {selectedProduct.price.toLocaleString()} ₽
                </p>
              ) : (
                <p className="text-[12px] font-semibold tracking-normal text-white/60">
                  Цена по запросу
                </p>
              )}
              <div className="ml-auto mt-2 h-1 w-8 bg-white/40" />
            </div>
          </div>

          <p
            className="mb-12 text-[15px] font-medium leading-relaxed text-white/70"
            style={{ whiteSpace: "pre-line" }}
          >
            {selectedProduct.description}
          </p>

          <div className="mb-12 space-y-8">
            <div className="grid grid-cols-1 gap-5">
              {selectedProduct.details.map((detail, i) => (
                <div
                  key={i}
                  className="hover:bg-white/7 flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 ease-out hover:translate-x-1 hover:border-white/20">
                  <div className="premium-shadow flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white/50">
                    0{i + 1}
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
          <div className="rounded-t-[2.5rem] border-t border-white/10 bg-black/65 px-6 pb-6 pt-4 backdrop-blur-2xl">
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
                className={`flex-1 rounded-2xl py-4 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] shadow-xl transition-all duration-200 ease-out active:scale-[0.98] ${
                  isInCart
                    ? "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    : "bg-white text-black hover:bg-white/90"
                }`}
              >
                {isInCart ? "Перейти в корзину →" : "Добавить в корзину"}
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(selectedProduct.id)}
                aria-label={isFavorited ? "Убрать из избранного" : "Добавить в избранное"}
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition-all duration-200 ease-out active:scale-[0.96] ${
                  isBumping ? "scale-[1.06]" : "scale-100"
                }`}
              >
                <Heart
                  size={22}
                  className={
                    isFavorited
                      ? "text-red-500 fill-red-500 transition-colors"
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
        className={`animate-in fade-in duration-500 px-8 pt-24 pb-32 text-white ${
          cart.length === 0 ? "h-[100dvh] overflow-hidden" : "min-h-screen"
        }`}
      >
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <h2 className="text-5xl font-extrabold tracking-tight">Корзина</h2>
          {cartCount > 0 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/80">
              {cartCount}
            </span>
          )}
        </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5 premium-shadow">
            <ShoppingBag size={40} className="text-white/25" />
          </div>
          <p className="mb-12 font-semibold tracking-tight text-white/55">
            Ваша корзина пуста
          </p>
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              restoreHomeScroll();
            }}
            className="rounded-2xl bg-white px-12 py-4 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
          >
            В каталог
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8 mb-16">
            {cart.map(item => (
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
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -item.quantity); }} className="p-2 text-white/25 transition-colors hover:text-red-400">
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 self-start rounded-2xl border border-white/10 bg-white/5 px-2 py-1.5">
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"><Minus size={14} /></button>
                    <span className="min-w-[20px] text-center text-xs font-semibold text-white/80">{item.quantity}</span>
                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }} className="rounded-xl p-2 transition-all duration-200 ease-out hover:bg-white/10 active:scale-[0.98]"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-10 rounded-[3.5rem] border border-white/10 bg-white/5 p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-light uppercase tracking-[0.42em] text-white/40">Сумма заказа</span>
              <span className="text-right text-[13px] font-semibold leading-tight tracking-tight text-white">
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
                placeholder="Напишите комментарий к заказу"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[13px] font-medium text-white/80 outline-none transition-all duration-200 ease-out premium-shadow placeholder:text-white/35 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <button
              onClick={sendOrderToManager}
              disabled={isSendingOrder}
              className="mt-6 w-full rounded-2xl bg-white py-6 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
            >
              {isSendingOrder ? 'Отправляем…' : 'Отправить менеджеру'}
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
          className={`fixed top-0 z-[120] flex h-14 w-full max-w-md items-center justify-center px-6 transition-colors duration-300 ${
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
              if (currentView === "cart") scrollHomeToTop("smooth");
              else restoreHomeScroll("smooth");
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
        {currentView === "home" && HomeView()}
        {currentView === "product-detail" && ProductDetailView()}
        {currentView === "cart" && CartView()}
        {currentView === "favorites" && FavoritesView()}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      {currentView !== "product-detail" && (
      <div className="fixed bottom-0 z-[110] flex w-full max-w-md justify-center px-12 pb-6 pt-2">
        <div className="flex items-center gap-12 rounded-[2rem] border border-white/10 bg-black/50 px-12 py-3 shadow-2xl backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => {
              setCurrentView("home");
              if (currentView === "cart") scrollHomeToTop("smooth");
              else restoreHomeScroll("smooth");
            }}
            className={`transition-all ${
              currentView === "home"
                ? "scale-125 text-white"
                : "text-neutral-500 hover:text-white"
            }`}>
            <Search size={22} strokeWidth={currentView === "home" ? 3 : 2} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("favorites")}
            className={`transition-all ${
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
            onClick={() => setCurrentView("cart")}
            className={`relative transition-all ${
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
