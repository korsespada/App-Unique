import React, { useRef, useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, ArrowLeft, Plus, Minus, Trash2, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Product, AppView, CartItem } from './types';

import { useGetExternalProducts } from "@framework/api/product/external-get";
import Api from "@framework/api/utils/api-config";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeBrand, setActiveBrand] = useState<string>('Все');
  const [activeCategory, setActiveCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [startProductId, setStartProductId] = useState<string | null>(null);

  // Gallery state for ProductDetail
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchLastXRef = useRef<number | null>(null);

  const productsRef = useRef<Product[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const isHistoryFirstRef = useRef(true);
  const isPopNavRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const startParam = String(tg?.initDataUnsafe?.start_param || '').trim();
    if (!startParam) return;

    if (startParam.startsWith('product_')) {
      const id = startParam.slice('product_'.length).trim();
      if (id) setStartProductId(id);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tg_cart');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const restored = parsed
        .filter((it) => it && typeof it === 'object' && (it as any).id && (it as any).name)
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
      localStorage.setItem('tg_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  const { data: externalData, isLoading: isExternalLoading, isFetching: isExternalFetching } = useGetExternalProducts();

  const apiProducts = useMemo<Product[]>(() => {
    const raw = externalData?.products ?? [];
    return raw
      .map((p) => {
        const id = String((p as any).id || p.product_id || '');
        const name = String(p.title || p.name || p.product_id || '').trim();
        const brand = String(p.brand || p.season_title || '').trim();
        const category = String(p.category || 'Все');
        const images = Array.isArray(p.images) && p.images.length ? p.images : [];

        const rawPrice = Number((p as any).price);
        const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;

        return {
          id,
          name,
          brand: brand || ' ',
          category,
          price: hasPrice ? rawPrice : 1,
          hasPrice,
          images: images.length ? images : ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000'],
          description: String(p.description || ''),
          details: Array.isArray((p as any).details) ? (p as any).details : []
        };
      })
      .filter((p) => Boolean(p.id) && Boolean(p.name));
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
      const byId = new Map(sourceProducts.map((p) => [String(p.id), p] as const));

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
          quantity: item.quantity,
        };

        const itemFirstImg = Array.isArray(item.images) ? item.images[0] : undefined;
        const freshFirstImg = Array.isArray(nextItem.images) ? nextItem.images[0] : undefined;

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
    const tg = window.Telegram?.WebApp;
    const backButton = tg?.BackButton as any;
    if (!backButton) return;

    const handler = () => window.history.back();

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
    const tg = window.Telegram?.WebApp;
    const backButton = tg?.BackButton as any;
    if (!backButton) return;
    if (currentView === 'home') backButton.hide();
    else backButton.show();
  }, [currentView]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = (e.state || {}) as any;
      const view = state?.view as AppView | undefined;

      isPopNavRef.current = true;

      if (!view) {
        setSelectedProduct(null);
        setCurrentView('home');
        return;
      }

      if (view === 'product-detail') {
        const productId = String(state?.productId || '').trim();
        const fromProducts = productsRef.current.find((p) => p.id === productId);
        const fromCart = cartRef.current.find((p) => p.id === productId);
        const product = fromProducts || fromCart;
        if (product) {
          setSelectedProduct(product);
          setCurrentImageIndex(0);
          setCurrentView('product-detail');
        } else {
          setSelectedProduct(null);
          setCurrentView('home');
        }
        return;
      }

      setSelectedProduct(null);
      setCurrentView(view);
    };

    window.history.replaceState({ view: 'home' }, '');
    isHistoryFirstRef.current = false;

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (isPopNavRef.current) {
      isPopNavRef.current = false;
      return;
    }

    const state =
      currentView === 'product-detail'
        ? { view: currentView, productId: selectedProduct?.id || '' }
        : { view: currentView };

    window.history.pushState(state, '');
  }, [currentView, selectedProduct?.id]);

  const derivedBrands = useMemo<string[]>(() => {
    const uniq = Array.from(
      new Set(sourceProducts.map((p) => String(p.brand || '').trim()).filter(Boolean))
    );
    return ['Все', ...uniq.sort((a, b) => a.localeCompare(b))];
  }, [sourceProducts]);

  const derivedCategories = useMemo<string[]>(() => {
    const uniq = Array.from(
      new Set(sourceProducts.map((p) => String(p.category || '').trim()).filter(Boolean))
    );
    return ['Все', ...uniq.sort((a, b) => a.localeCompare(b))];
  }, [sourceProducts]);

  const filteredAndSortedProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return sourceProducts.filter(p => {
      const matchesBrand = activeBrand === 'Все' || p.brand === activeBrand;
      const matchesCategory = activeCategory === 'Все' || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(q) ||
                            p.brand.toLowerCase().includes(q) ||
                            String(p.id).toLowerCase().includes(q);
      return matchesBrand && matchesCategory && matchesSearch;
    });
  }, [activeBrand, activeCategory, searchQuery, sourceProducts]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
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
  const cartTotalText = cartHasUnknownPrice
    ? (cartTotal > 0 ? `${cartTotal.toLocaleString()} ₽ (без товаров с уточняемой ценой)` : 'цена уточняется')
    : `${cartTotal.toLocaleString()} ₽`;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const resetFilters = () => {
    setActiveBrand('Все');
    setActiveCategory('Все');
    setSearchQuery('');
  };

  const sendOrderToManager = async () => {
    if (isSendingOrder) return;
    if (!cart.length) return;

    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const initData = tg?.initData;

    if (!user?.id || !initData) {
      alert('Откройте мини‑приложение внутри Telegram, чтобы отправить заказ менеджеру.');
      return;
    }

    const payload = {
      initData,
      items: cart.map((it) => ({
        id: it.id,
        title: it.name,
        quantity: it.quantity,
        hasPrice: it.hasPrice !== false,
        price: it.hasPrice !== false ? it.price : null,
        image: it.images?.[0] || ''
      }))
    };

    try {
      setIsSendingOrder(true);
      await Api.post('/orders', payload, { timeout: 30000 });
      alert('Заказ отправлен менеджеру');
      setCart([]);
      setCurrentView('home');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Не удалось отправить заказ менеджеру';
      alert(String(msg));
    } finally {
      setIsSendingOrder(false);
    }
  };

  const navigateToProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
    setCurrentView('product-detail');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (!startProductId) return;
    if (!sourceProducts.length) return;

    const product = sourceProducts.find((p) => String(p.id) === String(startProductId));
    if (!product) return;

    navigateToProduct(product);
    setStartProductId(null);
  }, [startProductId, sourceProducts]);

  const HomeView = () => (
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
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 px-6 pr-12 text-[13px] font-medium tracking-tight text-white placeholder:text-white/40 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
          {searchQuery.trim() ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/40 transition-colors hover:text-white/70"
              aria-label="Очистить поиск"
            >
              <X size={18} />
            </button>
          ) : (
            <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35" />
          )}
        </div>
      </div>

      {/* Brand Select */}
      <div className="px-6 mb-12 space-y-4">
        <div className="relative group">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          >
            <option value="Все">Бренд: Все</option>
            {derivedBrands.filter((b) => b !== 'Все').map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-hover:text-white/60" />
        </div>

        <div className="relative group">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-5 pr-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 outline-none transition-all duration-200 ease-out premium-shadow focus:border-white/20 focus:ring-2 focus:ring-white/10"
          >
            <option value="Все">Категория: Все</option>
            {derivedCategories.filter((c) => c !== 'Все').map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-hover:text-white/60" />
        </div>
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
          filteredAndSortedProducts.map(product => (
            <div key={product.id} className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98]" onClick={() => navigateToProduct(product)}>
              <div className="relative mb-5 aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 premium-shadow transition-all duration-300 ease-out group-hover:border-white/20 group-hover:bg-white/7">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="px-2">
                <p className="mb-1 text-[9px] font-light uppercase tracking-[0.28em] text-white/40">{product.brand}</p>
                <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-semibold tracking-tight text-white">{product.name}</h3>
              </div>
            </div>
          ))
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

    </div>
  );

  const ProductDetailView = () => {
    if (!selectedProduct) return null;

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
        setCurrentImageIndex((prev) => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1));
      } else {
        setCurrentImageIndex((prev) => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1));
      }
    };

    return (
      <div className="pb-32 pt-16 animate-in slide-in-from-right duration-500 bg-[#050505] text-white">
        {/* Hero Image Section */}
        <div
          className="relative aspect-[4/5] w-full overflow-hidden"
          onTouchStart={handleGalleryTouchStart}
          onTouchMove={handleGalleryTouchMove}
          onTouchEnd={handleGalleryTouchEnd}
        >
          <img
            src={selectedProduct.images[currentImageIndex]}
            alt={selectedProduct.name}
            className="w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

          {selectedProduct.images.length > 1 && (
            <div className="absolute bottom-12 left-0 right-0 px-6 flex justify-between items-center pointer-events-none">
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === 0 ? selectedProduct.images.length - 1 : prev - 1)); }}
                className="pointer-events-auto rounded-3xl border border-white/15 bg-black/40 p-4 backdrop-blur-2xl premium-shadow transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2.5">
                {selectedProduct.images.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/25'}`} />
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev === selectedProduct.images.length - 1 ? 0 : prev + 1)); }}
                className="pointer-events-auto rounded-3xl border border-white/15 bg-black/40 p-4 backdrop-blur-2xl premium-shadow transition-all duration-200 ease-out active:scale-[0.97]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        <div className="relative z-10 -mt-8 rounded-t-[3rem] bg-[#070707] px-8 pt-12">
          <div className="flex justify-between items-start mb-10">
            <div className="max-w-[70%]">
              <p className="mb-3 text-[10px] font-extralight uppercase tracking-[0.42em] text-white/40">{selectedProduct.brand}</p>
              <h2 className="text-4xl font-extrabold leading-none tracking-tight text-white">{selectedProduct.name}</h2>

              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">ID: {selectedProduct.id}</p>

              <button
                onClick={() => { addToCart(selectedProduct); setCurrentView('cart'); }}
                className="mt-6 w-full rounded-3xl bg-white py-5 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-2xl shadow-black/40 transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
              >
                В корзину
              </button>
            </div>
            <div className="text-right">
              {selectedProduct.hasPrice ? (
                <p className="text-2xl font-extrabold text-white opacity-0 select-none">{selectedProduct.price.toLocaleString()} ₽</p>
              ) : (
                <p className="text-2xl font-extrabold text-white opacity-0 select-none"> </p>
              )}
              <div className="ml-auto mt-2 h-1 w-8 bg-white/40" />
            </div>
          </div>

          <p className="mb-12 text-[15px] font-medium leading-relaxed text-white/70">
            {selectedProduct.description}
          </p>

          <div className="space-y-8 mb-12">
            <div className="grid grid-cols-1 gap-5">
              {selectedProduct.details.map((detail, i) => (
                <div key={i} className="flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 transition-all duration-300 ease-out hover:border-white/20 hover:bg-white/7 hover:translate-x-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs font-semibold text-white/50 premium-shadow">0{i+1}</div>
                  <span className="text-[13px] font-semibold text-white/85">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CartView = () => (
    <div className="min-h-screen animate-in fade-in duration-500 px-8 pt-24 pb-32 text-white">
      <div className="flex justify-between items-end mb-12">
        <h2 className="text-5xl font-extrabold tracking-tight">Корзина</h2>
        <span className="text-lg font-semibold text-white/35">{cartCount}</span>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <div className="mb-10 flex h-32 w-32 items-center justify-center rounded-[3rem] border border-white/10 bg-white/5 premium-shadow">
            <ShoppingBag size={40} className="text-white/25" />
          </div>
          <p className="mb-12 font-semibold tracking-tight text-white/55">Ваша корзина пуста</p>
          <button
            onClick={() => setCurrentView('home')}
            className="rounded-2xl bg-white px-12 py-5 text-[10px] font-extrabold uppercase tracking-[0.34em] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98]"
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
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="mb-1 text-[9px] font-light uppercase tracking-[0.34em] text-white/40">{item.brand}</p>
                      <h4 className="mb-1 text-[15px] font-semibold leading-tight text-white">{item.name}</h4>
                      <p className="text-sm font-bold text-white/80 opacity-0 select-none">{item.price.toLocaleString()} ₽</p>
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
            <button
              onClick={sendOrderToManager}
              disabled={isSendingOrder}
              className="w-full rounded-2xl bg-white py-6 text-[14px] font-extrabold uppercase tracking-normal [font-kerning:normal] text-black shadow-xl transition-all duration-200 ease-out hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
            >
              {isSendingOrder ? 'Отправляем…' : 'Отправить менеджеру'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-gradient-to-b from-black via-[#070707] to-[#050505] text-white">
      {/* Dynamic Navbar */}
      <nav className={`fixed top-0 max-w-md w-full z-[120] h-14 px-6 flex items-center justify-center transition-colors duration-300 ${scrolled || currentView !== 'home' ? 'blur-nav border-b border-white/10' : 'bg-transparent'}`}>
        {currentView !== 'home' && (
          <button
            onClick={() => window.history.back()}
            className="absolute left-4 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/80 premium-shadow transition-all duration-200 ease-out hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div
          onClick={() => { setCurrentView('home'); window.scrollTo({top:0, behavior:'smooth'}); }}
          className="cursor-pointer select-none"
        >
          <img src="/logo.svg" alt="Logo" className="logo-auto h-7 w-auto opacity-95" />
        </div>
      </nav>

      <main>
        {currentView === 'home' && HomeView()}
        {currentView === 'product-detail' && ProductDetailView()}
        {currentView === 'cart' && CartView()}
      </main>

      {/* Stylish Minimal Bottom Nav */}
      <div className="fixed bottom-0 max-w-md w-full px-12 pb-6 pt-2 z-[110] flex justify-center">
        <div className="flex items-center gap-16 rounded-[2rem] border border-white/10 bg-black/50 px-12 py-3 shadow-2xl backdrop-blur-2xl">
          <button
            onClick={() => { setCurrentView('home'); window.scrollTo({top:0, behavior:'smooth'}); }}
            className={`transition-all ${currentView === 'home' ? 'text-white scale-125' : 'text-neutral-500 hover:text-white'}`}
          >
            <Search size={22} strokeWidth={currentView === 'home' ? 3 : 2} />
          </button>
          <button
            onClick={() => setCurrentView('cart')}
            className={`relative transition-all ${currentView === 'cart' ? 'text-white scale-125' : 'text-neutral-500 hover:text-white'}`}
          >
            <ShoppingBag size={22} strokeWidth={currentView === 'cart' ? 3 : 2} />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-extrabold text-black">{cartCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
